import { normalizeCode, prefill, validateRecords, validateRequest } from "./core.js";

export const WORKSPACE_KEY = "smdg-liner-workflow-demo-v1";
export const ASSIGNEES = ["Javier Moral", "Thalke Diepenbrock", "Mark Lim", "Jasmin Dronner", "Anna Eder"];
export const STATUSES = ["Pending review", "Under review", "Needs information", "Rejected", "Published - demo"];
export const LABELS = {
  code: "Liner code", linerName: "Liner name", carrierType: "Carrier type",
  parentCompany: "Parent company", website: "Website", unCountryCode: "UN Country Code",
  unLocode: "UN/LOCODE location part", street: "Street", streetNumber: "Street number",
  floor: "Building / Floor", postCode: "Postal code", city: "City", state: "Area",
  country: "Country", validFrom: "Valid From", validTo: "Valid To", remarks: "Remarks",
  reason: "Request reason", comments: "Request comments", contactName: "Contact name", contactEmail: "Contact email"
};
export const RECORD_FIELDS = Object.keys(LABELS).filter(key =>
  !["reason", "comments", "contactName", "contactEmail"].includes(key));
const VALUE_FIELDS = Object.keys(LABELS);
const terminal = request => ["Rejected", "Published - demo"].includes(request.status);
export const isClosed = terminal;
const copy = value => structuredClone(value);
const timestamp = () => new Date().toISOString();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function text(value, label, max = 10000) {
  if (typeof value !== "string" || value.length > max) throw new Error(`Invalid ${label}.`);
  return value;
}
function dateText(value) {
  const result = text(value, "event date", 100);
  if (!Number.isFinite(Date.parse(result))) throw new Error("Invalid event date.");
  return result;
}

export function cleanValues(values) {
  const output = {};
  for (const key of VALUE_FIELDS) output[key] = text(values[key] ?? "", key).trim();
  for (const key of ["code", "unCountryCode", "unLocode"]) output[key] = normalizeCode(output[key]);
  return output;
}

export function toRecord(values) {
  const v = cleanValues(values);
  return {
    linerSMDGCode: v.code, linerName: v.linerName, carrierType: v.carrierType,
    parentCompany: v.parentCompany, website: v.website, validFrom: v.validFrom,
    validTo: v.validTo, remarks: v.remarks,
    addressLocation: {
      UnCountryCode: v.unCountryCode, UnLocode: v.unLocode,
      address: Object.fromEntries(["street", "streetNumber", "floor", "postCode", "city", "state", "country"]
        .map(key => [key, v[key]]))
    }
  };
}

function canonical(record) {
  return toRecord(prefill(record));
}

export function conflict(request, records) {
  const current = records.find(record => record.linerSMDGCode === request.proposal.code) ?? null;
  if (request.mode === "add") return current ? "This code now exists in the demo list. Reject this request or use a different code in a new request." : "";
  if (!current) return "This code was removed from the demo list. Publication is blocked.";
  return equal(current, request.baseline) ? "" :
    "This record changed after the request was submitted. Compare the current data and explicitly acknowledge the new baseline before publishing.";
}

function event(request, action, note = "") {
  request.history.push({ at: timestamp(), actor: "linercodelists (shared demo account)", action, note });
}

function assertValid(mode, values, records) {
  const errors = validateRequest(mode, values, records);
  if (Object.keys(errors).length) {
    throw new Error(Object.values(errors).join(" "));
  }
}

export function submitRequest(workspace, mode, values, baseline = null) {
  const submitted = cleanValues(values);
  assertValid(mode, submitted, workspace.records);
  const current = workspace.records.find(record => record.linerSMDGCode === submitted.code) ?? null;
  if (!equal(current, baseline)) throw new Error("The demo record changed while you filled out the form. Reload the list and review your request again.");
  const id = crypto.randomUUID();
  let number = workspace.requests.length + 1;
  const references = new Set(workspace.requests.map(request => request.reference));
  while (references.has(`DEMO-${String(number).padStart(5, "0")}`)) number++;
  const request = {
    id, reference: `DEMO-${String(number).padStart(5, "0")}`, list: "liner-codes",
    mode, submitted, proposal: copy(submitted), baseline: copy(baseline),
    originalBaseline: copy(baseline), assignee: "", status: "Pending review",
    createdAt: timestamp(), version: 1, history: []
  };
  event(request, "Submitted", "Stored in this browser only. No notification sent.");
  workspace.requests.unshift(request);
  return request;
}

export function deleteRequest(workspace, id, version) {
  const request = workspace.requests.find(item => item.id === id);
  if (!request || request.version !== version) throw new Error("This request changed or no longer exists. Reopen it from Archive before deleting.");
  if (!terminal(request)) throw new Error("Only archived requests can be deleted. Publish or reject the request first.");
  workspace.requests = workspace.requests.filter(item => item.id !== id);
}

export function actOnRequest(workspace, id, version, action, input = {}) {
  const request = workspace.requests.find(item => item.id === id);
  if (!request || request.version !== version) throw new Error("This request changed or no longer exists. Reopen it from All tasks before continuing.");
  if (terminal(request)) throw new Error("This request is closed and cannot be changed or published again.");
  const proposal = input.values ? cleanValues(input.values) : copy(request.proposal);
  if (proposal.code !== request.submitted.code) throw new Error("The requested code cannot be changed. Submit a new request for a different code.");
  if (proposal.contactName !== request.submitted.contactName || proposal.contactEmail !== request.submitted.contactEmail) {
    throw new Error("The original contact details cannot be changed.");
  }
  const note = text(input.note ?? "", "reviewer note").trim();
  if (["clarify", "reject", "note", "rebase"].includes(action) && !note) {
    throw new Error("Enter a reviewer note or reason for this action.");
  }
  if (action === "assign") {
    if (input.assignee !== "" && !ASSIGNEES.includes(input.assignee)) throw new Error("Choose a listed assignee or Unassigned.");
    request.assignee = input.assignee;
    if (["Pending review", "Under review"].includes(request.status)) {
      request.status = request.assignee ? "Under review" : "Pending review";
    }
    event(request, "Assignment changed", request.assignee || "Unassigned");
  } else if (["save", "note", "clarify", "resume", "reject", "rebase", "publish"].includes(action)) {
    if (!request.assignee) throw new Error("Assign this request to a reviewer before taking a review action.");
    if (action === "publish") {
      const message = conflict(request, workspace.records);
      if (message) throw new Error(message);
      assertValid(request.mode, proposal, workspace.records);
    }
    if (action === "rebase") {
      const current = workspace.records.find(record => record.linerSMDGCode === proposal.code);
      if (request.mode === "add" || !current) throw new Error("This request has no existing record to rebase onto.");
      request.baseline = copy(current);
    }
    const changed = !equal(request.proposal, proposal);
    request.proposal = proposal;
    if (changed) event(request, "Proposal edited", "Reviewer changes retained; original submission is unchanged.");
    if (action === "publish") {
      workspace.records = workspace.records.filter(record => record.linerSMDGCode !== proposal.code);
      if (request.mode !== "delete") workspace.records.push(toRecord(proposal));
      workspace.records.sort((a, b) => a.linerSMDGCode.localeCompare(b.linerSMDGCode, "en"));
      request.status = "Published - demo";
      request.publishedAt = timestamp();
      event(request, "Published - demo", `${request.mode} applied to browser-local demo list only. ${note}`.trim());
    } else if (action === "reject") {
      request.status = "Rejected";
      event(request, "Rejected", note);
    } else if (action === "clarify") {
      request.status = "Needs information";
      event(request, "Clarification requested", `${note} (No email sent.)`);
    } else if (action === "resume") {
      request.status = "Under review";
      event(request, "Review resumed", note);
    } else {
      event(request, { save: "Draft saved", note: "Reviewer note", rebase: "Current baseline acknowledged" }[action], note);
    }
  } else throw new Error("Unknown workflow action.");
  request.version++;
  return request;
}

export function createWorkspace(snapshot) {
  validateRecords(snapshot);
  const workspace = {
    schema: 1, id: crypto.randomUUID(), revision: 0,
    records: snapshot.map(canonical), requests: []
  };
  let code = "Q9Z";
  for (let index = 0; workspace.records.some(record => record.linerSMDGCode === code); index++) {
    if (index >= 46656) throw new Error("No unused code is available for sample data.");
    code = index.toString(36).toUpperCase().padStart(3, "0");
  }
  const sample = {
    code, linerName: "Example Ocean Demo Ltd", carrierType: "NVOCC",
    website: "www.example.com", street: "Example Street", streetNumber: "10",
    postCode: "1000", city: "Example City", state: "Example Region", country: "Netherlands",
    validFrom: "2026-01-01", contactName: "Demo Requester", contactEmail: "requester@example.com",
    remarks: "Fictional request for testing only.", comments: "", reason: ""
  };
  submitRequest(workspace, "add", sample);
  for (const [index, mode] of ["update", "delete"].entries()) {
    const record = workspace.records[index] ?? workspace.records[0];
    const values = {
      ...sample, ...prefill(record), reason: mode === "update" ? "Correct the head-office details." : "Demo deletion for review.",
      contactName: "Demo Requester", contactEmail: "requester@example.com"
    };
    if (mode === "update") {
      for (const key of ["carrierType", "street", "postCode", "city", "state", "country", "website"]) {
        if (!values[key] || (key === "carrierType" && !["NVOCC", "VOCC"].includes(values[key]))) values[key] = sample[key];
      }
      values.remarks = "Proposed correction from a fictional requester.";
    }
    submitRequest(workspace, mode, values, record);
  }
  return workspace;
}

export function validateWorkspace(raw) {
  if (!raw || raw.schema !== 1 || typeof raw.id !== "string" || !raw.id
      || !Number.isSafeInteger(raw.revision) || raw.revision < 0
      || !Array.isArray(raw.records) || !Array.isArray(raw.requests)
      || raw.records.length > 50000 || raw.requests.length > 10000) throw new Error("Invalid or unsupported demo workspace.");
  const records = raw.records.map(canonical);
  if (records.length) validateRecords(records);
  const ids = new Set();
  const references = new Set();
  const requests = raw.requests.map(item => {
    if (!item || !["add", "update", "delete"].includes(item.mode) || !STATUSES.includes(item.status)
        || item.list !== "liner-codes" || (item.assignee !== "" && !ASSIGNEES.includes(item.assignee))
        || !Number.isSafeInteger(item.version) || item.version < 1
        || !Array.isArray(item.history) || item.history.length > 10000) throw new Error("Invalid request in demo workspace.");
    const id = text(item.id, "request ID", 100);
    const reference = text(item.reference, "reference", 100);
    if (!id || ids.has(id)) throw new Error("Invalid or duplicate request ID.");
    if (!reference || references.has(reference)) throw new Error("Invalid or duplicate request reference.");
    ids.add(id);
    references.add(reference);
    for (const values of [item.submitted, item.proposal]) {
      if (!values || VALUE_FIELDS.some(key => typeof values[key] !== "string")) throw new Error("Missing or invalid request fields.");
    }
    const submitted = cleanValues(item.submitted);
    const proposal = cleanValues(item.proposal);
    if (!/^[A-Z0-9]{3}$/.test(submitted.code) || proposal.code !== submitted.code
        || proposal.contactName !== submitted.contactName || proposal.contactEmail !== submitted.contactEmail) throw new Error("Invalid request values.");
    const baseline = item.baseline === null ? null : canonical(item.baseline);
    const originalBaseline = item.originalBaseline === null ? null : canonical(item.originalBaseline);
    if ((item.mode === "add" && (baseline || originalBaseline))
        || (item.mode !== "add" && (!baseline || !originalBaseline
          || baseline.linerSMDGCode !== submitted.code || originalBaseline.linerSMDGCode !== submitted.code))) throw new Error("Invalid request baseline.");
    if (baseline) {
      validateRecords([baseline]);
      validateRecords([originalBaseline]);
    }
    assertValid(item.mode, submitted, originalBaseline ? [originalBaseline] : []);
    if (item.status === "Published - demo" && !item.publishedAt) throw new Error("Published request is missing its publication date.");
    return {
      id, reference, list: "liner-codes",
      mode: item.mode, submitted, proposal, baseline, originalBaseline,
      assignee: item.assignee, status: item.status, version: item.version,
      createdAt: dateText(item.createdAt),
      ...(item.publishedAt ? { publishedAt: dateText(item.publishedAt) } : {}),
      history: item.history.map(entry => ({
        at: dateText(entry.at), actor: text(entry.actor, "history actor", 200),
        action: text(entry.action, "history action", 200), note: text(entry.note, "history note", 20000)
      }))
    };
  });
  return { schema: 1, id: text(raw.id, "workspace ID", 100), revision: raw.revision, records, requests };
}

export class DemoStore {
  constructor(storage) {
    this.storage = storage;
  }

  read() {
    const value = (this.storage ?? localStorage).getItem(WORKSPACE_KEY);
    if (value === null) return null;
    if (value.length > 8000000) throw new Error("The demo workspace exceeds the 8 MB limit.");
    return validateWorkspace(JSON.parse(value));
  }

  async write(change) {
    if (!navigator.locks) throw new Error("This browser cannot safely save the demo. Use a current browser on localhost or HTTPS with Web Locks support.");
    return navigator.locks.request(WORKSPACE_KEY, async () => {
      const workspace = this.read();
      const next = change(workspace);
      next.revision++;
      const value = JSON.stringify(validateWorkspace(next));
      if (value.length > 8000000) throw new Error("The workspace exceeds the 8 MB limit. Export it and reset before adding more requests.");
      (this.storage ?? localStorage).setItem(WORKSPACE_KEY, value);
      return validateWorkspace(next);
    });
  }

  initialize(snapshot) {
    return this.write(current => current ?? createWorkspace(snapshot));
  }

  update(expectedId, change) {
    return this.write(current => {
      if (!current || current.id !== expectedId) throw new Error("The workspace was reset or replaced. Reload before continuing.");
      change(current);
      return current;
    });
  }

  replace(next, expected) {
    return this.write(current => {
      if (current?.id !== expected?.id || current?.revision !== expected?.revision) {
        throw new Error("The workspace changed. Refresh and try again before replacing it.");
      }
      return { ...validateWorkspace(next), id: crypto.randomUUID() };
    });
  }
}
