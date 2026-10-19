import { prefill, validateRequest, validateRecords } from "./core.js";
import { countries } from "./countries.js";
import { linkedValue, websiteShortcut } from "./links.js";
import {
  DemoStore, WORKSPACE_KEY, ASSIGNEES, STATUSES, LABELS, RECORD_FIELDS,
  actOnRequest, deleteRequest, conflict, isClosed, cleanValues
} from "./workflow.js";

const field = id => document.getElementById(id);
const store = new DemoStore();
let workspace;
let selected;
let dirty = false;
let busy = false;
let pageNumber = 0;
let signedIn = false;
let showingArchive = false;

function node(tag, value, className) {
  const element = document.createElement(tag);
  if (value !== undefined) element.textContent = value;
  if (className) element.className = className;
  return element;
}
function errorAt(id, error) {
  field(id).textContent = error.message;
  field(id).hidden = false;
}
function clearError(id) {
  field(id).hidden = true;
  field(id).textContent = "";
}
function displayDate(value) {
  return new Date(value).toLocaleString();
}
async function loadSnapshot() {
  const response = await fetch("./data/_combined.json", { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Could not load public snapshot (HTTP ${response.status}).`);
  return validateRecords(await response.json());
}
function confirmAction(title, message, values) {
  field("confirm-title").textContent = title;
  field("confirm-body").replaceChildren(node("p", message));
  if (values) {
    const list = node("dl", undefined, "review-summary");
    for (const key of RECORD_FIELDS) addInfo(list, LABELS[key], values[key]);
    field("confirm-body").append(list);
  }
  const dialog = field("confirm-dialog");
  return new Promise(resolve => {
    const close = answer => {
      dialog.close();
      field("confirm-accept").onclick = null;
      field("confirm-cancel").onclick = null;
      dialog.oncancel = null;
      resolve(answer);
    };
    field("confirm-accept").onclick = () => close(true);
    field("confirm-cancel").onclick = () => close(false);
    dialog.oncancel = event => { event.preventDefault(); close(false); };
    dialog.showModal();
  });
}
async function discardEdits() {
  return !dirty || await confirmAction("Leave unsaved edits?", "Your unsaved proposal and note will be discarded. Saved changes remain in the workspace.");
}
function screen(id) {
  for (const name of ["tasks-step", "detail-step", "list-step"]) field(name).hidden = name !== id;
  field("show-tasks").setAttribute("aria-pressed", String(id === "tasks-step" && !showingArchive));
  field("show-archive").setAttribute("aria-pressed", String(id === "tasks-step" && showingArchive));
  field(id).focus();
}
function workspaceStatus(message = "") {
  field("workspace-status").textContent = message || `${workspace.requests.length} requests | ${workspace.records.length} demo codes | Saved in this browser only`;
}
function setTaskView(archive) {
  if (showingArchive !== archive) {
    field("task-search").value = "";
    field("assignee-filter").value = "";
  }
  showingArchive = archive;
  field("tasks-title").textContent = archive ? "Archive" : "Active tasks";
  field("tasks-help").textContent = archive
    ? "Published and rejected requests, with their details and review history retained."
    : "Requests awaiting review or information. Published and rejected requests are kept in the Archive.";
  field("back-to-tasks").textContent = archive ? "Back to archive" : "Back to active tasks";
  field("status-filter").replaceChildren(new Option("All statuses", ""),
    ...STATUSES.filter(status => isClosed({ status }) === archive).map(status => new Option(status, status)));
}
function renderCards() {
  const query = field("task-search").value.trim().toLowerCase();
  const status = field("status-filter").value;
  const assignee = field("assignee-filter").value;
  const scopedRequests = workspace.requests.filter(request => isClosed(request) === showingArchive);
  field("task-counts").replaceChildren(...STATUSES.filter(value => isClosed({ status: value }) === showingArchive).map(value =>
    node("span", `${value}: ${scopedRequests.filter(request => request.status === value).length}`, "status-badge")));
  const requests = scopedRequests.filter(request =>
    (!status || request.status === status)
    && (!assignee || request.assignee === (assignee === "unassigned" ? "" : assignee))
    && [request.reference, request.submitted.code, request.proposal.linerName, request.submitted.contactName]
      .some(value => value.toLowerCase().includes(query)));
  field("task-list").replaceChildren();
  field("no-tasks").hidden = requests.length !== 0;
  for (const request of requests) {
    const card = node("article", undefined, "task-card");
    card.dataset.mode = request.mode;
    card.append(
      node("span", request.status, "status-badge"),
      node("p", `${request.reference} | ${request.mode.toUpperCase()} | LINER CODES`, "eyebrow"),
      node("h3", `${request.submitted.code} - ${request.proposal.linerName}`),
      node("p", request.submitted.reason || "New liner code request"),
      node("p", `Assigned to: ${request.assignee || "Unassigned"}`),
      node("p", `Submitted: ${displayDate(request.createdAt)}`, "hint")
    );
    const button = node("button", "Open request");
    button.setAttribute("aria-label", `Open request ${request.reference}`);
    button.addEventListener("click", () => openRequest(request.id));
    card.append(button);
    field("task-list").append(card);
  }
}
function addInfo(list, label, value, request) {
  const name = label === LABELS.website ? "website" : label === LABELS.contactEmail ? "contactEmail" : "";
  list.append(node("dt", label), linkedValue(node("dd"), name, value, request));
}
function editorValues() {
  const values = { ...selected.proposal };
  for (const input of field("editor-fields").querySelectorAll("[name]")) values[input.name] = input.value;
  return cleanValues(values);
}
function compareValues() {
  const values = editorValues();
  const current = workspace.records.find(record => record.linerSMDGCode === values.code);
  const baseline = current ? prefill(current) : {};
  field("comparison-body").replaceChildren();
  if (selected.mode !== "update") return;
  for (const key of RECORD_FIELDS) {
    const row = node("tr", undefined, (values[key] || "") !== (baseline[key] || "") ? "changed" : "");
    const label = node("th", LABELS[key]);
    label.scope = "row";
    row.append(label, ...[baseline[key], selected.submitted[key], values[key]]
      .map(value => linkedValue(node("td"), key, value)));
    field("comparison-body").append(row);
  }
}
function renderDetail(draft, note = "") {
  const request = selected;
  const closed = isClosed(request);
  const heading = node("h2", `${request.reference}: ${request.mode.toUpperCase()} ${request.proposal.code}`);
  heading.id = "detail-title";
  field("request-heading").replaceChildren(heading, node("p", request.status, "status-badge"));
  const info = field("request-info");
  info.replaceChildren();
  for (const [label, value] of [
    ["Code list", "Liner codes"], ["Submitted", displayDate(request.createdAt)],
    ["Original liner name", request.submitted.linerName], ["Request reason", request.submitted.reason],
    ["Request comments", request.submitted.comments], ["Contact name", request.submitted.contactName],
    ["Contact email", request.submitted.contactEmail]
  ]) addInfo(info, label, value, request.submitted);
  field("task-assignee").value = request.assignee;
  field("task-assignee").disabled = closed;
  field("save-assignment").disabled = closed;
  field("proposal-section").hidden = request.mode === "delete";
  field("comparison-section").hidden = request.mode !== "update";
  field("deletion-section").hidden = request.mode !== "delete";
  field("deletion-record").replaceChildren();
  if (request.mode === "delete") {
    const current = workspace.records.find(record => record.linerSMDGCode === request.proposal.code);
    const record = closed ? request.baseline : current ?? request.baseline;
    const values = prefill(record);
    for (const key of RECORD_FIELDS) addInfo(field("deletion-record"), LABELS[key], values[key]);
    field("deletion-help").textContent = closed
      ? "Record details retained at the time this request was closed."
      : current ? "Current details of the record that will be removed from the demo list."
        : "This record is no longer in the demo list. Showing the saved request baseline; publication is blocked.";
  }
  field("editor-fields").replaceChildren();
  const editable = request.mode === "delete" ? [] : RECORD_FIELDS;
  const required = ["linerName", "carrierType", "street", "postCode", "city", "state", "country", "website",
    ...(request.mode === "add" ? ["validFrom"] : [])];
  for (const key of editable) {
    const wrapper = node("div", undefined, "field");
    const label = node("label", LABELS[key]);
    label.htmlFor = `edit-${key}`;
    let input;
    if (["carrierType", "country"].includes(key)) {
      input = node("select");
      input.add(new Option("----- Select -----", ""));
      const options = key === "country" ? countries.map(item => item.name) : ["NVOCC", "VOCC"];
      const existing = (draft ?? request.proposal)[key];
      if (existing && !options.includes(existing)) options.push(existing);
      for (const value of options) input.add(new Option(value, value));
    } else {
      input = node(key === "remarks" ? "textarea" : "input");
      if (key.startsWith("valid")) input.type = "date";
      if (["code", "unCountryCode", "unLocode"].includes(key)) input.maxLength = key === "unCountryCode" ? 2 : 3;
      if (["linerName", "parentCompany"].includes(key)) input.maxLength = 100;
      if (key === "code") input.readOnly = true;
    }
    input.id = label.htmlFor;
    input.name = key;
    input.value = (draft ?? request.proposal)[key] || "";
    input.required = required.includes(key);
    wrapper.append(label, input);
    if (key === "website") websiteShortcut(input);
    field("editor-fields").append(wrapper);
  }
  field("editor-fields").disabled = closed || !request.assignee;
  field("editor-help").textContent = closed ? "Final reviewer values. This request is closed." :
      "Assign the request to enable editing. Change values here, then publish directly or optionally save a draft.";
  field("reviewer-note").value = note;
  field("reviewer-note").disabled = closed || !request.assignee;
  for (const button of field("review-actions").querySelectorAll("button")) button.disabled = closed || !request.assignee;
  const message = closed ? "" : conflict(request, workspace.records);
  field("conflict-notice").textContent = message;
  field("conflict-notice").hidden = !message;
  field("rebase-request").hidden = !message || request.mode === "add" ||
    !workspace.records.some(record => record.linerSMDGCode === request.proposal.code);
  field("request-history").replaceChildren(...request.history.slice().reverse().map(entry => {
    const item = node("li");
    item.append(node("strong", entry.action), node("p", entry.note), node("small", `${displayDate(entry.at)} | ${entry.actor}`));
    return item;
  }));
  compareValues();
}
async function openRequest(id) {
  if (busy) return;
  if (!await discardEdits()) return;
  try {
    workspace = store.read();
    if (!workspace) throw new Error("Workspace missing. Sign out and sign in to initialize it.");
    selected = workspace.requests.find(request => request.id === id);
    if (!selected) throw new Error("Request no longer exists. Return to Active tasks or Archive.");
    dirty = false;
    clearError("detail-error");
    clearError("workspace-error");
    renderDetail();
    screen("detail-step");
  } catch (error) { errorAt("workspace-error", error); }
}
async function perform(action) {
  if (busy) return;
  busy = true;
  clearError("detail-error");
  try {
    const requestId = selected.id;
    const requestVersion = selected.version;
    const workspaceId = workspace.id;
    const assignee = field("task-assignee").value;
    const values = editorValues();
    const note = field("reviewer-note").value.trim();
    if (action !== "assign" && assignee !== selected.assignee) throw new Error("Save the changed assignment before taking a review action.");
    if (["reject", "clarify", "note", "rebase"].includes(action) && !note) throw new Error("Enter a reviewer note or decision reason first.");
    if (action === "publish") {
      const errors = validateRequest(selected.mode, values, workspace.records);
      if (Object.keys(errors).length) throw new Error(Object.values(errors).join(" "));
      if (conflict(selected, workspace.records)) throw new Error(conflict(selected, workspace.records));
    }
    if (["publish", "reject", "rebase"].includes(action)) {
      const messages = {
        publish: ["Approve and publish to demo list?", `Apply this ${selected.mode} using the values below? This changes only the browser-local demo list. No official data changes.`],
        reject: ["Reject this request?", `Reason: ${note}. The demo list will not change.`],
        rebase: ["Acknowledge the changed record?", "You have compared the current demo values with the original and your proposal. Your proposal will be retained, not automatically merged. Review all fields before publishing."]
      };
      const publishValues = action === "publish" && selected.mode === "delete"
        ? prefill(workspace.records.find(record => record.linerSMDGCode === values.code))
        : values;
      if (!await confirmAction(...messages[action], action === "publish" ? publishValues : undefined)) return;
    }
    field("workspace").inert = true;
    workspaceStatus(action === "publish" ? "Publishing to the demo list..." : "Saving demo changes...");
    const updated = await store.update(workspaceId, current => {
      actOnRequest(current, requestId, requestVersion, action, {
        values, note, assignee
      });
    });
    if (!signedIn) return;
    workspace = updated;
    selected = workspace.requests.find(request => request.id === requestId);
    dirty = action === "assign" && (JSON.stringify(values) !== JSON.stringify(selected.proposal) || !!note);
    renderDetail(action === "assign" ? values : undefined, action === "assign" ? note : "");
    workspaceStatus(action === "publish" ? `${selected.reference} published to the demo list only. No official data changed.` :
      `${selected.reference}: ${action === "assign" ? "assignment" : action} saved in this browser. No email sent.`);
  } catch (error) {
    field("workspace").inert = false;
    workspaceStatus("Action not saved. See the error in the request; your entries are retained.");
    errorAt("detail-error", error);
    field("detail-error").focus();
  } finally { busy = false; field("workspace").inert = false; }
}
async function removeRequest() {
  if (busy || !selected) return;
  busy = true;
  clearError("detail-error");
  const { id, version, reference } = selected;
  const workspaceId = workspace.id;
  try {
    if (!await confirmAction("Delete this demo request?",
      `Permanently delete ${reference}, including its contact details, notes and history? Unsaved edits will also be discarded. This cannot be undone. Any changes already published to the demo code list will remain; deleting a request does not undo publication.`)) return;
    field("workspace").inert = true;
    workspaceStatus("Deleting demo request...");
    const updated = await store.update(workspaceId, current => deleteRequest(current, id, version));
    if (!signedIn) return;
    workspace = updated;
    selected = null;
    dirty = false;
    field("workspace").inert = false;
    renderCards();
    screen("tasks-step");
    workspaceStatus(`${reference} deleted from this browser's workspace. The demo code list was not changed.`);
  } catch (error) {
    field("workspace").inert = false;
    workspaceStatus("Request was not deleted. Your saved data and unsaved edits are retained.");
    errorAt("detail-error", error);
    field("detail-error").focus();
  } finally {
    busy = false;
    field("workspace").inert = false;
  }
}
function renderList() {
  const query = field("list-search").value.trim().toLowerCase();
  const matches = workspace.records.filter(record =>
    `${record.linerSMDGCode} ${record.linerName}`.toLowerCase().includes(query));
  const start = pageNumber * 24;
  field("list-count").textContent = `${matches.length} matching codes | Page ${pageNumber + 1} of ${Math.max(1, Math.ceil(matches.length / 24))}`;
  field("demo-records").replaceChildren(...matches.slice(start, start + 24).map(record => {
    const card = node("details", undefined, "record-card");
    card.append(node("summary", `${record.linerSMDGCode} - ${record.linerName}`));
    const list = node("dl", undefined, "review-summary");
    const values = prefill(record);
    for (const key of RECORD_FIELDS) addInfo(list, LABELS[key], values[key]);
    card.append(list);
    return card;
  }));
  field("list-previous").disabled = pageNumber === 0;
  field("list-next").disabled = start + 24 >= matches.length;
}
function download(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = node("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function navigate(id, archive = showingArchive) {
  if (busy) return;
  if (!await discardEdits()) return;
  try {
    workspace = store.read();
    if (!workspace) throw new Error("Workspace missing. Sign out and sign in again.");
    dirty = false;
    clearError("workspace-error");
    workspaceStatus();
    if (id === "tasks-step") {
      if (showingArchive !== archive) setTaskView(archive);
      renderCards();
    }
    if (id === "list-step") { pageNumber = 0; renderList(); }
    screen(id);
  } catch (error) { errorAt("workspace-error", error); }
}
function signOut() {
  signedIn = false;
  dirty = false;
  selected = null;
  workspace = null;
  field("demo-login").reset();
  field("workspace").hidden = true;
  field("login-step").hidden = false;
  field("task-list").replaceChildren();
  field("request-info").replaceChildren();
  field("editor-fields").replaceChildren();
  field("comparison-body").replaceChildren();
  field("request-history").replaceChildren();
  field("demo-username").focus();
}

for (const id of ["task-assignee", "assignee-filter"]) {
  for (const name of ASSIGNEES) field(id).add(new Option(name, name));
}
field("demo-login").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  const username = field("demo-username").value;
  const password = field("demo-password").value;
  field("demo-password").value = "";
  field("login-error").textContent = "";
  clearError("workspace-error");
  if (username !== "linercodelists" || password !== "SMDGLCL2026") {
    field("login-error").textContent = "The demo username or password is incorrect.";
    field("demo-password").focus();
    return;
  }
  busy = true;
  field("demo-sign-in").disabled = true;
  try {
    workspace = await store.initialize(await loadSnapshot());
    signedIn = true;
    field("demo-login").reset();
    field("login-step").hidden = true;
    field("workspace").hidden = false;
    dirty = false;
    setTaskView(false);
    const id = new URL(location.href).searchParams.get("request");
    if (id && workspace.requests.some(request => request.id === id)) {
      selected = workspace.requests.find(request => request.id === id);
      setTaskView(isClosed(selected));
      clearError("detail-error");
      renderDetail();
      screen("detail-step");
    }
    else { renderCards(); screen("tasks-step"); }
    workspaceStatus();
  } catch (error) { errorAt("workspace-error", error); }
  finally { busy = false; field("demo-sign-in").disabled = false; }
});
field("reviewer-sign-out").addEventListener("click", async () => {
  if (!busy && await discardEdits()) signOut();
});
field("show-tasks").addEventListener("click", () => navigate("tasks-step", false));
field("show-archive").addEventListener("click", () => navigate("tasks-step", true));
field("back-to-tasks").addEventListener("click", () => navigate("tasks-step"));
field("show-list").addEventListener("click", () => navigate("list-step"));
for (const id of ["task-search", "status-filter", "assignee-filter"]) field(id).addEventListener("input", renderCards);
field("save-assignment").addEventListener("click", () => perform("assign"));
field("delete-request").addEventListener("click", removeRequest);
field("task-assignee").addEventListener("change", () => { dirty = true; });
field("review-editor").addEventListener("submit", event => { event.preventDefault(); perform("publish"); });
for (const button of document.querySelectorAll("[data-action]")) button.addEventListener("click", () => perform(button.dataset.action));
field("editor-fields").addEventListener("input", event => {
  dirty = true;
  if (["code", "unCountryCode", "unLocode"].includes(event.target.name)) event.target.value = event.target.value.toUpperCase();
  compareValues();
});
field("reviewer-note").addEventListener("input", () => { dirty = true; });
field("list-search").addEventListener("input", () => { pageNumber = 0; renderList(); });
field("list-previous").addEventListener("click", () => { pageNumber--; renderList(); });
field("list-next").addEventListener("click", () => { pageNumber++; renderList(); });
field("export-list").addEventListener("click", () => download(workspace.records, "smdg-demo-liner-codes.json"));
window.addEventListener("storage", event => {
  if (event.key === WORKSPACE_KEY && signedIn) {
    errorAt("workspace-error", new Error("This workspace changed in another tab. Reopen Active tasks or Archive to load the latest data. Unsaved edits have not been overwritten."));
  }
});
window.addEventListener("beforeunload", event => {
  if (dirty) { event.preventDefault(); event.returnValue = ""; }
});
window.addEventListener("pagehide", signOut);
field("demo-sign-in").disabled = false;
