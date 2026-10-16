import { expect, test } from "@playwright/test";

const record = {
  linerSMDGCode: "MSK", linerName: "Maersk", carrierType: "VOCC",
  website: "https://example.com", validFrom: "2020-01-01", validTo: "2030-01-01",
  remarks: "Line one\nLine two",
  addressLocation: { UnCountryCode: "DK", UnLocode: "CPH", address: {
    street: "Esplanaden", streetNumber: "50", floor: "1", postCode: "1263",
    city: "Copenhagen", state: "Capital Region", country: "Denmark"
  } }
};

async function open(page, records = [record]) {
  await page.route("**/data/_combined.json", route => route.fulfill({ json: records }));
  await page.goto("/");
  await expect(page.locator("#code")).toBeEnabled();
}

test("real bundled snapshot loads with no page errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#code")).toBeEnabled();
  await expect(page.locator("#data-status")).toContainText("codes loaded");
  await page.locator('[name="mode"][value="update"]').check();
  await page.locator("#existing-code").selectOption("ADM");
  for (const [id, value] of Object.entries({
    unLocode: "MLA", unCountryCode: "MT", street: "Santa Lucia Street",
    streetNumber: "4", postCode: "1188", city: "Valletta", country: "Malta"
  })) await expect(page.locator(`#${id}`)).toHaveValue(value);
  expect(errors).toEqual([]);
});

test("add: blank carrier, live duplicate error, maxlength and required fields", async ({ page }) => {
  await open(page);
  await expect(page.locator("#carrierType")).toHaveValue("");
  await expect(page.locator("#reason-section")).toBeHidden();
  await page.locator("#code").fill("msk");
  await expect(page.locator("#new-code-error")).toContainText("already exists");
  await expect(page.locator("#code")).toHaveAttribute("aria-invalid", "true");
  await page.locator("#code").fill("ZZZ");
  await expect(page.locator("#new-code-error")).toBeEmpty();
  for (const [id, length] of [["code", "3"], ["unLocode", "3"], ["unCountryCode", "2"]]) {
    await expect(page.locator(`#${id}`)).toHaveAttribute("maxlength", length);
  }
  await page.getByRole("button", { name: "Validate preview" }).click();
  for (const id of ["linerName", "carrierType", "street", "postCode", "city", "state", "country", "website"]) {
    await expect(page.locator(`#${id}`)).toHaveAttribute("aria-invalid", "true");
  }
  expect(await page.locator("#country option").count()).toBe(250);
});

test("official logo loads locally and red required markers follow each mode", async ({ page }) => {
  await open(page);
  const logo = page.getByRole("img", { name: "SMDG e.V." });
  await expect(logo).toHaveAttribute("src", "smdg-logo.png");
  await expect.poll(() => logo.evaluate(image => image.complete && image.naturalWidth)).toBe(400);
  for (const mode of ["add", "update", "delete"]) {
    await page.locator(`[name="mode"][value="${mode}"]`).check();
    if (mode !== "add") await page.locator("#existing-code").selectOption("MSK");
    await expect(page.locator("label").filter({ hasText: /\(required/ })).toHaveCount(0);
    const requiredLabels = page.locator("label:visible:has(+ [required])");
    await expect(requiredLabels).toHaveCount(mode === "add" ? 10 : mode === "update" ? 10 : 1);
    for (const label of await requiredLabels.all()) {
      expect(await label.evaluate(element => {
        const style = getComputedStyle(element, "::after");
        return { content: style.content, color: style.color };
      })).toEqual({ content: '" *"', color: "rgb(163, 35, 35)" });
    }
    await expect(page.locator("#validFrom")).toHaveJSProperty("required", mode === "add");
    await expect(page.locator("#reason")).toHaveJSProperty("required", mode !== "add");
  }
});

test("update: selection reveals complete prefill, reason required, clear stays in Update", async ({ page }) => {
  await open(page);
  await page.locator('[name="mode"][value="update"]').check();
  await expect(page.locator("#details")).toBeHidden();
  await page.locator("#existing-code").selectOption("MSK");
  await expect(page.locator("#linerName")).toHaveValue("Maersk");
  await expect(page.locator("#city")).toHaveValue("Copenhagen");
  await expect(page.locator("#streetNumber")).toHaveValue("50");
  await expect(page.locator("#country")).toHaveValue("Denmark");
  await expect(page.locator("#validTo")).toHaveValue("2030-01-01");
  await expect(page.locator("#remarks")).toHaveValue("Line one\nLine two");
  await expect(page.locator("#code")).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "Validate preview" }).click();
  await expect(page.locator("#reason-error")).toContainText("reason");
  await page.locator("#reason").fill("Correct the head-office details");
  await page.getByRole("button", { name: "Validate preview" }).click();
  await expect(page.locator("#validation-result")).toContainText("Preview validation passed");
  await page.getByRole("button", { name: "Clear form" }).click();
  await expect(page.locator('[value="update"][name="mode"]')).toBeChecked();
  await expect(page.locator("#details")).toBeHidden();
});

test("delete: reason/comments only, no editable company details", async ({ page }) => {
  await open(page);
  await page.locator('[name="mode"][value="delete"]').check();
  await page.locator("#existing-code").selectOption("MSK");
  await expect(page.locator("#selected-liner")).toHaveText("MSK - Maersk");
  await expect(page.locator("#company-section")).toBeHidden();
  await expect(page.locator("#address-section")).toBeHidden();
  await expect(page.locator("#reason-label")).toHaveText("Delete reason");
  await expect(page.locator("#comments-label")).toHaveText("Delete comments (optional)");
  await page.locator("#reason").fill("Preview a deletion request");
  await page.getByRole("button", { name: "Validate preview" }).click();
  await expect(page.locator("#validation-result")).toContainText("Preview validation passed");
});

for (const mode of ["add", "update", "delete"]) {
test(`valid ${mode} remains in memory only: no writes, navigation, storage or downloads`, async ({ page }) => {
  const requests = [];
  const downloads = [];
  page.on("request", request => requests.push({ method: request.method(), url: request.url() }));
  page.on("download", download => downloads.push(download));
  await open(page);
  const originalUrl = page.url();
  if (mode !== "add") {
    await page.locator(`[name="mode"][value="${mode}"]`).check();
    await page.locator("#existing-code").selectOption("MSK");
    await page.locator("#reason").fill("Test reason");
  } else {
    for (const [id, value] of Object.entries({
    code: "Z9Z", linerName: "Test liner", street: "Test Street", postCode: "00123",
    city: "Test City", state: "Test Area", website: "https://example.com", validFrom: "2025-01-01"
    })) await page.locator(`#${id}`).fill(value);
    await page.locator("#carrierType").selectOption("VOCC");
    await page.locator("#country").selectOption({ label: "Denmark" });
  }
  await page.getByRole("button", { name: "Validate preview" }).click();
  await expect(page.locator("#validation-result")).toContainText("Preview validation passed");
  expect(page.url()).toBe(originalUrl);
  expect(requests.every(request => request.method === "GET" && new URL(request.url).origin === new URL(originalUrl).origin)).toBe(true);
  expect(downloads).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookies: document.cookie })))
    .toEqual({ local: 0, session: 0, cookies: "" });
  await page.reload();
  await expect(page.locator("#code")).toHaveValue("");
});
}

test("full dropdown lists need no filter and switching modes discards previous entries", async ({ page }) => {
  await open(page, [record, { ...record, linerSMDGCode: "AAA", linerName: "Another liner" }]);
  await page.locator('[name="mode"][value="update"]').check();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.locator("#existing-code option")).toHaveCount(3);
  await expect(page.locator("#existing-name option")).toHaveCount(3);
  await page.locator("#existing-code").selectOption("MSK");
  await page.locator("#linerName").fill("Unsaved change");
  await page.locator('[name="mode"][value="add"]').check();
  await expect(page.locator("#linerName")).toHaveValue("");
  await expect(page.locator("#carrierType")).toHaveValue("");
  await page.locator('[name="mode"][value="update"]').check();
  await expect(page.locator("#existing-code")).toHaveValue("");
  await expect(page.locator("#existing-name")).toHaveValue("");
  await expect(page.locator("#details")).toBeHidden();
});

for (const mode of ["update", "delete"]) {
  for (const selection of ["existing-code", "existing-name"]) {
    test(`${mode}: selecting ${selection} loads the record and synchronizes both optional dropdowns`, async ({ page }) => {
      await open(page, [record, { ...record, linerSMDGCode: "AAA", linerName: "Another liner" }]);
      await page.locator(`[name="mode"][value="${mode}"]`).check();
      for (const id of ["existing-code", "existing-name"]) {
        await expect(page.locator(`#${id}`)).not.toHaveAttribute("required");
      }
      await expect(page.locator("#existing-code option")).toHaveText([
        "----- Select a code -----", "AAA", "MSK"
      ]);
      await expect(page.locator("#existing-name option")).toHaveText([
        "----- Select a name -----", "Another liner", "Maersk"
      ]);
      await page.locator(`#${selection}`).selectOption("MSK");
      await expect(page.locator("#existing-code")).toHaveValue("MSK");
      await expect(page.locator("#existing-name")).toHaveValue("MSK");
      await expect(page.locator("#details")).toBeVisible();
      if (mode === "update") {
        await expect(page.locator("#linerName")).toHaveValue("Maersk");
        await expect(page.locator("#city")).toHaveValue("Copenhagen");
      } else {
        await expect(page.locator("#selected-liner")).toHaveText("MSK - Maersk");
      }
      await page.locator("#reason").fill("Previous reason");
      await page.locator(`#${selection}`).selectOption("AAA");
      await expect(page.locator("#existing-code")).toHaveValue("AAA");
      await expect(page.locator("#existing-name")).toHaveValue("AAA");
      await expect(page.locator("#reason")).toHaveValue("");
      await page.locator(`#${selection}`).selectOption("");
      await expect(page.locator("#existing-code")).toHaveValue("");
      await expect(page.locator("#existing-name")).toHaveValue("");
      await expect(page.locator("#details")).toBeHidden();
      await expect(page.locator("#actions")).toBeHidden();
    });
  }
}

test("identical names remain distinct entries keyed by liner code", async ({ page }) => {
  await open(page, [record, { ...record, linerSMDGCode: "AAA", website: "https://another.example.com" }]);
  await page.locator('[name="mode"][value="update"]').check();
  await expect(page.locator("#existing-name option")).toHaveText([
    "----- Select a name -----", "Maersk", "Maersk"
  ]);
  await page.locator("#existing-name").selectOption("AAA");
  await expect(page.locator("#existing-code")).toHaveValue("AAA");
  await expect(page.locator("#website")).toHaveValue("https://another.example.com");
  await page.locator("#existing-name").selectOption("MSK");
  await expect(page.locator("#existing-code")).toHaveValue("MSK");
  await expect(page.locator("#website")).toHaveValue("https://example.com");
});

test("invalid or duplicate bundled records disable validation", async ({ page }) => {
  await page.route("**/data/_combined.json", route => route.fulfill({ json: [record, record] }));
  await page.goto("/");
  await expect(page.locator("#data-status")).toContainText("invalid or duplicate");
  await expect(page.locator("#code")).toBeDisabled();
});

test("code-list load failure disables form and offers a working retry", async ({ page }) => {
  let failed = true;
  await page.route("**/data/_combined.json", route => failed
    ? route.fulfill({ status: 503, body: "Unavailable" })
    : route.fulfill({ json: [record] }));
  await page.goto("/");
  await expect(page.locator("#form-controls")).toHaveAttribute("disabled", "");
  await expect(page.locator("#code")).toBeDisabled();
  await expect(page.locator("#data-status")).toContainText("could not be loaded");
  failed = false;
  await page.getByRole("button", { name: "Retry loading code list" }).click();
  await expect(page.locator("#code")).toBeEnabled();
});

test("legacy country is preserved and malicious liner text is not interpreted as HTML", async ({ page }) => {
  await open(page, [{ ...record, linerName: '<img src=x onerror="alert(1)">', addressLocation: {
    ...record.addressLocation, address: { ...record.addressLocation.address, country: "Legacy country spelling" }
  } }]);
  await page.locator('[name="mode"][value="update"]').check();
  await page.locator("#existing-code").selectOption("MSK");
  await expect(page.locator("#country")).toHaveValue("Legacy country spelling");
  await expect(page.locator("#linerName")).toHaveValue('<img src=x onerror="alert(1)">');
  await expect(page.locator("#request-form img")).toHaveCount(0);
});

test("mobile form fits viewport and supports keyboard selection", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  await expect(page.getByRole("heading", { name: "Liner code requests" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[name="mode"][value="update"]').focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#existing-section")).toBeVisible();
});
