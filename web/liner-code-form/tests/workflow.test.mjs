import assert from "node:assert/strict";
import { test } from "node:test";
import { prefill } from "../core.js";
import {
  ASSIGNEES, DemoStore, createWorkspace, validateWorkspace, submitRequest, actOnRequest, deleteRequest, conflict, toRecord
} from "../workflow.js";

const values = {
  code: "MSK", linerName: "Example Carrier", carrierType: "VOCC",
  website: "www.example.com", street: "Example Street", postCode: "1000",
  city: "Example City", state: "Example Area", country: "Denmark", validFrom: "2020-01-01",
  contactName: "Demo Contact", contactEmail: "demo@example.com", reason: "Test correction"
};
const snapshot = [toRecord(values), toRecord({ ...values, code: "AAA", linerName: "Another Example" })];
function setup(mode = "add") {
  const workspace = createWorkspace(snapshot);
  workspace.requests = [];
  const baseline = mode === "add" ? null : workspace.records[0];
  const request = submitRequest(workspace, mode, {
    ...values, ...(baseline ? prefill(baseline) : { code: "Z9Z" })
  }, baseline);
  return { workspace, request };
}
function act(workspace, request, action, input = {}) {
  return actOnRequest(workspace, request.id, request.version, action, input);
}
function assign(workspace, request) {
  act(workspace, request, "assign", { assignee: ASSIGNEES[0] });
}

test("seeded workspace is valid and has complete requests for all three modes", () => {
  const workspace = createWorkspace(snapshot);
  assert.equal(workspace.requests.length, 3);
  assert.deepEqual(new Set(workspace.requests.map(request => request.mode)), new Set(["add", "update", "delete"]));
  assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(workspace))), workspace);
});

test("request deletion removes only the request for pending, rejected and published requests", () => {
  for (const state of ["pending", "reject", "publish"]) {
    const { workspace, request } = setup();
    if (state !== "pending") {
      assign(workspace, request);
      act(workspace, request, state, { note: "Demo decision" });
    }
    const records = structuredClone(workspace.records);
    assert.throws(() => deleteRequest(workspace, request.id, request.version + 1), /changed/);
    assert.equal(workspace.requests.length, 1);
    deleteRequest(workspace, request.id, request.version);
    assert.equal(workspace.requests.length, 0);
    assert.deepEqual(workspace.records, records);
    assert.throws(() => deleteRequest(workspace, request.id, request.version), /no longer exists/);
    assert.deepEqual(validateWorkspace(workspace), workspace);
  }
});

for (const mode of ["add", "update", "delete"]) {
  test(`${mode} direct publish uses reviewer values, excludes contacts and retains original and history`, () => {
    const { workspace, request } = setup(mode);
    const original = structuredClone(request.submitted);
    const oldCount = workspace.records.length;
    assert.throws(() => act(workspace, request, "publish"), /Assign/);
    assign(workspace, request);
    const final = { ...request.proposal, city: "Agreed City" };
    act(workspace, request, "publish", { values: final });
    assert.equal(request.status, "Published - demo");
    assert.deepEqual(request.submitted, original);
    assert.equal(request.proposal.city, "Agreed City");
    const record = workspace.records.find(record => record.linerSMDGCode === final.code);
    assert.equal(workspace.records.length, oldCount + (mode === "add" ? 1 : mode === "delete" ? -1 : 0));
    if (mode === "delete") assert.equal(record, undefined);
    else {
      assert.equal(record.addressLocation.address.city, "Agreed City");
      assert.ok(!JSON.stringify(record).includes("demo@example.com"));
      assert.ok(!JSON.stringify(record).includes("Test correction"));
    }
    assert.ok(request.history.some(entry => entry.action === "Proposal edited"));
    assert.throws(() => act(workspace, request, "publish"), /closed/);
    assert.deepEqual(validateWorkspace(workspace), workspace);
  });
}

test("clarification, notes and resume retain assignment and edits; rejection never changes dataset", () => {
  const { workspace, request } = setup();
  const originalRecords = structuredClone(workspace.records);
  assign(workspace, request);
  assert.throws(() => act(workspace, request, "clarify"), /note or reason/);
  act(workspace, request, "clarify", { note: "Please confirm the address", values: { ...request.proposal, city: "Draft City" } });
  assert.equal(request.status, "Needs information");
  assert.equal(request.assignee, ASSIGNEES[0]);
  assert.equal(request.proposal.city, "Draft City");
  act(workspace, request, "note", { note: "Requester confirmed by phone." });
  act(workspace, request, "resume");
  assert.equal(request.status, "Under review");
  act(workspace, request, "reject", { note: "Duplicate request." });
  assert.equal(request.status, "Rejected");
  assert.deepEqual(workspace.records, originalRecords);
  assert.throws(() => act(workspace, request, "assign", { assignee: "" }), /closed/);
});

test("drafts can be incomplete but publication always revalidates", () => {
  const { workspace, request } = setup();
  assign(workspace, request);
  act(workspace, request, "save", { values: { ...request.proposal, website: "", linerName: "" } });
  assert.equal(request.proposal.website, "");
  assert.deepEqual(validateWorkspace(workspace), workspace);
  assert.throws(() => act(workspace, request, "publish"), /required/);
  assert.equal(request.status, "Under review");
});

test("stale request versions and changed baselines block writes; explicit rebase retains the proposal", () => {
  const { workspace, request } = setup("update");
  const oldVersion = request.version;
  assign(workspace, request);
  assert.throws(() => actOnRequest(workspace, request.id, oldVersion, "assign", { assignee: ASSIGNEES[1] }), /changed/);
  workspace.records[0].linerName = "Changed elsewhere";
  assert.match(conflict(request, workspace.records), /changed/);
  assert.throws(() => act(workspace, request, "publish"), /changed/);
  const originalBaseline = structuredClone(request.originalBaseline);
  act(workspace, request, "rebase", { note: "Compared all fields and retained agreed values." });
  assert.deepEqual(request.originalBaseline, originalBaseline);
  assert.equal(request.baseline.linerName, "Changed elsewhere");
  assert.equal(conflict(request, workspace.records), "");
  act(workspace, request, "publish");
  assert.equal(workspace.records.find(record => record.linerSMDGCode === request.proposal.code).linerName, request.proposal.linerName);
});

test("duplicate adds, removed records and stale form baselines never silently overwrite", () => {
  const { workspace, request } = setup();
  const second = submitRequest(workspace, "add", { ...request.submitted });
  assign(workspace, request);
  assign(workspace, second);
  act(workspace, request, "publish");
  assert.throws(() => act(workspace, second, "publish"), /now exists/);
  assert.throws(() => submitRequest(workspace, "add", request.submitted), /already exists/);
  const baseline = structuredClone(workspace.records[0]);
  workspace.records[0].linerName = "Changed";
  assert.throws(() => submitRequest(workspace, "update", { ...values, ...prefill(baseline) }, baseline), /changed/);
  const deletion = submitRequest(workspace, "delete", { ...values, ...prefill(workspace.records[0]) }, workspace.records[0]);
  assign(workspace, deletion);
  workspace.records = workspace.records.filter(record => record.linerSMDGCode !== deletion.proposal.code);
  assert.throws(() => act(workspace, deletion, "publish"), /removed/);
});

test("assignment supports all names, unassignment and preserves clarification status", () => {
  const { workspace, request } = setup();
  for (const name of ASSIGNEES) act(workspace, request, "assign", { assignee: name });
  assert.equal(request.assignee, ASSIGNEES.at(-1));
  assert.throws(() => act(workspace, request, "assign", { assignee: "Unknown" }), /listed/);
  act(workspace, request, "assign", { assignee: "" });
  assert.equal(request.status, "Pending review");
  assign(workspace, request);
  act(workspace, request, "clarify", { note: "Check the address." });
  act(workspace, request, "assign", { assignee: ASSIGNEES[1] });
  assert.equal(request.status, "Needs information");
});

test("import rejects invalid shapes, dates, baselines, duplicates and unsupported schemas", () => {
  for (const mutate of [
    workspace => { workspace.schema = 99; },
    workspace => { workspace.requests[0].status = "Invalid"; },
    workspace => { workspace.requests[0].assignee = "Unknown"; },
    workspace => { workspace.requests[0].createdAt = "not a date"; },
    workspace => { delete workspace.requests[0].submitted.contactName; },
    workspace => { workspace.requests.push(workspace.requests[0]); },
    workspace => { workspace.records.push(workspace.records[0]); },
    workspace => { workspace.requests[0].baseline = snapshot[0]; },
    workspace => { workspace.requests[0].proposal.code = "BAD"; }
  ]) {
    const { workspace } = setup();
    mutate(workspace);
    assert.throws(() => validateWorkspace(workspace));
  }
  const { workspace, request } = setup();
  assign(workspace, request);
  act(workspace, request, "publish");
  const serialized = JSON.parse(JSON.stringify(workspace));
  serialized.records[0].contactEmail = "should-not-export@example.com";
  assert.ok(!JSON.stringify(validateWorkspace(serialized).records).includes("should-not-export"));
});

test("store read failures are explicit and never replaced with a fresh workspace", () => {
  const store = new DemoStore({ getItem: () => "{invalid json" });
  assert.throws(() => store.read());
  const blocked = new DemoStore({ getItem: () => { throw new Error("Storage blocked"); } });
  assert.throws(() => blocked.read(), /Storage blocked/);
});
