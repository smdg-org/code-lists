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
  const errors = validateRequest(mode, values(), records);
  for (const [name, message] of Object.entries(errors)) showError(name, message);
  const count = Object.keys(errors).length;
  result.classList.toggle("has-errors", count > 0);
  const title = document.createElement("strong");
  title.textContent = count ? `Please correct ${count} field${count === 1 ? "" : "s"}.` : "Preview validation passed.";
  result.append(title);
  if (count) {
    const list = document.createElement("ul");
    for (const message of Object.values(errors)) {
      const item = document.createElement("li");
      item.textContent = message;
      list.append(item);
    }
    result.append(list);
  }
  const reminder = document.createElement("p");
  reminder.textContent = "Nothing was submitted, saved, added, updated or deleted.";
  result.append(reminder);
  result.hidden = false;
  result.focus();
});
field("clear").addEventListener("click", renderMode);
field("retry").addEventListener("click", load);
load();
