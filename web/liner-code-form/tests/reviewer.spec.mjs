import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const key = "smdg-liner-workflow-demo-v1";
const record = {
  linerSMDGCode: "MSK", linerName: "Example Carrier", carrierType: "VOCC", codeStatus: "Active",
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
async function confirm(page, name = "Confirm") {
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.getByRole("button", { name, exact: true }).click();
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

async function editCurrent(page) {
  await route(page);
  await page.goto("/reviewer.html");
  await expect(page.getByRole("button", { name: "Edit current data", exact: true })).toBeHidden();
  await signIn(page);
  await page.getByRole("button", { name: "Edit current data", exact: true }).click();
  await page.getByLabel("Search current data by code or liner name").fill("MSK");
  await expect(page.locator("#direct-records article")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit MSK", exact: true }).click();
}

test("reviewer edits current data directly with comparison, confirmation, history and persistence", async ({ page }) => {
  await editCurrent(page);
  const original = await workspace(page);
  await expect(page.locator("#show-direct")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#direct-code")).toHaveAttribute("readonly", "");
  await expect(page.locator("#direct-linerName")).toHaveValue(record.linerName);
  await page.locator("#direct-linerName").fill("Corrected Carrier");
  await page.locator("#direct-codeStatus").selectOption("Expired");
  await expect(page.locator("#direct-comparison tr")).toHaveCount(2);
  await expect(page.locator("#direct-comparison")).toContainText("Corrected Carrier");
  await page.locator("#direct-reviewer").selectOption("Javier Moral");
  await page.locator("#direct-reason").fill("Confirmed directly with the carrier");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.locator("#confirm-dialog")).toContainText("Example Carrier -> Corrected Carrier");
  expect((await workspace(page)).records).toEqual(original.records);
  await confirm(page, "Publish to demo list");
  await expect(page.locator("#workspace-status")).toContainText("MSK published to the demo list");
  const updated = await workspace(page);
  expect(updated.records.find(item => item.linerSMDGCode === "MSK")).toMatchObject({
    linerName: "Corrected Carrier", codeStatus: "Expired", isActive: false
  });
  expect(updated.requests).toEqual(original.requests);
  expect(updated.directEdits).toHaveLength(1);
  await expect(page.locator("#direct-history")).toContainText("Javier Moral");
  await expect(page.locator("#direct-history")).toContainText("Confirmed directly with the carrier");
  await page.reload();
  await signIn(page);
  await page.getByRole("button", { name: "Edit current data", exact: true }).click();
  await page.getByRole("button", { name: "Edit MSK", exact: true }).click();
  await expect(page.locator("#direct-linerName")).toHaveValue("Corrected Carrier");
  await expect(page.locator("#direct-history li")).toHaveCount(1);
  await page.getByRole("button", { name: "Demo code list", exact: true }).click();
  await expect(page.locator("#demo-records")).toContainText("Corrected Carrier");
  await page.goto("/liner-codes.html");
  await expect(page.locator("body")).not.toContainText("Corrected Carrier");
});

test("direct editor validates reviewer, reason, values and no-op edits; cancellation retains input", async ({ page }) => {
  await editCurrent(page);
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.locator("#direct-error")).toContainText("reviewer");
  await page.locator("#direct-reviewer").selectOption("Javier Moral");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.locator("#direct-error")).toContainText("reason");
  await page.locator("#direct-reason").fill("Reason");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.locator("#direct-error")).toContainText("no changes");
  await page.locator("#direct-website").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await expect(page.locator("#direct-error")).toContainText("website address");
  await page.locator("#direct-website").fill("https://example.org");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#direct-website")).toHaveValue("https://example.org");
  expect((await workspace(page)).directEdits).toHaveLength(0);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator("#confirm-dialog")).toContainText("unsaved");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#direct-editor")).toBeVisible();
  await page.getByRole("button", { name: "Cancel editing", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#direct-picker")).toBeVisible();
  expect((await workspace(page)).directEdits).toHaveLength(0);
});

test("direct publishing rechecks concurrent changes after confirmation and reload requires discard", async ({ page }) => {
  await editCurrent(page);
  await page.locator("#direct-reviewer").selectOption("Javier Moral");
  await page.locator("#direct-city").fill("Reviewer City");
  await page.locator("#direct-reason").fill("Correction");
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await page.evaluate(key => {
    const current = JSON.parse(localStorage.getItem(key));
    current.records.find(record => record.linerSMDGCode === "MSK").linerName = "Concurrent name";
    localStorage.setItem(key, JSON.stringify(current));
  }, key);
  await confirm(page, "Publish to demo list");
  await expect(page.locator("#direct-error")).toContainText("changed or was removed");
  await expect(page.locator("#direct-city")).toHaveValue("Reviewer City");
  expect((await workspace(page)).directEdits).toHaveLength(0);
  await page.getByRole("button", { name: "Reload current record", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#direct-linerName")).toHaveValue("Concurrent name");
  await expect(page.locator("#direct-city")).toHaveValue(record.addressLocation.address.city);
});

test("direct publish storage failures retain values and do not create successful history", async ({ page }) => {
  await editCurrent(page);
  await page.locator("#direct-reviewer").selectOption("Javier Moral");
  await page.locator("#direct-city").fill("Reviewer City");
  await page.locator("#direct-reason").fill("Correction");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("Storage is full"); }; });
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  await confirm(page, "Publish to demo list");
  await expect(page.locator("#direct-error")).toContainText("Storage is full");
  await expect(page.locator("#direct-city")).toHaveValue("Reviewer City");
  expect((await workspace(page)).directEdits).toHaveLength(0);
  expect((await workspace(page)).records.find(record => record.linerSMDGCode === "MSK").addressLocation.address.city)
    .toBe(record.addressLocation.address.city);
});

test("direct edit tab supports mobile search, empty results and sign-out cleanup", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await editCurrent(page);
  await expect(page.locator("#direct-fields fieldset")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Cancel editing", exact: true }).click();
  await page.getByLabel("Search current data by code or liner name").fill("No such carrier");
  await expect(page.locator("#direct-count")).toContainText("0 matching codes");
  await expect(page.locator("#direct-previous")).toBeDisabled();
  await expect(page.locator("#direct-next")).toBeDisabled();
  await page.getByLabel("Search current data by code or liner name").fill("another carrier");
  await expect(page.locator("#direct-records article")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit AAA", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("#workspace")).toBeHidden();
  await expect(page.locator("#direct-fields")).toBeEmpty();
  await expect(page.locator("#direct-history")).toBeEmpty();
});

test("workspace navigation highlights only the current view, including request details", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  async function highlighted(id) {
    await expect(page.locator('.workspace-nav [aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator(`#${id}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(`#${id}`)).toHaveCSS("background-color", "rgb(36, 75, 120)");
    await expect(page.locator(`#${id}`)).toHaveCSS("color", "rgb(255, 255, 255)");
    for (const other of ["show-tasks", "show-archive", "show-direct", "show-list", "reviewer-sign-out"].filter(value => value !== id)) {
      await expect(page.locator(`#${other}`)).toHaveCSS("background-color", "rgb(255, 255, 255)");
    }
  }
  await highlighted("show-tasks");
  await expect(page.locator(".unassigned-label")).toHaveCount(3);
  await expect(page.locator(".unassigned-label").first()).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator(".task-card").first()).toHaveCSS("color", "rgb(52, 59, 66)");
  await open(page);
  await highlighted("show-tasks");
  await assign(page);
  await page.getByLabel("City", { exact: true }).fill("Unsaved tab test");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await highlighted("show-tasks");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await confirm(page);
  await highlighted("show-archive");
  await page.getByRole("button", { name: "Demo code list", exact: true }).click();
  await highlighted("show-list");
  await page.getByRole("button", { name: "Active tasks", exact: true }).click();
  await highlighted("show-tasks");
});

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
  await expect(page.locator("#login-step")).not.toContainText("linercodelists");
  await expect(page.locator("#login-step")).not.toContainText("SMDGLCL2026");
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
  await page.getByRole("button", { name: "Back to active tasks" }).click();
  await open(page, "update");
  await expect(page.locator("#proposal-section")).toBeVisible();
  await expect(page.locator("#comparison-section")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Current demo list", exact: true })).toBeVisible();
  await expect(page.locator("#deletion-section")).toBeHidden();
  await page.getByRole("button", { name: "Back to active tasks" }).click();
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
  await page.getByRole("button", { name: "Back to active tasks" }).click();
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
  await page.getByRole("button", { name: "Active tasks", exact: true }).click();
  await expect(page.locator(".task-card")).toHaveCount(3);
  await expect(page.locator("#task-list")).not.toContainText("Z9Z");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator(".task-card")).toHaveCount(3);
  for (const mode of ["add", "update", "delete"]) {
    await expect(page.locator(`.task-card[data-mode="${mode}"]`)).toContainText("Z9Z");
  }
  await open(page, "add");
  await expect(page.getByRole("button", { name: "Approve and publish - demo", exact: true })).toBeDisabled();
  await expect(page.locator("#request-history")).toContainText("Published");
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
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#detail-step")).toBeVisible();
  await expect(page.getByLabel("Website", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Back to active tasks" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Website", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Back to active tasks" }).click();
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
  await page.getByRole("button", { name: "Back to active tasks" }).click();
  await open(page, "update");
  await expect(page.locator("#conflict-notice")).toContainText("changed after");
  await page.getByLabel("Reviewer note / decision reason").fill("Compared values; use the agreed proposal.");
  await page.getByRole("button", { name: "Acknowledge current baseline" }).click();
  await confirm(page);
  await expect(page.locator("#conflict-notice")).toBeHidden();
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#request-heading")).toContainText("Published - demo");
  await expect(page.locator("#request-heading .status-badge")).toHaveCSS("color", "rgb(23, 107, 53)");
});

test("workspace tools are removed and public-list export still works", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await expect(page.getByRole("button", { name: "Workspace tools" })).toHaveCount(0);
  await expect(page.locator("#tools-step, #export-workspace, #import-workspace, #reset-workspace")).toHaveCount(0);
  await page.getByRole("button", { name: "Demo code list", exact: true }).click();
  const publicDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download demo list JSON" }).click();
  const publicRecords = JSON.parse(await readFile(await (await publicDownload).path(), "utf8"));
  expect(JSON.stringify(publicRecords)).not.toContain("requester@example.com");
  expect(publicRecords).toHaveLength(2);
});

test("closed requests move to a searchable archive and retain details after refresh", async ({ page }) => {
  await route(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/reviewer.html");
  await signIn(page);
  await expect(page.locator("#status-filter option")).toHaveText([
    "All statuses", "Pending review", "Under review", "Needs information"
  ]);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator("#tasks-step")).toBeFocused();
  await expect(page.locator("#no-tasks")).toBeVisible();
  await expect(page.locator(".task-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Active tasks", exact: true }).click();
  await open(page, "add");
  await assign(page);
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await confirm(page);
  await expect(page.locator("#request-heading")).toContainText("Published - demo");
  await page.getByRole("button", { name: "Back to active tasks" }).click();
  await expect(page.locator(".task-card")).toHaveCount(2);
  await expect(page.locator('.task-card[data-mode="add"]')).toHaveCount(0);
  await open(page, "update");
  await assign(page, "Anna Eder");
  await page.getByLabel("Reviewer note / decision reason").fill("Archived rejection reason.");
  await page.getByRole("button", { name: "Reject request", exact: true }).click();
  await confirm(page);
  await page.getByRole("button", { name: "Back to active tasks" }).click();
  await expect(page.locator(".task-card")).toHaveCount(1);
  await expect(page.locator("#task-counts")).not.toContainText("Rejected");
  await open(page, "delete");
  await assign(page);
  await page.getByLabel("Reviewer note / decision reason").fill("Waiting for confirmation.");
  await page.getByRole("button", { name: "Needs information", exact: true }).click();
  await page.getByRole("button", { name: "Back to active tasks" }).click();
  await expect(page.locator(".task-card")).toHaveCount(1);
  await expect(page.locator(".task-card")).toContainText("Needs information");

  await page.getByLabel("Status", { exact: true }).selectOption("Needs information");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator("#show-archive")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#tasks-title")).toHaveText("Archive");
  await expect(page.locator("#status-filter option")).toHaveText(["All statuses", "Rejected", "Published - demo"]);
  await expect(page.locator(".task-card")).toHaveCount(2);
  await expect(page.locator("#task-counts")).toContainText("Rejected: 1");
  await expect(page.locator("#task-counts")).toContainText("Published - demo: 1");
  for (const [status, color] of [["Published - demo", "rgb(23, 107, 53)"], ["Rejected", "rgb(163, 35, 35)"]]) {
    await expect(page.locator(`#task-list .status-badge[data-status="${status}"]`)).toHaveCSS("color", color);
    await expect(page.locator(`#task-counts .status-badge[data-status="${status}"]`)).toHaveCSS("color", color);
    await expect(page.locator(`#task-list .status-badge[data-status="${status}"]`)).toHaveCSS("background-color", "rgb(231, 238, 245)");
  }
  await expect(page.locator('.task-card[data-mode="add"]')).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator('.task-card[data-mode="update"]')).toHaveCSS("border-top-color", "rgb(36, 75, 120)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByLabel("Status", { exact: true }).selectOption("Published - demo");
  await expect(page.locator(".task-card")).toHaveCount(1);
  await expect(page.locator(".task-card")).toContainText("Published - demo");
  await page.getByLabel("Status", { exact: true }).selectOption("");
  await page.getByLabel("Assignee", { exact: true }).selectOption("Anna Eder");
  await expect(page.locator(".task-card")).toHaveCount(1);
  await expect(page.locator(".task-card")).toContainText("Rejected");
  await page.getByLabel("Search requests").fill("no such request");
  await expect(page.locator("#no-tasks")).toBeVisible();
  await page.getByLabel("Search requests").fill("MSK");
  await open(page, "update");
  await expect(page.locator("#request-history")).toContainText("Archived rejection reason.");
  await expect(page.locator("#request-heading .status-badge")).toHaveCSS("color", "rgb(163, 35, 35)");
  await expect(page.locator("#show-archive")).toHaveCSS("background-color", "rgb(36, 75, 120)");
  await expect(page.getByLabel("City", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Assigned to", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Back to archive" }).click();
  await expect(page.locator("#tasks-title")).toHaveText("Archive");
  await expect(page.locator(".task-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Active tasks", exact: true }).click();
  await expect(page.getByLabel("Search requests")).toHaveValue("");
  await expect(page.getByLabel("Assignee", { exact: true })).toHaveValue("");
  await expect(page.locator(".task-card")).toHaveCount(1);

  await page.reload();
  await signIn(page);
  await expect(page.locator("#tasks-title")).toHaveText("Active tasks");
  await expect(page.locator(".task-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator(".task-card")).toHaveCount(2);
  const saved = await workspace(page);
  const rejected = saved.requests.find(request => request.status === "Rejected");
  await page.goto(`/reviewer.html?request=${encodeURIComponent(rejected.id)}`);
  await signIn(page);
  await expect(page.locator("#show-archive")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#show-archive")).toHaveCSS("background-color", "rgb(36, 75, 120)");
  await expect(page.locator("#request-history")).toContainText("Archived rejection reason.");
  await page.getByRole("button", { name: "Back to archive" }).click();
  await expect(page.locator(".task-card")).toHaveCount(2);
  await open(page, "update");
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await confirm(page, "Delete permanently");
  await expect(page.locator("#tasks-title")).toHaveText("Archive");
  await expect(page.locator(".task-card")).toHaveCount(1);
  expect((await workspace(page)).records).toEqual(saved.records);
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

test("deletion is restricted to archived requests and requires an irreversible-deletion warning", async ({ page }) => {
  await route(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page);
  await expect(page.getByRole("button", { name: "Delete request", exact: true })).toBeHidden();
  await assign(page);
  await expect(page.getByRole("button", { name: "Delete request", exact: true })).toBeHidden();
  await page.getByLabel("Reviewer note / decision reason").fill("Waiting for information.");
  await page.getByRole("button", { name: "Needs information", exact: true }).click();
  await expect(page.getByRole("button", { name: "Delete request", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Approve and publish - demo", exact: true }).click();
  await expect(page.locator("#delete-warning")).toBeHidden();
  await expect(page.getByRole("button", { name: "Confirm", exact: true })).not.toHaveClass("danger");
  await confirm(page);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await open(page);
  const original = await workspace(page);
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await expect(page.locator("#confirm-title")).toHaveText("Permanently delete this archived request?");
  await expect(page.locator("#delete-warning")).toBeVisible();
  await expect(page.locator("#delete-warning")).toContainText("Warning: permanent deletion");
  await expect(page.locator("#delete-warning")).toContainText("contact details, notes and review history");
  await expect(page.locator("#delete-warning")).toContainText("cannot be recovered");
  await expect(page.getByRole("button", { name: "Delete permanently", exact: true })).toHaveClass("danger");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.locator("#confirm-body")).toContainText("does not undo publication");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await workspace(page)).toEqual(original);
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#confirm-dialog")).toBeHidden();
  expect(await workspace(page)).toEqual(original);
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await confirm(page, "Delete permanently");
  await expect(page.locator("#workspace-status")).toContainText("deleted from this browser");
  await expect(page.locator("#tasks-title")).toHaveText("Archive");
  await expect(page.locator(".task-card")).toHaveCount(0);
  expect((await workspace(page)).records).toEqual(original.records);
  await page.reload();
  await signIn(page);
  await expect(page.locator(".task-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator(".task-card")).toHaveCount(0);
});

test("failed and stale deletions do not remove requests", async ({ page }) => {
  await route(page);
  await page.goto("/reviewer.html");
  await signIn(page);
  await open(page);
  await assign(page);
  await page.getByLabel("Reviewer note / decision reason").fill("Rejected test request.");
  await page.getByRole("button", { name: "Reject request", exact: true }).click();
  await confirm(page);
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await open(page);
  await page.evaluate(async () => {
    const { DemoStore } = await import("/workflow.js");
    const store = new DemoStore();
    const current = store.read();
    await store.update(current.id, workspace => {
      const request = workspace.requests.find(request => request.mode === "add");
      request.version++;
    });
  });
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await confirm(page, "Delete permanently");
  await expect(page.locator("#detail-error")).toContainText("request changed");
  expect((await workspace(page)).requests).toHaveLength(3);
  await page.getByRole("button", { name: "Back to archive" }).click();
  await open(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new Error("Deletion storage denied"); };
  });
  await page.getByRole("button", { name: "Delete request", exact: true }).click();
  await confirm(page, "Delete permanently");
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
  await page.getByRole("button", { name: "Back to active tasks" }).click();
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
