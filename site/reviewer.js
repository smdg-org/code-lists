import { prefill, validateRequest, validateRecords } from "./core.js";
import { countries } from "./countries.js";
import { linkedValue, websiteShortcut } from "./links.js";
import {
  DemoStore, WORKSPACE_KEY, ASSIGNEES, STATUSES, LABELS, RECORD_FIELDS,
  actOnRequest, deleteRequest, conflict, isClosed, cleanValues,
  CODE_STATUSES, DIRECT_FIELDS, directValues, validateDirectEdit, publishDirectEdit
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
let directBaseline;
let directPage = 0;

function node(tag, value, className) {
  const element = document.createElement(tag);
  if (value !== undefined) element.textContent = value;
  if (className) element.className = className;
  return element;
}
function statusBadge(status, text = status) {
  const badge = node("span", text, "status-badge");
  badge.dataset.status = status;
  return badge;
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
function confirmAction(title, message, values, deleting = false, acceptLabel = "Confirm") {
  field("confirm-title").textContent = title;
  field("delete-warning").hidden = !deleting;
  field("confirm-accept").textContent = deleting ? "Delete permanently" : acceptLabel;
  field("confirm-accept").classList.toggle("danger", deleting);
  field("confirm-body").replaceChildren(node("p", message));
  if (values) {
    const list = node("dl", undefined, "review-summary");
    for (const key of DIRECT_FIELDS.filter(key => key in values)) addInfo(list, LABELS[key], values[key]);
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
  for (const name of ["tasks-step", "detail-step", "list-step", "direct-step"]) field(name).hidden = name !== id;
  const taskView = id === "tasks-step" || id === "detail-step";
  field("show-tasks").setAttribute("aria-pressed", String(taskView && !showingArchive));
  field("show-archive").setAttribute("aria-pressed", String(taskView && showingArchive));
  field("show-list").setAttribute("aria-pressed", String(id === "list-step"));
  field("show-direct").setAttribute("aria-pressed", String(id === "direct-step"));
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
    statusBadge(value, `${value}: ${scopedRequests.filter(request => request.status === value).length}`)));
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
    const assignment = node("p", "Assigned to: ");
    assignment.append(node("span", request.assignee || "Unassigned", request.assignee ? "" : "unassigned-label"));
    card.append(
      statusBadge(request.status),
      node("p", `${request.reference} | ${request.mode.toUpperCase()} | LINER CODES`, "eyebrow"),
      node("h3", `${request.submitted.code} - ${request.proposal.linerName}`),
      node("p", request.submitted.reason || "New liner code request"),
      assignment,
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
function renderFields(container, keys, values, required, prefix) {
  container.replaceChildren();
  for (const key of keys) {
    const wrapper = node("div", undefined, "field");
    const label = node("label", LABELS[key]);
    label.htmlFor = `${prefix}-${key}`;
    let input;
    if (["carrierType", "country", "codeStatus"].includes(key)) {
      input = node("select");
      input.add(new Option("----- Select -----", ""));
      const options = key === "country" ? countries.map(item => item.name)
        : key === "codeStatus" ? [...CODE_STATUSES] : ["NVOCC", "VOCC"];
      const existing = values[key];
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
    input.value = values[key] || "";
    input.required = required.includes(key);
    wrapper.append(label, input);
    if (key === "website") websiteShortcut(input);
    container.append(wrapper);
  }
}
function renderDetail(draft, note = "") {
  const request = selected;
  const closed = isClosed(request);
  field("delete-request").hidden = !closed;
  const heading = node("h2", `${request.reference}: ${request.mode.toUpperCase()} ${request.proposal.code}`);
  heading.id = "detail-title";
  field("request-heading").replaceChildren(heading, statusBadge(request.status));
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
  renderFields(field("editor-fields"), editable, draft ?? request.proposal, required, "edit");
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
    if (!isClosed(selected)) throw new Error("Only archived requests can be deleted. Publish or reject the request first.");
    if (!await confirmAction("Permanently delete this archived request?",
      `Please confirm the permanent deletion of ${reference}. Any changes already published to the demo code list will remain; deleting a request does not undo publication.`,
      undefined, true)) return;
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
function renderDirectList() {
  const query = field("direct-search").value.trim().toLowerCase();
  const matches = workspace.records.filter(record =>
    `${record.linerSMDGCode} ${record.linerName}`.toLowerCase().includes(query));
  const start = directPage * 24;
  field("direct-count").textContent = `${matches.length} matching codes | Page ${directPage + 1} of ${Math.max(1, Math.ceil(matches.length / 24))}`;
  field("direct-records").replaceChildren(...matches.slice(start, start + 24).map(record => {
    const card = node("article", undefined, "record-card");
    const history = workspace.directEdits.filter(entry => entry.after.linerSMDGCode === record.linerSMDGCode).at(-1);
    card.append(node("h3", `${record.linerSMDGCode} - ${record.linerName}`),
      node("p", `Status: ${record.codeStatus || "Not provided"}`),
      node("p", `Last update: ${history ? displayDate(history.at) :
        (record.changeLogs ?? []).map(log => log.lastUpdateDate).filter(Boolean).sort().at(-1) || "Not provided"}`, "hint"));
    const button = node("button", `Edit ${record.linerSMDGCode}`);
    button.addEventListener("click", () => openDirect(record.linerSMDGCode));
    card.append(button);
    return card;
  }));
  field("direct-previous").disabled = directPage === 0;
  field("direct-next").disabled = start + 24 >= matches.length;
}
function directEditorValues() {
  return Object.fromEntries([...field("direct-fields").querySelectorAll("[name]")].map(input => [input.name, input.value]));
}
function directChanges(values) {
  const before = directValues(directBaseline);
  return DIRECT_FIELDS.filter(key => (before[key] || "") !== (values[key] || ""));
}
function compareDirect() {
  const values = directEditorValues();
  const before = directValues(directBaseline);
  const changed = directChanges(values);
  field("direct-changes-count").textContent = `${changed.length} changed fields`;
  field("direct-comparison").replaceChildren(...changed.map(key => {
    const row = node("tr", undefined, "changed");
    const label = node("th", LABELS[key]);
    label.scope = "row";
    row.append(label, linkedValue(node("td"), key, before[key]), linkedValue(node("td"), key, values[key]));
    return row;
  }));
}
async function openDirect(code) {
  if (busy || !await discardEdits()) return;
  try {
    const current = store.read();
    if (!current || current.id !== workspace.id) throw new Error("The workspace was replaced. Sign out and sign in again.");
    const record = current.records.find(item => item.linerSMDGCode === code);
    if (!record) throw new Error("This record was removed. Reopen Edit current data.");
    workspace = current;
    directBaseline = structuredClone(record);
    dirty = false;
    clearError("direct-error");
    field("direct-heading").textContent = `Edit ${code} - ${record.linerName}`;
    field("direct-editor").reset();
    field("direct-fields").replaceChildren();
    const required = ["linerName", "carrierType", "street", "postCode", "city", "state", "country", "website", "codeStatus"];
    for (const [title, keys] of [
      ["Company details", ["code", "linerName", "parentCompany"]],
      ["Website and carrier type", ["website", "carrierType"]],
      ["Address and UN/LOCODE", ["street", "streetNumber", "floor", "postCode", "city", "state", "country", "unCountryCode", "unLocode"]],
      ["Validity, status and remarks", ["validFrom", "validTo", "codeStatus", "remarks"]]
    ]) {
      const group = node("fieldset", undefined, "panel grid");
      renderFields(group, keys, directValues(record), required, "direct");
      group.prepend(node("legend", title));
      field("direct-fields").append(group);
    }
    field("direct-history").replaceChildren(...workspace.directEdits
      .filter(entry => entry.after.linerSMDGCode === code).slice().reverse().map(entry => {
        const item = node("li");
        item.append(node("strong", `${displayDate(entry.at)} | ${entry.actor}`), node("p", entry.reason));
        const before = directValues(entry.before);
        const after = directValues(entry.after);
        for (const key of DIRECT_FIELDS.filter(key => before[key] !== after[key])) {
          item.append(node("p", `${LABELS[key]}: ${before[key] || "Not provided"} -> ${after[key] || "Not provided"}`));
        }
        return item;
      }));
    field("direct-picker").hidden = true;
    field("direct-editor").hidden = false;
    compareDirect();
    field("direct-linerName").focus();
  } catch (error) { errorAt("direct-error", error); field("direct-error").focus(); }
}
async function publishDirect() {
  if (busy || !signedIn) return;
  busy = true;
  clearError("direct-error");
  try {
    const workspaceId = workspace.id;
    const baseline = structuredClone(directBaseline);
    const actor = field("direct-reviewer").value;
    const reason = field("direct-reason").value.trim();
    const values = directEditorValues();
    const proposal = validateDirectEdit(workspace, baseline, values, actor, reason);
    const before = directValues(baseline);
    const changes = Object.fromEntries(directChanges(proposal).map(key =>
      [key, `${before[key] || "Not provided"} -> ${proposal[key] || "Not provided"}`]));
    if (!await confirmAction(`Publish changes to ${proposal.code}?`,
      `Reviewer: ${actor}. Reason: ${reason}. Only the browser-local demo list will change. No official data changes.`,
      changes, false, "Publish to demo list")) return;
    field("workspace").inert = true;
    workspace = await store.update(workspaceId, current => publishDirectEdit(current, baseline, values, actor, reason));
    dirty = false;
    busy = false;
    await openDirect(proposal.code);
    workspaceStatus(`${proposal.code} published to the demo list by ${actor}. No official data changed.`);
  } catch (error) {
    errorAt("direct-error", error);
    field("direct-error").focus();
    workspaceStatus("Changes were not published. Your entries are retained.");
  } finally {
    busy = false;
    field("workspace").inert = false;
  }
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
    if (id === "direct-step") {
      directBaseline = null;
      directPage = 0;
      field("direct-picker").hidden = false;
      field("direct-editor").hidden = true;
      field("direct-editor").reset();
      clearError("direct-error");
      renderDirectList();
    }
    screen(id);
  } catch (error) { errorAt("workspace-error", error); }
}
function signOut() {
  signedIn = false;
  dirty = false;
  selected = null;
  workspace = null;
  directBaseline = null;
  field("demo-login").reset();
  field("workspace").hidden = true;
  field("login-step").hidden = false;
  field("task-list").replaceChildren();
  field("request-info").replaceChildren();
  field("editor-fields").replaceChildren();
  field("comparison-body").replaceChildren();
  field("request-history").replaceChildren();
  field("direct-fields").replaceChildren();
  field("direct-records").replaceChildren();
  field("direct-history").replaceChildren();
  field("direct-editor").reset();
  field("direct-editor").hidden = true;
  field("demo-username").focus();
}

for (const id of ["task-assignee", "assignee-filter"]) {
  for (const name of ASSIGNEES) field(id).add(new Option(name, name));
}
for (const name of ASSIGNEES) field("direct-reviewer").add(new Option(name, name));
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
field("show-direct").addEventListener("click", () => navigate("direct-step"));
field("direct-search").addEventListener("input", () => { directPage = 0; renderDirectList(); });
field("direct-previous").addEventListener("click", () => { directPage--; renderDirectList(); });
field("direct-next").addEventListener("click", () => { directPage++; renderDirectList(); });
field("direct-cancel").addEventListener("click", () => navigate("direct-step"));
field("direct-reload").addEventListener("click", () => openDirect(directBaseline.linerSMDGCode));
field("direct-editor").addEventListener("submit", event => { event.preventDefault(); publishDirect(); });
field("direct-editor").addEventListener("input", event => {
  dirty = true;
  if (["unCountryCode", "unLocode"].includes(event.target.name)) event.target.value = event.target.value.toUpperCase();
  compareDirect();
});
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
