import { prefill, validateRecords } from "./core.js";
import { linkedValue } from "./links.js";
import { downloadExcel } from "./excel-export.js";

const field = id => document.getElementById(id);
const pageSize = 25;
let records = [];
let page = 0;
let openCode;

const statusLabels = {
  Active: "Active", Expired: "Expired", MarkedForDeletion: "Marked for deletion"
};
const statusLabel = record => statusLabels[record.codeStatus] ?? record.codeStatus ?? "Not provided";
const countryOf = record => record.addressLocation?.address?.country || "";
const searchWords = () => field("list-search").value.trim().toLocaleLowerCase("en").split(/\s+/).filter(Boolean);
const selectedStatus = () => field("status-cards").querySelector("[aria-pressed='true']").dataset.status;

function setStatus(status) {
  for (const card of field("status-cards").querySelectorAll(".status-card")) {
    card.setAttribute("aria-pressed", String(card.dataset.status === status));
  }
}

// Every search word must appear in the code, liner name or country.
function matchesSearch(record, words) {
  const text = `${record.linerSMDGCode} ${record.linerName} ${countryOf(record)}`.toLocaleLowerCase("en");
  return words.every(word => text.includes(word));
}

// Builds text with each search word wrapped in <mark>, without parsing any HTML.
function highlighted(text, words) {
  const fragment = document.createDocumentFragment();
  const lower = text.toLocaleLowerCase("en");
  const ranges = [];
  for (const word of words) {
    for (let index = lower.indexOf(word); index !== -1; index = lower.indexOf(word, index + word.length)) {
      ranges.push([index, index + word.length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let position = 0;
  for (const [start, end] of ranges) {
    if (start < position) continue;
    fragment.append(text.slice(position, start));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(start, end);
    fragment.append(mark);
    position = end;
  }
  fragment.append(text.slice(position));
  return fragment;
}

function statusBadge(record) {
  const badge = document.createElement("span");
  badge.className = "code-status";
  badge.dataset.status = record.codeStatus ?? "";
  badge.textContent = statusLabel(record);
  return badge;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const friendlyDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : value;

// One titled group of label/value pairs; empty values show as "-".
function detailGroup(title, fields) {
  const group = document.createElement("section");
  group.className = "record-group";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("dl");
  list.className = "record-details";
  for (const [label, value, name] of fields) {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    linkedValue(description, name, value || "-");
    item.append(term, description);
    list.append(item);
  }
  group.append(heading, list);
  return group;
}

// Code, name and status are already shown in the row, so the details start with the rest.
function detailList(record) {
  const values = prefill(record);
  const groups = document.createElement("div");
  groups.className = "record-groups";
  groups.append(
    detailGroup("Liner details", [
      ["Carrier type", values.carrierType], ["Parent company", values.parentCompany],
      ["Website", values.website, "website"], ["Version", record.linerCodeVersion],
      ["Valid from", friendlyDate(values.validFrom)], ["Valid to", friendlyDate(values.validTo)]
    ]),
    detailGroup("Head-office address", [
      ["Street", values.street], ["Street number", values.streetNumber], ["Building / Floor", values.floor],
      ["Postal code", values.postCode], ["City", values.city],
      ["Area (state / region / province)", values.state], ["Country", values.country],
      ["UN/LOCODE", `${values.unCountryCode.trim()}${values.unLocode.trim()}`]
    ])
  );
  return groups;
}

function codeRow(record, words) {
  const row = document.createElement("details");
  row.className = "code-row";
  row.dataset.code = record.linerSMDGCode;
  const summary = document.createElement("summary");
  const code = document.createElement("span");
  code.className = "code-row__code";
  code.append(highlighted(record.linerSMDGCode, words));
  const name = document.createElement("span");
  name.className = "code-row__name";
  name.append(highlighted(record.linerName, words));
  const country = document.createElement("span");
  country.className = "code-row__country";
  country.append(highlighted(countryOf(record) || "Not provided", words));
  const chevron = document.createElement("span");
  chevron.className = "code-row__chevron";
  chevron.setAttribute("aria-hidden", "true");
  summary.append(code, name, country, statusBadge(record), chevron);
  row.append(summary);
  row.addEventListener("toggle", () => {
    if (row.open) {
      if (!row.querySelector(".code-row__body")) {
        const body = document.createElement("div");
        body.className = "code-row__body";
        body.append(detailList(record));
        row.append(body);
      }
      for (const other of field("list-rows").querySelectorAll("details[open]")) if (other !== row) other.open = false;
      openCode = record.linerSMDGCode;
    } else if (openCode === record.linerSMDGCode) {
      openCode = undefined;
    }
    updateUrl();
  });
  return row;
}

function filtered() {
  const words = searchWords();
  const searched = records.filter(record => matchesSearch(record, words));
  for (const counter of field("status-cards").querySelectorAll("[data-count]")) {
    const status = counter.dataset.count;
    counter.textContent = searched.filter(record => !status || record.codeStatus === status).length;
  }
  const status = selectedStatus();
  const matches = searched.filter(record => !status || record.codeStatus === status);
  const sortByName = field("list-sort").value === "name";
  matches.sort((a, b) =>
    (sortByName ? a.linerName.localeCompare(b.linerName, "en") : 0)
    || a.linerSMDGCode.localeCompare(b.linerSMDGCode, "en"));
  return { words, matches };
}

function render() {
  const { words, matches } = filtered();
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  page = Math.min(page, pages - 1);
  const start = page * pageSize;
  const visible = matches.slice(start, start + pageSize);
  openCode = undefined;
  const rows = document.createDocumentFragment();
  for (const record of visible) rows.append(codeRow(record, words));
  field("list-rows").replaceChildren(rows);
  field("list-message").textContent = matches.length
    ? `${matches.length} of ${records.length} codes. Showing ${start + 1}-${start + visible.length}.`
    : `No codes match your search (${records.length} codes in the list). Try another search or choose All codes.`;
  field("list-results").hidden = matches.length === 0;
  field("list-page").textContent = `Page ${page + 1} of ${pages}`;
  field("list-previous").disabled = page === 0;
  field("list-next").disabled = start + pageSize >= matches.length;
  field("list-results").querySelector(".pager").hidden = pages === 1;
  updateUrl();
}

// Keeps the search, filter, sort, page and open record in the address so a view can be shared.
function updateUrl() {
  const params = new URLSearchParams();
  const query = field("list-search").value.trim();
  if (query) params.set("q", query);
  if (selectedStatus()) params.set("status", selectedStatus());
  if (field("list-sort").value !== "code") params.set("sort", field("list-sort").value);
  if (page) params.set("page", String(page + 1));
  if (openCode) params.set("code", openCode);
  const search = params.toString();
  history.replaceState(null, "", search ? `?${search}` : location.pathname);
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  field("list-search").value = params.get("q") ?? "";
  setStatus(Object.hasOwn(statusLabels, params.get("status") ?? "") ? params.get("status") : "");
  field("list-sort").value = params.get("sort") === "name" ? "name" : "code";
  page = Math.max(0, (Number.parseInt(params.get("page"), 10) || 1) - 1);
  return params.get("code")?.toUpperCase();
}

// Opens a linked record, clearing the search and filter if they would hide it.
function openLinked(code) {
  if (!records.some(record => record.linerSMDGCode === code)) return;
  let index = filtered().matches.findIndex(record => record.linerSMDGCode === code);
  if (index === -1) {
    field("list-search").value = "";
    setStatus("");
    index = filtered().matches.findIndex(record => record.linerSMDGCode === code);
  }
  page = Math.floor(index / pageSize);
  render();
  const row = field("list-rows").querySelector(`details[data-code="${CSS.escape(code)}"]`);
  row.open = true;
  row.scrollIntoView({ block: "center" });
  row.querySelector("summary").focus({ preventScroll: true });
}

function setControlsDisabled(disabled) {
  field("list-controls").disabled = disabled;
  field("list-sort").disabled = disabled;
}

async function load() {
  setControlsDisabled(true);
  field("list-retry").hidden = true;
  field("list-results").hidden = true;
  field("list-message").textContent = "Loading the liner code list...";
  try {
    const response = await fetch("data/_combined.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Code-list request failed (HTTP ${response.status}).`);
    records = validateRecords(await response.json());
    const linkedCode = readUrl();
    render();
    if (linkedCode) openLinked(linkedCode);
    setControlsDisabled(false);
  } catch (error) {
    field("list-message").textContent = `Unable to load the liner code list. ${error.message} Please retry or use the Excel download.`;
    field("list-retry").hidden = false;
  }
}

field("list-search").addEventListener("input", () => {
  page = 0;
  render();
});
field("list-sort").addEventListener("change", () => {
  page = 0;
  render();
});
for (const card of field("status-cards").querySelectorAll(".status-card")) {
  card.addEventListener("click", () => {
    setStatus(card.dataset.status);
    page = 0;
    render();
  });
}
for (const [id, direction] of [["list-previous", -1], ["list-next", 1]]) {
  field(id).addEventListener("click", () => {
    page += direction;
    render();
    field("list-message").scrollIntoView({ block: "start" });
    field("list-message").focus({ preventScroll: true });
  });
}
field("list-message").tabIndex = -1;
field("list-retry").addEventListener("click", load);
field("download-excel").addEventListener("click", async () => {
  const button = field("download-excel");
  button.disabled = true;
  field("export-message").textContent = "Generating Excel from the latest deployed combined data...";
  try {
    await downloadExcel();
    field("export-message").textContent = "Excel generated. Your download is ready.";
  } catch (error) {
    field("export-message").textContent = `Unable to generate Excel. ${error.message} Please try again.`;
  } finally {
    button.disabled = false;
  }
});
load();
