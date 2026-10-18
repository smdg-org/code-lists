import { normalizeCode, prefill, validateRecords, validateRequest } from "./core.js";
import { countries } from "./countries.js";
import { DemoStore, submitRequest, WORKSPACE_KEY } from "./workflow.js";

const form = document.querySelector("#request-form");
const controls = document.querySelector("#form-controls");
const result = document.querySelector("#validation-result");
const selector = document.querySelector("#existing-code");
const nameSelector = document.querySelector("#existing-name");
const countrySelect = document.querySelector("#country");
const field = id => document.getElementById(id);
let records = [];
let mode = "add";
let demo = new URL(location.href).searchParams.get("demo") === "1";
let workspace;
let pendingRequest;
const store = new DemoStore();
field("workflow-demo").checked = demo;

function demoCopy() {
  field("preview-notice").hidden = demo;
  field("refresh-demo-list").hidden = !demo;
  field("contact-help").textContent = demo
    ? "Use fictional details only. Name and email are saved in this browser for request handling, never included in the demo public code list. No email is sent."
    : "Information will not be saved and will be used only for contact purposes. This preview does not send it.";
  field("submission-help").textContent = demo ? "Saves a test request in this browser only" : "No submission or saving";
  field("summary-help").textContent = demo
    ? "Check the details. Submit saves this test request and fictional contacts in this browser for review, not to SMDG."
    : "Check the details below. Submitting this preview will not send or save anything.";
  field("summary-submit").textContent = demo ? "Submit test request" : "Submit";
  field("delete-help").textContent = demo
    ? "Submitting creates a local deletion request. Only demo reviewer publication removes it from the local demo list; official data never changes."
    : "This is a deletion-request preview only. No record will be removed or marked for deletion.";
}

for (const country of countries) {
  countrySelect.add(new Option(country.name, country.name));
}
for (const input of form.querySelectorAll("[name]:not([type=radio])")) {
  if (input.name === "code") continue;
  const error = document.createElement("span");
  error.id = `${input.id}-error`;
  error.className = "error";
  error.setAttribute("aria-live", "polite");
  input.setAttribute("aria-describedby", [input.getAttribute("aria-describedby"), error.id].filter(Boolean).join(" "));
  input.closest(".field").append(error);
}

function clearFeedback() {
  result.hidden = true;
  result.classList.remove("has-errors");
  result.replaceChildren();
  for (const error of form.querySelectorAll(".error")) error.textContent = "";
  for (const input of form.querySelectorAll("[aria-invalid]")) input.removeAttribute("aria-invalid");
}

function showCodeOptions() {
  const selected = selector.value;
  selector.replaceChildren(new Option("----- Select a code -----", ""));
  nameSelector.replaceChildren(new Option("----- Select a name -----", ""));
  for (const record of records) {
    selector.add(new Option(record.linerSMDGCode, record.linerSMDGCode));
  }
  for (const record of records.slice().sort((a, b) =>
    a.linerName.localeCompare(b.linerName, "en") || a.linerSMDGCode.localeCompare(b.linerSMDGCode, "en"))) {
    nameSelector.add(new Option(record.linerName, record.linerSMDGCode));
  }
  selector.value = selected;
  nameSelector.value = selected;
}

function renderMode() {
  pendingRequest = null;
  form.reset();
  form.hidden = false;
  field("demo-confirmation").hidden = true;
  field("summary-submit").disabled = false;
  field("entry-step").hidden = false;
  field("review-step").hidden = true;
  field("submit-result").hidden = true;
  field("country").querySelectorAll("[data-existing]").forEach(option => option.remove());
  form.querySelector(`[name=mode][value=${mode}]`).checked = true;
  selector.value = "";
  nameSelector.value = "";
  showCodeOptions();
  clearFeedback();
  const isAdd = mode === "add";
  const isDelete = mode === "delete";
  field("existing-section").hidden = isAdd;
  field("details").hidden = !isAdd;
  field("actions").hidden = !isAdd;
  field("code").readOnly = !isAdd;
  field("company-section").hidden = isDelete;
  field("address-section").hidden = isDelete;
  field("additional-section").hidden = isDelete;
  field("delete-summary").hidden = !isDelete;
  field("reason-section").hidden = isAdd;
  field("reason-label").textContent = isDelete ? "Delete reason" : "Change reason";
  field("comments-label").textContent = isDelete ? "Delete comments (optional)" : "Change comments (optional)";
  field("reason").required = !isAdd;
  field("validFrom").required = isAdd;
  field("details-title").textContent = isAdd ? "2. Liner details" : "3. Amend liner details";
}

function renderSummary(requestValues) {
  const labels = {
    mode: "Request type",
    code: "Liner code",
    linerName: "Liner name",
    carrierType: "Carrier type",
    parentCompany: "Parent company",
    unCountryCode: "UN Country Code",
    unLocode: "UN/LOCODE location part",
    website: "Website",
    street: "Street",
    streetNumber: "Street number",
    floor: "Building / Floor",
    postCode: "Postal code",
    city: "City",
    state: "Area",
    country: "Country",
    validFrom: "Valid From",
    validTo: "Valid To",
    remarks: "Remarks",
    reason: mode === "delete" ? "Delete reason" : "Change reason",
    comments: mode === "delete" ? "Delete comments" : "Change comments",
    contactName: "Contact name",
    contactEmail: "Contact email"
  };
  const fields = mode === "delete"
    ? ["mode", "code", "linerName", "reason", "comments", "contactName", "contactEmail"]
    : ["mode", "code", "linerName", "carrierType", "parentCompany", "website",
      "unCountryCode", "unLocode", "street", "streetNumber", "floor", "postCode",
      "city", "state", "country", "validFrom", "validTo", "remarks",
      ...(mode === "update" ? ["reason", "comments"] : []), "contactName", "contactEmail"];
  const summary = field("review-summary");
  const original = mode === "update"
    ? prefill(records.find(record => record.linerSMDGCode === requestValues.code))
    : {};
  summary.replaceChildren();
  for (const name of fields) {
    const term = document.createElement("dt");
    term.textContent = labels[name];
    const description = document.createElement("dd");
    description.textContent = name === "mode"
      ? { add: "Add a code", update: "Update a code", delete: "Delete a code" }[mode]
      : requestValues[name] || "Not provided";
    if (Object.hasOwn(original, name) && String(original[name]).trim() !== requestValues[name]) {
      term.classList.add("changed");
      description.classList.add("changed");
      const marker = document.createElement("strong");
      marker.className = "change-marker";
      marker.textContent = "Changed";
      const previous = document.createElement("span");
      previous.className = "previous-value";
      previous.textContent = `Previously: ${original[name] || "Not provided"}`;
      description.prepend(marker);
      description.append(previous);
    }
    summary.append(term, description);
  }
}

function showError(name, message) {
  const target = name === "code" && mode !== "add" ? selector : field(name);
  const error = name === "code" ? field(mode === "add" ? "new-code-error" : "code-error") : field(`${name}-error`);
  if (target && error) {
    error.textContent = message;
    if (message) target.setAttribute("aria-invalid", "true");
    else target.removeAttribute("aria-invalid");
    if (name === "code" && mode !== "add") {
      if (message) nameSelector.setAttribute("aria-invalid", "true");
      else nameSelector.removeAttribute("aria-invalid");
    }
  }
}

function values() {
  const data = Object.fromEntries(new FormData(form));
  for (const [key, value] of Object.entries(data)) data[key] = value.trim();
  data.code = normalizeCode(mode === "add" ? data.code : selector.value);
  return data;
}

async function load() {
  field("workflow-demo").disabled = true;
  controls.disabled = true;
  field("retry").hidden = true;
  field("data-status").textContent = "Loading the public code-list snapshot...";
  try {
    const response = await fetch("./data/_combined.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const snapshot = validateRecords(await response.json());
    workspace = demo ? await store.initialize(snapshot) : null;
    records = (demo ? workspace.records : snapshot).slice()
      .sort((a, b) => a.linerSMDGCode.localeCompare(b.linerSMDGCode, "en"));
    demoCopy();
    renderMode();
    controls.disabled = false;
    field("data-status").textContent =
      demo ? `${records.length} codes loaded from the browser-local demo list. Requests and fictional contacts will be saved locally.` :
        `${records.length} codes loaded from this deployment's public combined-list snapshot. This is not a live registry check.`;
  } catch (error) {
    field("data-status").textContent = `Code list could not be loaded: ${error.message}. Validation is disabled to avoid missing duplicates.`;
    field("retry").hidden = false;
  } finally {
    field("workflow-demo").disabled = false;
  }
}

form.addEventListener("change", event => {
  if (event.target.name === "mode") {
    mode = event.target.value;
    renderMode();
  }
});
function selectRecord(code) {
  clearFeedback();
  selector.value = code;
  nameSelector.value = code;
  const record = records.find(item => item.linerSMDGCode === code);
  field("details").hidden = !record;
  field("actions").hidden = !record;
  field("reason").value = "";
  field("comments").value = "";
  if (!record) return;
  countrySelect.querySelectorAll("[data-existing]").forEach(option => option.remove());
  const initial = prefill(record);
  if (initial.country && !countries.some(country => country.name === initial.country)) {
    const option = new Option(`${initial.country} (existing value)`, initial.country);
    option.dataset.existing = "true";
    countrySelect.add(option);
  }
  for (const [name, value] of Object.entries(initial)) {
    const input = field(name);
    if (name === "carrierType" && value && !["NVOCC", "VOCC"].includes(value)) {
      input.value = "";
    } else input.value = value;
  }
  field("selected-liner").textContent = `${record.linerSMDGCode} - ${record.linerName}`;
}
selector.addEventListener("change", () => selectRecord(selector.value));
nameSelector.addEventListener("change", () => selectRecord(nameSelector.value));
form.addEventListener("input", event => {
  result.hidden = true;
  if (["code", "unLocode", "unCountryCode"].includes(event.target.name)) {
    event.target.value = event.target.value.toUpperCase();
  }
  if (event.target.name === "code" && mode === "add") {
    const code = normalizeCode(event.target.value);
    const errors = validateRequest(mode, values(), records);
    showError("code", code ? errors.code ?? "" : "");
  } else if (event.target.name) {
    showError(event.target.name, "");
  }
});
form.addEventListener("submit", event => {
  event.preventDefault();
  if (controls.disabled) return;
  clearFeedback();
  const requestValues = values();
  const errors = validateRequest(mode, requestValues, records);
  for (const [name, message] of Object.entries(errors)) showError(name, message);
  const count = Object.keys(errors).length;
  if (count) {
    result.classList.add("has-errors");
    const title = document.createElement("strong");
    title.textContent = `Please correct ${count} field${count === 1 ? "" : "s"}.`;
    result.append(title);
    const list = document.createElement("ul");
    for (const message of Object.values(errors)) {
      const item = document.createElement("li");
      item.textContent = message;
      list.append(item);
    }
    result.append(list);
    result.hidden = false;
    result.focus();
    return;
  }
  renderSummary(requestValues);
  pendingRequest = {
    mode, values: structuredClone(requestValues),
    baseline: structuredClone(records.find(record => record.linerSMDGCode === requestValues.code) ?? null),
    workspaceId: workspace?.id
  };
  field("entry-step").hidden = true;
  field("review-step").hidden = false;
  field("review-step").focus();
});
field("back-to-form").addEventListener("click", () => {
  field("review-step").hidden = true;
  field("entry-step").hidden = false;
  field("submit-result").hidden = true;
  field("actions").querySelector('[type="submit"]').focus();
});
field("summary-submit").addEventListener("click", async () => {
  const message = field("submit-result");
  if (demo) {
    field("summary-submit").disabled = true;
    field("back-to-form").disabled = true;
    field("workflow-demo").disabled = true;
    field("refresh-demo-list").disabled = true;
    try {
      if (!pendingRequest) throw new Error("Return to the form and review your request again.");
      const pending = pendingRequest;
      let saved;
      workspace = await store.update(pending.workspaceId, current => {
        saved = submitRequest(current, pending.mode, pending.values, pending.baseline);
      });
      form.hidden = true;
      field("demo-confirmation").hidden = false;
      field("confirmation-reference").textContent = `Reference: ${saved.reference} | ${saved.mode.toUpperCase()} ${saved.submitted.code}`;
      field("open-saved-request").href = `reviewer.html?request=${encodeURIComponent(saved.id)}`;
      field("demo-confirmation").focus();
    } catch (error) {
      message.textContent = `Test request was not saved: ${error.message} Your entries are retained. Go Back and refresh the demo list if needed, then review again.`;
      message.hidden = false;
    } finally {
      field("summary-submit").disabled = false;
      field("back-to-form").disabled = false;
      field("workflow-demo").disabled = false;
      field("refresh-demo-list").disabled = false;
    }
    return;
  }
  message.textContent = "This preview did not submit, send or save your request.";
  message.hidden = false;
});
field("clear").addEventListener("click", renderMode);
field("retry").addEventListener("click", load);
field("workflow-demo").addEventListener("change", () => {
  demo = field("workflow-demo").checked;
  load();
});
function refreshDemoList() {
  const current = store.read();
  if (!current) throw new Error("Demo workspace missing. Enable the workflow demo again to initialize it.");
  workspace = current;
  records = current.records;
  showCodeOptions();
  field("data-status").textContent = `${records.length} demo codes loaded. Entries retained. Review the current values again before submitting.`;
}
field("refresh-demo-list").addEventListener("click", () => {
  try {
    refreshDemoList();
    pendingRequest = null;
    field("review-step").hidden = true;
    field("entry-step").hidden = false;
  } catch (error) {
    field("data-status").textContent = `Could not refresh demo data: ${error.message}`;
  }
});
field("submit-another").addEventListener("click", () => {
  try { refreshDemoList(); renderMode(); }
  catch (error) { field("data-status").textContent = `Could not start another request: ${error.message}`; }
});
window.addEventListener("storage", event => {
  if (demo && event.key === WORKSPACE_KEY) field("data-status").textContent =
    "The demo workspace changed in another tab. Entries are retained; refresh the demo list and review again before submitting.";
});
demoCopy();
load();
