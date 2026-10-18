import { normalizeCode, prefill, validateRecords, validateRequest } from "./core.js";
import { countries } from "./countries.js";

const form = document.querySelector("#request-form");
const controls = document.querySelector("#form-controls");
const result = document.querySelector("#validation-result");
const selector = document.querySelector("#existing-code");
const nameSelector = document.querySelector("#existing-name");
const countrySelect = document.querySelector("#country");
const field = id => document.getElementById(id);
let records = [];
let mode = "add";

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
  form.reset();
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
  summary.replaceChildren();
  for (const name of fields) {
    const term = document.createElement("dt");
    term.textContent = labels[name];
    const description = document.createElement("dd");
    description.textContent = name === "mode"
      ? { add: "Add a code", update: "Update a code", delete: "Delete a code" }[mode]
      : requestValues[name] || "Not provided";
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
  controls.disabled = true;
  field("retry").hidden = true;
  field("data-status").textContent = "Loading the public code-list snapshot...";
  try {
    const response = await fetch("./data/_combined.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    records = validateRecords(await response.json()).slice()
      .sort((a, b) => a.linerSMDGCode.localeCompare(b.linerSMDGCode, "en"));
    renderMode();
    controls.disabled = false;
    field("data-status").textContent =
      `${records.length} codes loaded from this deployment's public combined-list snapshot. This is not a live registry check.`;
  } catch (error) {
    field("data-status").textContent = `Code list could not be loaded: ${error.message}. Validation is disabled to avoid missing duplicates.`;
    field("retry").hidden = false;
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
field("summary-submit").addEventListener("click", () => {
  const message = field("submit-result");
  message.textContent = "This preview did not submit, send or save your request.";
  message.hidden = false;
});
field("clear").addEventListener("click", renderMode);
field("retry").addEventListener("click", load);
load();
