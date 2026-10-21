import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";

test.use({ timezoneId: "Europe/Zurich" });

const template = unzipSync(await readFile(new URL("../liner-codes-template.xlsx", import.meta.url)));
const headers = [
  "Code", "Liner Name", "Parent Company", "Carrier Type", "Valid From", "Valid To",
  "Website", "Street", "Street Number", "Building/Floor", "ZP Code", "City",
  "State", "Country", "UNLOCODE", "Status", "Last update"
];
const active = {
  linerSMDGCode: "ABC", linerName: "Alpha & <Shipping>", parentCompany: "Parent",
  carrierType: "UNKNOWN", validFrom: "2026-01-01", validTo: "2027-01-01",
  website: "https://example.com", remarks: "=SUM(1,2)", codeStatus: "Active",
  address: "DO NOT EXPORT", addressLocation: {
    UnCountryCode: "CH", UnLocode: "GVA", address: {
      street: "Chemin Rieu", streetNumber: "12-14", floor: "Building\nFloor",
      postCode: "001208", city: "Geneva", state: "Canton of Geneva", country: "Switzerland"
    }
  },
  changeLogs: [{ lastUpdateDate: "2026-10-12" }, { lastUpdateDate: "2021-01-01" }]
};

async function workbook(page, records) {
  const bytes = await page.evaluate(async records => {
    const { createExcel } = await import("/excel-export.js");
    const template = await (await fetch("/liner-codes-template.xlsx")).arrayBuffer();
    return [...createExcel(template, records)];
  }, records);
  return unzipSync(new Uint8Array(bytes));
}

async function rows(page, bytes) {
  return page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("Invalid worksheet XML");
    return [...doc.getElementsByTagName("row")].filter(row => Number(row.getAttribute("r")) >= 9).map(row =>
      [...row.children].map(cell => ({
        value: cell.textContent, type: cell.getAttribute("t"), formula: cell.querySelector("f")?.textContent
      })));
  }, strFromU8(bytes));
}

test("export preserves branding and Description, maps A-Q without remarks, splits all statuses and sorts codes", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T22:30:00Z"));
  await page.goto("/liner-codes.html");
  const expired = { ...active, linerSMDGCode: "EXP", codeStatus: "Expired", carrierType: "VOCC" };
  const deleted = { linerSMDGCode: "DEL", linerName: "Deleted", codeStatus: "Deleted" };
  const marked = { ...deleted, linerSMDGCode: "MRK", codeStatus: "MarkedForDeletion" };
  const files = await workbook(page, [expired, marked, active, deleted]);
  expect(files["xl/worksheets/sheet3.xml"]).toEqual(template["xl/worksheets/sheet3.xml"]);
  expect(files["xl/media/image1.png"]).toEqual(template["xl/media/image1.png"]);
  expect(files["xl/sharedStrings.xml"]).toEqual(template["xl/sharedStrings.xml"]);
  const names = await page.evaluate(xml => [...new DOMParser().parseFromString(xml, "application/xml")
    .getElementsByTagName("sheet")].map(sheet => sheet.getAttribute("name")), strFromU8(files["xl/workbook.xml"]));
  expect(names).toEqual(["Active", "Outdated", "Description"]);
  for (const sheet of ["sheet1", "sheet2"]) {
    const xml = strFromU8(files[`xl/worksheets/${sheet}.xml`]);
    const version = await page.evaluate(xml => {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      return {
        value: doc.querySelector('c[r="D4"]').textContent,
        merged: !!doc.querySelector('mergeCell[ref="D4:G4"]')
      };
    }, xml);
    expect(version).toEqual({ value: "v20261021", merged: true });
    const layout = await page.evaluate(xml => {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      return {
        dimension: doc.querySelector("dimension").getAttribute("ref"),
        filter: doc.querySelector("autoFilter").getAttribute("ref"),
        columns: [...doc.querySelectorAll("cols col")].map(col => ({
          index: col.getAttribute("min"), width: col.getAttribute("width")
        })),
        rows: [...doc.querySelectorAll("row")].filter(row => Number(row.getAttribute("r")) >= 9)
          .map(row => ({ spans: row.getAttribute("spans"), cells: [...row.children].map(cell => cell.getAttribute("r")) }))
      };
    }, xml);
    const lastRow = sheet === "sheet1" ? 10 : 12;
    expect(layout.dimension).toBe(`A1:Q${lastRow}`);
    expect(layout.filter).toBe(`A9:Q${lastRow}`);
    expect(layout.columns).toHaveLength(17);
    expect(layout.columns.slice(-2)).toEqual([{ index: "16", width: "24" }, { index: "17", width: "15" }]);
    for (const [index, row] of layout.rows.entries()) {
      expect(row.spans).toBe("1:17");
      expect(row.cells).toEqual(headers.map((_, column) => `${String.fromCharCode(65 + column)}${index + 9}`));
    }
    expect(xml).not.toContain("=SUM(1,2)");
    const firstRows = await page.evaluate(({ generated, original }) => {
      const parse = xml => new DOMParser().parseFromString(xml, "application/xml");
      const headerRows = xml => [...parse(xml).getElementsByTagName("row")]
        .filter(row => Number(row.getAttribute("r")) < 9)
        .map(row => ({
          attributes: [...row.attributes].map(attr => [attr.name, attr.value]),
          cells: [...row.children].map(cell => ({
            attributes: [...cell.attributes]
              .filter(attr => cell.getAttribute("r") !== "D4" || attr.name !== "t")
              .map(attr => [attr.name, attr.value]),
            content: cell.getAttribute("r") === "D4" ? "download date" : cell.textContent
          }))
        }));
      return { generated: headerRows(generated), original: headerRows(original) };
    }, { generated: strFromU8(files[`xl/worksheets/${sheet}.xml`]), original: strFromU8(template["xl/worksheets/sheet1.xml"]) });
    expect(firstRows.generated).toEqual(firstRows.original);
  }
  const activeRows = await rows(page, files["xl/worksheets/sheet1.xml"]);
  expect(activeRows[0].map(cell => cell.value)).toEqual(headers);
  expect(activeRows[1].map(cell => cell.value)).toEqual([
    "ABC", "Alpha & <Shipping>", "Parent", "", "46023", "46388", "https://example.com",
    "Chemin Rieu", "12-14", "Building\nFloor", "001208", "Geneva",
    "Canton of Geneva", "Switzerland", "CHGVA", "Active", "46307"
  ]);
  expect(activeRows[1][10].type).toBe("inlineStr");
  expect(activeRows[1][16].type).toBeNull();
  const outdatedRows = await rows(page, files["xl/worksheets/sheet2.xml"]);
  expect(outdatedRows[0].map(cell => cell.value)).toEqual(headers);
  expect(outdatedRows.slice(1).map(row => row[0].value)).toEqual(["DEL", "EXP", "MRK"]);
  expect(outdatedRows[1].slice(2, 15).every(cell => cell.value === "")).toBe(true);
  expect(outdatedRows[1][15].value).toBe("Deleted");
  expect(strFromU8(files["xl/worksheets/sheet1.xml"])).not.toContain("DO NOT EXPORT");
});

test("empty Active/Outdated groups retain headers and invalid dates/status fail explicitly", async ({ page }) => {
  await page.goto("/liner-codes.html");
  for (const [records, emptySheet] of [
    [[active], "sheet2"], [[{ ...active, codeStatus: "Expired" }], "sheet1"]
  ]) {
    const files = await workbook(page, records);
    expect(await rows(page, files[`xl/worksheets/${emptySheet}.xml`])).toHaveLength(1);
  }
  for (const override of [{ validFrom: "2025-1010" }, { validFrom: "2025-02-30" }, { codeStatus: null }]) {
    await expect(workbook(page, [{ ...active, ...override }])).rejects.toThrow(/Invalid export date|Missing code status/);
  }
});

test("download refetches combined JSON every click and ignores the active search filters", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-20T22:30:00Z"));
  let requests = 0;
  await page.addInitScript(() => {
    window.exportFetches = [];
    const original = window.fetch;
    window.fetch = (url, options) => {
      if (String(url).endsWith("data/_combined.json")) window.exportFetches.push(options?.cache);
      return original(url, options);
    };
  });
  await page.route("**/data/_combined.json", route => {
    requests++;
    return route.fulfill({ json: [{ ...active, linerName: `Snapshot ${requests}` }, {
      ...active, linerSMDGCode: "OLD", codeStatus: "Expired"
    }] });
  });
  await page.goto("/liner-codes.html");
  await expect(page.getByLabel("Search by code", { exact: true })).toBeEnabled();
  await page.getByLabel("Search by code", { exact: true }).fill("NOTFOUND");
  for (const count of [2, 3]) {
    await page.clock.setFixedTime(new Date(count === 2 ? "2026-10-20T22:30:00Z" : "2026-10-21T22:30:00Z"));
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Excel (all codes)" }).click();
    const download = await pending;
    const day = count === 2 ? "21" : "22";
    expect(download.suggestedFilename()).toBe(`SMDG-Liner-codes-2026-10-${day}.xlsx`);
    const files = unzipSync(await readFile(await download.path()));
    for (const sheet of ["sheet1", "sheet2"]) {
      const version = await page.evaluate(xml => new DOMParser().parseFromString(xml, "application/xml")
        .querySelector('c[r="D4"]').textContent, strFromU8(files[`xl/worksheets/${sheet}.xml`]));
      expect(version).toBe(`v202610${day}`);
    }
    expect((await rows(page, files["xl/worksheets/sheet1.xml"]))[1][1].value).toBe(`Snapshot ${count}`);
    expect(await rows(page, files["xl/worksheets/sheet2.xml"])).toHaveLength(2);
    await expect(page.locator("#export-message")).toContainText("Your download is ready");
  }
  expect(requests).toBe(3);
  expect(await page.evaluate(() => window.exportFetches)).toEqual(["no-store", "no-store", "no-store"]);
});

test("failed export is visible, re-enables the button and supports retry", async ({ page }) => {
  await page.route("**/data/_combined.json", route => route.fulfill({ json: [active] }));
  await page.goto("/liner-codes.html");
  await expect(page.getByLabel("Search by code", { exact: true })).toBeEnabled();
  await page.route("**/liner-codes-template.xlsx", route => route.fulfill({ status: 503 }));
  const button = page.getByRole("button", { name: "Download Excel (all codes)" });
  await button.click();
  await expect(page.locator("#export-message")).toContainText("HTTP 503");
  await expect(button).toBeEnabled();
  await page.unroute("**/liner-codes-template.xlsx");
  const pending = page.waitForEvent("download");
  await button.click();
  await pending;
  await expect(page.locator("#export-message")).toContainText("Your download is ready");
});

test("export rejects failed or invalid fresh JSON instead of downloading the loaded snapshot", async ({ page }) => {
  await page.route("**/data/_combined.json", route => route.fulfill({ json: [active] }));
  await page.goto("/liner-codes.html");
  await expect(page.getByLabel("Search by code", { exact: true })).toBeEnabled();
  let downloads = 0;
  page.on("download", () => downloads++);
  const button = page.getByRole("button", { name: "Download Excel (all codes)" });
  await page.route("**/data/_combined.json", route => route.fulfill({ status: 503 }));
  await button.click();
  await expect(page.locator("#export-message")).toContainText("HTTP 503");
  await expect(button).toBeEnabled();
  await page.route("**/data/_combined.json", route => route.fulfill({ json: [active, active] }));
  await button.click();
  await expect(page.locator("#export-message")).toContainText("invalid or duplicate record");
  await expect(button).toBeEnabled();
  expect(downloads).toBe(0);
});

test("real dataset exports every record exactly once", async ({ page }) => {
  await page.goto("/liner-codes.html");
  const records = await page.evaluate(async () => (await fetch("/data/_combined.json")).json());
  const files = await workbook(page, records);
  const activeRows = (await rows(page, files["xl/worksheets/sheet1.xml"])).slice(1);
  const outdatedRows = (await rows(page, files["xl/worksheets/sheet2.xml"])).slice(1);
  expect(activeRows).toHaveLength(records.filter(record => record.codeStatus === "Active").length);
  expect(outdatedRows).toHaveLength(records.filter(record => record.codeStatus !== "Active").length);
  const codes = [...activeRows, ...outdatedRows].map(row => row[0].value);
  expect(new Set(codes).size).toBe(records.length);
  expect(codes.sort()).toEqual(records.map(record => record.linerSMDGCode).sort());
});
