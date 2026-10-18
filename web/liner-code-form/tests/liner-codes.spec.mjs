import { expect, test } from "@playwright/test";

const record = {
  linerSMDGCode: "ADM", linerName: "Admiral Container Lines", codeStatus: "Active",
  isActive: true, linerCodeVersion: "V1", carrierType: "UNKNOWN",
  parentCompany: "Parent Shipping", website: "www.example.com", address: "4 Santa Lucia Street, Malta",
  validFrom: "2017-05-09", validTo: null, remarks: "Container service",
  addressLocation: { UnCountryCode: "MT", UnLocode: "MLA", address: {
    street: "Santa Lucia Street", streetNumber: "4", postCode: "1188", city: "Valletta", country: "Malta"
  } }
};
const snapshot = [
  record,
  { ...record, linerSMDGCode: "AAA", linerName: "Zulu Shipping", codeStatus: "Expired", isActive: false },
  { linerSMDGCode: "ZZZ", linerName: "Alpha Shipping", codeStatus: "MarkedForDeletion", isActive: false }
];

async function open(page, records = snapshot) {
  await page.route("**/data/_combined.json", route => route.fulfill({ json: records }));
  await page.goto("/liner-codes.html");
  await expect(page.getByLabel("Search by code", { exact: true })).toBeEnabled();
}

test("real snapshot loads, ADM details are readable, and the request link opens Add", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/liner-codes.html");
  await expect(page.getByLabel("Search by code", { exact: true })).toBeEnabled();
  await expect(page.locator("#list-message")).toContainText("codes match");
  await expect(page.locator("#list-rows tr")).toHaveCount(25);
  await page.getByLabel("Search by code", { exact: true }).fill("  adm  ");
  await expect(page.locator("#list-rows tr")).toHaveCount(1);
  await page.getByLabel("Details for ADM", { exact: true }).click();
  const details = page.locator("#record-panel");
  await expect(page.locator("#record-title")).toBeFocused();
  await expect(page.locator("#list-rows dl")).toHaveCount(0);
  for (const text of ["Admiral Container Lines Inc. Ltd.", "Santa Lucia Street", "Valletta", "2017-05-09", "MLA", "MT"]) {
    await expect(details).toContainText(text);
  }
  await expect(details.getByRole("link")).toHaveAttribute("href", "https://www.acolines.com/");
  await page.getByRole("link", { name: "Fill a new request", exact: true }).click();
  await expect(page.locator('[name="mode"][value="add"]')).toBeChecked();
  await expect(page.locator("#code")).toBeEnabled();
  await page.getByRole("link", { name: "Browse and search the liner code list" }).click();
  await expect(page).toHaveURL(/liner-codes\.html$/);
  expect(errors).toEqual([]);
});

test("search, all status filters, name sorting and clear work together", async ({ page }) => {
  await open(page);
  await expect(page.locator("#list-rows tr")).toHaveCount(3);
  await expect(page.locator("#list-rows tr").first()).toContainText("AAA");
  await page.getByLabel("Sort by").selectOption("name");
  await expect(page.locator("#list-rows tr").first()).toContainText("ADM");
  for (const [status, code] of [["Active", "ADM"], ["Expired", "AAA"], ["MarkedForDeletion", "ZZZ"]]) {
    await page.getByLabel("Code status", { exact: true }).selectOption(status);
    await expect(page.locator("#list-rows tr")).toHaveCount(1);
    await expect(page.locator("#list-rows tr")).toContainText(code);
  }
  await page.getByRole("button", { name: "Clear filters" }).click();
  for (const query of ["shipping", "SHIp", "  shipping  "]) {
    await page.getByLabel("Search by name", { exact: true }).fill(query);
    await expect(page.locator("#list-rows tr")).toHaveCount(2);
  }
  await page.getByLabel("Search by name", { exact: true }).fill("not-a-liner");
  await expect(page.locator("#list-message")).toContainText("No codes match");
  await expect(page.locator("#list-results")).toBeHidden();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("#list-rows tr")).toHaveCount(3);
  await expect(page.getByLabel("Search by code", { exact: true })).toBeFocused();
  await page.getByLabel("Details for ZZZ", { exact: true }).click();
  await expect(page.locator("#record-panel")).toContainText("Not provided");
});

test("code and name searches are independent, field-specific and combine", async ({ page }) => {
  await open(page);
  const code = page.getByLabel("Search by code", { exact: true });
  const name = page.getByLabel("Search by name", { exact: true });
  await code.fill("a");
  await expect(page.locator("#list-rows tr")).toHaveCount(2);
  await name.fill("  zulu SHIPPING ");
  await expect(page.locator("#list-rows tr")).toHaveCount(1);
  await expect(page.locator("#list-rows")).toContainText("AAA");
  await code.fill("adm");
  await expect(page.locator("#list-results")).toBeHidden();
  await name.fill("");
  await expect(page.locator("#list-rows tr")).toHaveCount(1);
  await code.fill("Admiral");
  await expect(page.locator("#list-results")).toBeHidden();
  await code.fill("");
  for (const query of ["AAA", "Valletta", "Parent Shipping"]) {
    await name.fill(query);
    await expect(page.locator("#list-results")).toBeHidden();
  }
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(code).toHaveValue("");
  await expect(name).toHaveValue("");
  await expect(page.locator("#list-rows tr")).toHaveCount(3);
});

test("separate details panel switches records, closes and returns focus without changing the table", async ({ page }) => {
  await open(page);
  await page.getByLabel("Details for ADM", { exact: true }).click();
  await expect(page.locator("#record-panel")).toBeVisible();
  await expect(page.locator("#record-title")).toHaveText("ADM - Admiral Container Lines");
  await expect(page.locator("#list-rows tr")).toHaveCount(3);
  await expect(page.locator("#list-rows dl, #list-rows details")).toHaveCount(0);
  await page.getByLabel("Details for ZZZ", { exact: true }).click();
  await expect(page.locator("#record-title")).toHaveText("ZZZ - Alpha Shipping");
  await expect(page.locator("#record-details dl")).toHaveCount(1);
  await page.getByRole("button", { name: "Close details", exact: true }).click();
  await expect(page.locator("#record-panel")).toBeHidden();
  await expect(page.getByLabel("Details for ZZZ", { exact: true })).toBeFocused();
  await page.getByLabel("Details for ADM", { exact: true }).click();
  await page.getByLabel("Search by code", { exact: true }).fill("AAA");
  await expect(page.locator("#record-panel")).toBeHidden();
  await expect(page.locator("#record-details")).toBeEmpty();
});

test("search fields and separate details panel fit mobile screens", async ({ page }) => {
  await open(page);
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByLabel("Search by code", { exact: true }).fill("adm");
    await page.getByLabel("Search by name", { exact: true }).fill("Admiral");
    await page.getByRole("button", { name: "Details for ADM", exact: true }).click();
    await expect(page.locator("#record-title")).toBeFocused();
    await expect(page.locator("#record-panel")).toContainText("Valletta");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const panel = await page.locator("#record-panel").boundingBox();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Close details", exact: true }).click();
    await expect(page.getByRole("button", { name: "Details for ADM", exact: true })).toBeFocused();
  }
});

test("full unfiltered snapshot uses readable mobile cards and a desktop table", async ({ page }) => {
  await page.goto("/liner-codes.html");
  await expect(page.getByLabel("Search by code", { exact: true })).toBeEnabled();
  await expect(page.locator("#list-rows tr")).toHaveCount(25);
  for (const width of [320, 375, 390, 430, 640, 768, 1080]) {
    await page.setViewportSize({ width, height: 844 });
    const mobile = width <= 640;
    const rows = page.locator("#list-rows tr");
    await expect(rows.first()).toHaveCSS("display", mobile ? "grid" : "table-row");
    for (const row of await rows.all()) {
      const code = row.locator("td").first();
      const button = row.getByRole("button");
      for (const element of [code, button]) {
        const dimensions = await element.evaluate(element => {
          const style = getComputedStyle(element);
          return { height: element.clientHeight,
            oneLine: parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
            fits: element.scrollWidth <= element.clientWidth };
        });
        expect(dimensions.fits).toBe(true);
        if (mobile || element === button) {
          expect(dimensions.height).toBeLessThanOrEqual(Math.ceil(dimensions.oneLine) + 1);
        }
      }
      if (mobile) {
        await expect(row.locator("td").nth(2)).toHaveAttribute("data-label", "Country");
        await expect(row.locator("td").nth(3)).toHaveAttribute("data-label", "Status");
        const bounds = await row.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.height).toBeLessThan(360);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 375, height: 844 });
  await page.getByRole("button", { name: "Details for AAA", exact: true }).click();
  await expect(page.locator("#record-panel")).toBeVisible();
  await expect(page.locator("#record-title")).toBeFocused();
  await page.getByRole("button", { name: "Close details", exact: true }).click();
  await expect(page.getByRole("button", { name: "Details for AAA", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator("#list-page")).toContainText("Page 2");
  await expect(page.locator("#list-rows tr")).toHaveCount(25);
});

test("pagination covers every match and resets when filters change", async ({ page }) => {
  const records = Array.from({ length: 51 }, (_, index) => ({
    ...record, linerSMDGCode: `A${String(index).padStart(2, "0")}`, linerName: `Carrier ${index}`
  }));
  await open(page, records);
  await expect(page.locator("#list-page")).toHaveText("Page 1 of 3");
  await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("#list-message")).toContainText("Showing 26-50");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("#list-rows tr")).toHaveCount(1);
  await expect(page.locator("#list-rows")).toContainText("A50");
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.locator("#list-page")).toHaveText("Page 2 of 3");
  await page.getByLabel("Search by code", { exact: true }).fill("A00");
  await expect(page.locator("#list-page")).toHaveText("Page 1 of 1");
  await expect(page.locator("#list-rows")).toContainText("A00");
});

for (const failure of ["http", "json", "invalid", "duplicate"]) {
  test(`load failure (${failure}) is explicit and retry recovers`, async ({ page }) => {
    let failed = true;
    await page.route("**/data/_combined.json", route => {
      if (!failed) return route.fulfill({ json: snapshot });
      if (failure === "http") return route.fulfill({ status: 503, body: "Unavailable" });
      if (failure === "json") return route.fulfill({ contentType: "application/json", body: "{" });
      return route.fulfill({ json: failure === "invalid" ? [] : [record, record] });
    });
    await page.goto("/liner-codes.html");
    await expect(page.locator("#list-message")).toContainText("Unable to load");
    await expect(page.getByLabel("Search by code", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Search by name", { exact: true })).toBeDisabled();
    await expect(page.locator("#list-results")).toBeHidden();
    failed = false;
    await page.getByRole("button", { name: "Retry loading code list" }).click();
    await expect(page.getByLabel("Search by code", { exact: true })).toBeEnabled();
    await expect(page.locator("#list-rows tr")).toHaveCount(3);
  });
}

test("public browse never accesses local storage, writes data or renders untrusted HTML", async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ["getItem", "setItem", "removeItem", "clear"]) {
      Storage.prototype[name] = () => { throw new Error("Public list must not access browser storage"); };
    }
  });
  const errors = [];
  const writes = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await open(page, [{
    ...record, linerName: '<img src=x onerror="alert(1)">', website: "javascript:alert(1)",
    remarks: "<script>alert(1)</script>"
  }]);
  await page.getByLabel("Details for ADM", { exact: true }).click();
  await expect(page.locator("#list-rows")).toContainText('<img src=x onerror="alert(1)">');
  await expect(page.locator("#record-panel")).toContainText("<script>alert(1)</script>");
  await expect(page.locator("#record-panel img, #record-panel script, #record-panel a, #list-rows img")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});
