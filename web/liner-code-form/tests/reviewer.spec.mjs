import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const key = "smdg-liner-workflow-demo-v1";
const record = {
  linerSMDGCode: "MSK", linerName: "Example Carrier", carrierType: "VOCC",
  website: "www.example.com", validFrom: "2020-01-01", validTo: "",
  remarks: "Existing remarks", addressLocation: { UnCountryCode: "DK", UnLocode: "CPH",
    address: { street: "Example Street", streetNumber: "10", floor: "",
      postCode: "1000", city: "Example City", state: "Example Region", country: "Denmark" } }
};
const snapshot = [record, { ...record, linerSMDGCode: "AAA", linerName: "Another Carrier" }];

async function route(page) {
  await page.route("**/data/_combined.json", route => route.fulfill({ json: snapshot }));
}
async function signIn(page) {
  await page.getByLabel("Demo username").fill("linercodelists");
  await page.getByLabel("Demo password").fill("SMDGLCL2026");
  await page.getByRole("button", { name: "Sign in to demo" }).click();
  await expect(page.locator("#workspace")).toBeVisible();
}
async function open(page, mode = "add") {
  await page.locator(`.task-card[data-mode="${mode}"]`).first().getByRole("button").click();
  await expect(page.locator("#detail-step")).toBeVisible();
}
async function assign(page, name = "Javier Moral") {
  await page.getByLabel("Assigned to", { exact: true }).selectOption(name);
  await page.getByRole("button", { name: "Save assignment" }).click();
  await expect(page.locator("#workspace-status")).toContainText("assignment saved");
}
async function confirm(page) {
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator("#confirm-dialog")).not.toBeVisible();
}
async function workspace(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
}
async function contact(page) {
  await page.locator("#contactName").fill("Fictional Contact");
  await page.locator("#contactEmail").fill("fictional@example.com");
}
async function submit(page) {
  await page.getByRole("button", { name: "Review request", exact: true }).click();
  await expect(page.locator("#review-step")).toBeVisible();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator("#demo-confirmation")).toBeVisible();
}
async function reviewLatest(page) {
  await page.goto("/reviewer.html");
  await signIn(page);
  await page.locator(".task-card").first().getByRole("button").click();
  await expect(page.locator("#detail-step")).toBeVisible();
}

test("real bundled snapshot initializes full request cards without errors", async ({ page }) => {
  const errors = [];
  const writes = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.method() !== "GET") writes.push(request.url()); });
  await page.goto("/reviewer.html");
  await signIn(page);
  await expect(page.locator(".task-card")).toHaveCount(3);
  await expect(page.locator("#profile-step")).toHaveCount(0);
  await open(page, "update");
  await expect(page.locator("#request-info")).toContainText("requester@example.com");
  await expect(page.locator("#comparison-body tr")).toHaveCount(17);
  await expect(page.locator("#edit-linerName")).toBeDisabled();
  await assign(page);
  await expect(page.locator("#edit-linerName")).toBeEnabled();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("shared login rejects bad credentials and opens all cards directly", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await page.getByRole("button", { name: "Sign in to demo" }).click();
  await expect(page.locator("#login-error")).toContainText("incorrect");
  await page.getByLabel("Demo username").fill("linercodelists");
  await page.getByLabel("Demo password").fill("wrong");
  await page.getByRole("button", { name: "Sign in to demo" }).click();
  await expect(page.getByLabel("Demo password")).toHaveValue("");
  await expect(page.locator("#workspace")).toBeHidden();
  await signIn(page);
  await expect(page.locator(".task-card")).toHaveCount(3);
  await expect(page.locator("#tasks-step")).toBeFocused();
  expect((await workspace(page)).requests.every(request => request.assignee === "")).toBe(true);
});

test("Add has a proposal only, Update has comparisons, and Delete shows record details only", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page, "add");
  await expect(page.locator("#proposal-section")).toBeVisible();
  await expect(page.locator("#comparison-section")).toBeHidden();
  await expect(page.locator("#comparison-body")).toBeEmpty();
  await expect(page.locator("#deletion-section")).toBeHidden();
  await expect(page.getByRole("columnheader", { name: "Current demo list", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to all tasks" }).click();
  await open(page, "update");
  await expect(page.locator("#proposal-section")).toBeVisible();
  await expect(page.locator("#comparison-section")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Current demo list", exact: true })).toBeVisible();
  await expect(page.locator("#deletion-section")).toBeHidden();
  await page.getByRole("button", { name: "Back to all tasks" }).click();
  await open(page, "delete");
  await expect(page.locator("#proposal-section")).toBeHidden();
  await expect(page.locator("#comparison-section")).toBeHidden();
  await expect(page.locator("#editor-fields")).toBeEmpty();
  await expect(page.locator("#comparison-body")).toBeEmpty();
  await expect(page.locator("#deletion-section")).toBeVisible();
  await expect(page.locator("#deletion-record dt")).toHaveCount(17);
  await expect(page.locator("#deletion-record")).toContainText("AAA");
  await expect(page.locator("#deletion-record")).toContainText("Another Carrier");
  await expect(page.locator("#deletion-record")).toContainText("Example Street");
  await expect(page.locator("#deletion-record")).not.toContainText("requester@example.com");
  await assign(page);
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await expect(page.locator("#confirm-body")).toContainText("Another Carrier");
  await confirm(page);
  await expect(page.locator("#deletion-record")).toContainText("Another Carrier");
  await expect(page.locator("#deletion-help")).toContainText("request was closed");
});

test("missing deletion record shows a labelled baseline and can still be rejected", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await page.evaluate(async () => {
    const { DemoStore } = await import("/workflow.js");
    const store = new DemoStore();
    const current = store.read();
    await store.update(current.id, workspace => {
      const request = workspace.requests.find(request => request.mode === "delete");
      workspace.records = workspace.records.filter(record => record.linerSMDGCode !== request.proposal.code);
    });
  });
  await open(page, "delete");
  await expect(page.locator("#deletion-help")).toContainText("no longer in the demo list");
  await expect(page.locator("#deletion-record")).toContainText("Another Carrier");
  await expect(page.locator("#conflict-notice")).toContainText("removed");
  await assign(page);
  await page.getByLabel("Reviewer note / decision reason").fill("The record has already been removed.");
  await page.getByRole("button", { name: "Reject request", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#request-heading")).toContainText("Rejected");
});

test("all five assignees, filters, unassignment and refresh persistence work", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page);
  expect(await page.locator("#task-assignee option").allTextContents()).toEqual([
    "Unassigned", "Javier Moral", "Thalke Diepenbrock", "Mark Lim", "Jasmin Dronner", "Anna Eder"
  ]);
  await assign(page, "Anna Eder");
  await page.getByRole("button", { name: "Back to all tasks" }).click();
  await page.getByLabel("Assignee", { exact: true }).selectOption("Anna Eder");
  await expect(page.locator(".task-card")).toHaveCount(1);
  await page.getByLabel("Status", { exact: true }).selectOption("Under review");
  await expect(page.locator(".task-card")).toHaveCount(1);
  await page.getByLabel("Search requests").fill("not-present");
  await expect(page.locator("#no-tasks")).toBeVisible();
  await page.getByLabel("Search requests").fill("");
  await page.reload();
  await expect(page.locator("#login-step")).toBeVisible();
  await signIn(page);
  await open(page);
  await expect(page.getByLabel("Assigned to", { exact: true })).toHaveValue("Anna Eder");
  await assign(page, "");
  await expect(page.locator("#edit-linerName")).toBeDisabled();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("#login-step")).toBeVisible();
  expect((await workspace(page)).requests.find(request => request.mode === "add").assignee).toBe("");
});

test("form Add, reviewer direct publish, then form Update and Delete affect only demo list", async ({ page }) => {
  await route(page);
  await page.goto("/");
  await expect(page.locator("#code")).toBeEnabled();
  await expect(page.locator("#contact-help")).toContainText("saved in this browser");
  for (const [id, value] of Object.entries({
    code: "Z9Z", linerName: "Fictional Shipping", website: "www.example.com",
    street: "Test Street", postCode: "1000", city: "Test City", state: "Test Area", validFrom: "2026-01-01"
  })) await page.locator(`#${id}`).fill(value);
  await page.locator("#carrierType").selectOption("NVOCC");
  await page.locator("#country").selectOption("Denmark");
  await contact(page);
  await page.getByRole("button", { name: "Review request", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("#city")).toHaveValue("Test City");
  await submit(page);
  await reviewLatest(page);
  await assign(page);
  await page.getByLabel("City", { exact: true }).fill("Agreed City");
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await expect(page.locator("#confirm-body")).toContainText("Agreed City");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Agreed City");
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#workspace-status")).toContainText("published to the demo list only");
  let saved = await workspace(page);
  let added = saved.records.find(record => record.linerSMDGCode === "Z9Z");
  expect(added.addressLocation.address.city).toBe("Agreed City");
  expect(JSON.stringify(added)).not.toContain("fictional@example.com");
  const request = saved.requests.find(request => request.proposal.code === "Z9Z");
  expect(request.submitted.city).toBe("Test City");
  expect(request.status).toBe("Published - demo");
  await expect(page.getByRole("button", { name: "Approve and publish - demo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Demo code list", exact: true }).click();
  await page.getByLabel("Search codes or liner names").fill("Z9Z");
  await page.locator("#demo-records summary").click();
  await expect(page.locator("#demo-records")).toContainText("Agreed City");
  for (const mode of ["update", "delete"]) {
    await page.goto("/");
    await expect(page.locator("#code")).toBeEnabled();
    await page.locator(`[name=mode][value=${mode}]`).check();
    await page.locator("#existing-code").selectOption("Z9Z");
    await page.locator("#reason").fill(`Demo ${mode} reason`);
    if (mode === "update") {
      await expect(page.locator("#city")).toHaveValue("Agreed City");
      await page.locator("#city").fill("Final City");
    }
    await contact(page);
    await submit(page);
    await reviewLatest(page);
    await assign(page, "Mark Lim");
    await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
    await confirm(page);
    await expect(page.locator("#workspace-status")).toContainText("published");
    saved = await workspace(page);
    added = saved.records.find(record => record.linerSMDGCode === "Z9Z");
    if (mode === "update") expect(added.addressLocation.address.city).toBe("Final City");
    else expect(added).toBeUndefined();
  }
  expect((await workspace(page)).requests.filter(request => request.proposal.code === "Z9Z")).toHaveLength(3);
});

test("clarification, notes, draft, resume and rejection keep history without dataset changes", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  const original = (await workspace(page)).records;
  await open(page, "update");
  await assign(page, "Thalke Diepenbrock");
  await page.getByLabel("City", { exact: true }).fill("Draft City");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator("#request-history")).toContainText("Draft saved");
  await page.getByRole("button", { name: "Needs information", exact: true }).click();
  await expect(page.locator("#detail-error")).toContainText("note or decision reason");
  await page.getByLabel("Reviewer note / decision reason").fill("Confirm street number.");
  await page.getByRole("button", { name: "Needs information", exact: true }).click();
  await expect(page.locator("#request-history")).toContainText("No email sent");
  await expect(page.locator("#request-heading")).toContainText("Needs information");
  await page.getByLabel("Reviewer note / decision reason").fill("Confirmed in a demo phone call.");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(page.locator("#request-history")).toContainText("Confirmed in a demo phone call.");
  await page.getByRole("button", { name: "Resume review", exact: true }).click();
  await expect(page.locator("#request-heading")).toContainText("Under review");
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Draft City");
  await page.getByLabel("Reviewer note / decision reason").fill("Duplicate request confirmed.");
  await page.getByRole("button", { name: "Reject request", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#request-heading")).toContainText("Rejected");
  expect((await workspace(page)).records).toEqual(original);
  await expect(page.locator("#request-history")).toContainText("Duplicate request confirmed.");
  await expect(page.getByLabel("Assigned to", { exact: true })).toBeDisabled();
});

test("invalid proposal cannot publish and unsaved edits can be kept or discarded", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page);
  await assign(page);
  await page.getByLabel("Website", { exact: true }).fill("");
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await expect(page.locator("#detail-error")).toContainText("Website is required");
  await page.getByRole("button", { name: "Back to all tasks" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Website", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Back to all tasks" }).click();
  await confirm(page);
  await open(page);
  await expect(page.getByLabel("Website", { exact: true })).toHaveValue("www.example.com");
});

test("concurrent tabs cannot overwrite a stale request version", async ({ page, context }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page);
  await assign(page);
  const other = await context.newPage();
  await route(other);
  await other.goto("/reviewer.html");
  await signIn(other);
  await open(other);
  await assign(other, "Anna Eder");
  await page.getByLabel("City", { exact: true }).fill("Stale draft");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator("#detail-error")).toContainText("request changed");
  expect((await workspace(other)).requests.find(request => request.mode === "add").proposal.city).not.toBe("Stale draft");
  await other.close();
});

test("changed record blocks publication until compared and explicitly rebased", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page, "update");
  await assign(page);
  await page.evaluate(async () => {
    const { DemoStore } = await import("/workflow.js");
    const store = new DemoStore();
    const current = store.read();
    await store.update(current.id, workspace => { workspace.records[0].linerName = "Changed in another review"; });
  });
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#detail-error")).toContainText("changed after");
  await page.getByRole("button", { name: "Back to all tasks" }).click();
  await open(page, "update");
  await expect(page.locator("#conflict-notice")).toContainText("changed after");
  await page.getByLabel("Reviewer note / decision reason").fill("Compared values; use the agreed proposal.");
  await page.getByRole("button", { name: "Acknowledge current baseline" }).click();
  await confirm(page);
  await expect(page.locator("#conflict-notice")).toBeHidden();
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#request-heading")).toContainText("Published - demo");
});

test("workspace export, reset, validated import and public-list export work", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page);
  await assign(page);
  await page.getByRole("button", { name: "Workspace tools" }).click();
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await confirm(page);
  const exported = JSON.parse(await readFile(await (await downloadPromise).path(), "utf8"));
  expect(exported.requests.some(request => request.assignee === "Javier Moral")).toBe(true);
  await page.getByRole("button", { name: "Reset workspace", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await workspace(page)).id).toBe(exported.id);
  await page.getByRole("button", { name: "Reset workspace", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#workspace-status")).toContainText("Workspace reset");
  expect((await workspace(page)).requests.every(request => !request.assignee)).toBe(true);
  await page.locator("#import-workspace").setInputFiles({
    name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"schema":99}')
  });
  await expect(page.locator("#workspace-error")).toContainText("Invalid or unsupported");
  await page.locator("#import-workspace").setInputFiles({
    name: "workspace.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported))
  });
  await confirm(page);
  await expect(page.locator("#workspace-status")).toContainText("Workspace imported");
  expect((await workspace(page)).requests.some(request => request.assignee === "Javier Moral")).toBe(true);
  await page.getByRole("button", { name: "Demo code list", exact: true }).click();
  const publicDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download demo list JSON" }).click();
  const publicRecords = JSON.parse(await readFile(await (await publicDownload).path(), "utf8"));
  expect(JSON.stringify(publicRecords)).not.toContain("requester@example.com");
  expect(publicRecords).toHaveLength(2);
});

test("blocked storage fails explicitly and leaves the preview usable", async ({ page }) => {
  await route(page);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error("Demo storage blocked"); };
  });
  await page.goto("/?preview=1");
  await expect(page.locator("#code")).toBeEnabled();
  await page.goto("/reviewer.html");
  await page.getByLabel("Demo username").fill("linercodelists");
  await page.getByLabel("Demo password").fill("SMDGLCL2026");
  await page.getByRole("button", { name: "Sign in to demo" }).click();
  await expect(page.locator("#workspace-error")).toContainText("Demo storage blocked");
  await expect(page.locator("#workspace")).toBeHidden();
});

test("quota failure on submission preserves the form instead of showing success", async ({ page }) => {
  await route(page);
  await page.goto("/");
  await expect(page.locator("#code")).toBeEnabled();
  await page.locator('[name=mode][value=delete]').check();
  await page.locator("#existing-code").selectOption("MSK");
  await page.locator("#reason").fill("Fictional delete request");
  await contact(page);
  await page.getByRole("button", { name: "Review request", exact: true }).click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new Error("Quota exceeded"); };
  });
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator("#submit-result")).toContainText("not saved: Quota exceeded");
  await expect(page.locator("#demo-confirmation")).toBeHidden();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("#contactEmail")).toHaveValue("fictional@example.com");
});

test("stale form keeps entries and can refresh current values before reviewing again", async ({ page }) => {
  await route(page);
  await page.goto("/");
  await expect(page.locator("#code")).toBeEnabled();
  await page.locator('[name=mode][value=update]').check();
  await page.locator("#existing-code").selectOption("MSK");
  await page.locator("#reason").fill("Fictional update");
  await page.locator("#city").fill("Requested City");
  await contact(page);
  await page.getByRole("button", { name: "Review request", exact: true }).click();
  await page.evaluate(async () => {
    const { DemoStore } = await import("/workflow.js");
    const store = new DemoStore();
    const current = store.read();
    await store.update(current.id, workspace => {
      workspace.records.find(record => record.linerSMDGCode === "MSK").addressLocation.address.city = "New Current City";
    });
  });
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator("#submit-result")).toContainText("changed while you filled out");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Refresh demo list without clearing entries" }).click();
  await expect(page.locator("#city")).toHaveValue("Requested City");
  await expect(page.locator("#contactEmail")).toHaveValue("fictional@example.com");
  await page.getByRole("button", { name: "Review request", exact: true }).click();
  await expect(page.locator("#review-summary")).toContainText("Previously: New Current City");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator("#demo-confirmation")).toBeVisible();
});

test("failed reviewer saves retain edits, assignment changes and saved state", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page);
  await assign(page);
  await page.getByLabel("City", { exact: true }).fill("Unsaved City");
  await page.getByLabel("Assigned to", { exact: true }).selectOption("Anna Eder");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator("#detail-error")).toContainText("Save the changed assignment");
  await page.getByRole("button", { name: "Save assignment" }).click();
  await expect(page.locator("#request-history")).toContainText("Anna Eder");
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Unsaved City");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new Error("Write denied"); };
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator("#detail-error")).toContainText("Write denied");
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Unsaved City");
  const stored = (await workspace(page)).requests.find(request => request.mode === "add");
  expect(stored.proposal.city).not.toBe("Unsaved City");
  expect(stored.assignee).toBe("Anna Eder");
});

test("mobile cards, detail editor, dialog and demo list fit the viewport", async ({ page }) => {
  await route(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/reviewer.html");
  await signIn(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await open(page, "update");
  await assign(page);
  for (const id of ["edit-validFrom", "edit-validTo", "edit-city", "task-assignee"]) {
    const bounds = await page.locator(`#${id}`).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Demo code list", exact: true }).click();
  await page.locator("#demo-records summary").first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("delete request cancellation keeps edits and confirmed deletion persists without changing codes", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  const original = await workspace(page);
  await open(page);
  await assign(page);
  await page.getByLabel("City", { exact: true }).fill("Unsaved deletion test");
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await expect(page.locator("#confirm-body")).toContainText("does not undo publication");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Unsaved deletion test");
  expect((await workspace(page)).requests).toHaveLength(3);
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#workspace-status")).toContainText("deleted from this browser");
  await expect(page.locator(".task-card")).toHaveCount(2);
  expect((await workspace(page)).records).toEqual(original.records);
  await page.reload();
  await signIn(page);
  await expect(page.locator(".task-card")).toHaveCount(2);
});

test("failed and stale deletions do not remove requests", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page);
  await page.evaluate(async () => {
    const { DemoStore, actOnRequest } = await import("/workflow.js");
    const store = new DemoStore();
    const current = store.read();
    await store.update(current.id, workspace => {
      const request = workspace.requests.find(request => request.mode === "add");
      actOnRequest(workspace, request.id, request.version, "assign", { assignee: "Anna Eder" });
    });
  });
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#detail-error")).toContainText("request changed");
  expect((await workspace(page)).requests).toHaveLength(3);
  await page.getByRole("button", { name: "Back to all tasks" }).click();
  await open(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new Error("Deletion storage denied"); };
  });
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#detail-error")).toContainText("Deletion storage denied");
  expect((await workspace(page)).requests).toHaveLength(3);
});

test("standalone pages have no cross-navigation but share submitted requests", async ({ page }) => {
  await route(page);
  await page.goto("/");
  await expect(page.locator('a[href*="reviewer"]')).toHaveCount(0);
  await expect(page.locator("#code")).toBeEnabled();
  await expect(page.locator("#workflow-demo")).toHaveCount(0);
  await expect(page.locator("#contact-help")).toContainText("saved in this browser");
  await page.locator('[name=mode][value=delete]').check();
  await page.locator("#existing-code").selectOption("MSK");
  await page.locator("#reason").fill("Request from the connected form");
  await contact(page);
  const before = (await workspace(page)).requests.length;
  await page.getByRole("button", { name: "Review request", exact: true }).click();
  await expect(page.locator("#review-step")).toBeVisible();
  expect((await workspace(page)).requests).toHaveLength(before);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator("#demo-confirmation")).toBeVisible();
  expect((await workspace(page)).requests).toHaveLength(before + 1);
  await expect(page.locator('a[href*="reviewer"]')).toHaveCount(0);
  await reviewLatest(page);
  await expect(page.locator('a[href="./"], a[href*="?demo=1"]')).toHaveCount(0);
  await expect(page.locator("#request-info")).toContainText("Request from the connected form");
  await expect(page.locator("#request-info")).toContainText("fictional@example.com");
  await page.getByRole("button", { name: "Back to all tasks" }).click();
  await expect(page.locator(".task-card")).toHaveCount(4);
});

test("mobile website shortcuts and read-only website/email links use explicit safe destinations", async ({ page }) => {
  await route(page);
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/");
  await expect(page.locator("#code")).toBeEnabled();
  await page.locator('[name=mode][value=update]').check();
  await page.locator("#existing-code").selectOption("MSK");
  await expect(page.getByRole("link", { name: "Open website (new tab)", exact: true })).toHaveAttribute("href", "https://www.example.com/");
  await page.locator("#website").fill("javascript:alert(1)");
  await expect(page.getByRole("link", { name: "Open website (new tab)", exact: true })).toHaveCount(0);
  await page.locator("#website").fill("www.example.com/new");
  await page.locator("#reason").fill("Demo website correction");
  await contact(page);
  await page.getByRole("button", { name: "Review request", exact: true }).click();
  const summaryLink = page.locator("#review-summary a").filter({ hasText: "www.example.com/new" });
  await expect(summaryLink).toHaveAttribute("href", "https://www.example.com/new");
  await expect(summaryLink).toHaveAttribute("target", "_blank");
  await expect(summaryLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator('#review-summary a[href^="mailto:"]')).toHaveText("fictional@example.com");
  const subject = "SMDG Liner Code Request - MSK - Example Carrier";
  const expectedMail = `mailto:fictional%40example.com?subject=${encodeURIComponent(subject)}`;
  await expect(page.locator('#review-summary a[href^="mailto:"]')).toHaveAttribute("href", expectedMail);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator("#demo-confirmation")).toBeVisible();
  await reviewLatest(page);
  await expect(page.locator('#request-info a[href^="mailto:"]')).toHaveText("fictional@example.com");
  await expect(page.locator('#request-info a[href^="mailto:"]')).toHaveAttribute("href", expectedMail);
  await assign(page);
  const shortcut = page.getByRole("link", { name: "Open website (new tab)", exact: true });
  await expect(shortcut).toHaveAttribute("href", "https://www.example.com/new");
  await page.getByLabel("Website", { exact: true }).fill("https://example.com/reviewer");
  await expect(shortcut).toHaveAttribute("href", "https://example.com/reviewer");
  await expect(page.locator('#comparison-body a[href="https://example.com/reviewer"]')).toBeVisible();
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await expect(page.locator('#confirm-body a[href="https://example.com/reviewer"]')).toBeVisible();
  await confirm(page);
  await page.getByRole("button", { name: "Demo code list", exact: true }).click();
  await page.getByLabel("Search codes or liner names").fill("MSK");
  await page.locator("#demo-records summary").click();
  await expect(page.locator('#demo-records a[href="https://example.com/reviewer"]')).toBeVisible();
  const records = (await workspace(page)).records;
  expect(records.find(record => record.linerSMDGCode === "MSK").website).toBe("https://example.com/reviewer");
});
