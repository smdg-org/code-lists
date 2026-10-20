import { prefill, validateRecords } from "./core.js";
import { linkedValue } from "./links.js";
import { downloadExcel } from "./excel-export.js";

const field = id => document.getElementById(id);
const pageSize = 25;
let records = [];
let page = 0;
let selectedCode;

const statusLabels = {
  Active: "Active", Expired: "Expired", MarkedForDeletion: "Marked for deletion"
};
const statusLabel = record => statusLabels[record.codeStatus] ?? record.codeStatus ?? "Not provided";

function closeDetails() {
  field("record-panel").hidden = true;
  field("record-details").replaceChildren();
  selectedCode = undefined;
}

function showDetails(record) {
  selectedCode = record.linerSMDGCode;
  const values = prefill(record);
  const list = document.createElement("dl");
  list.className = "review-summary";
  const fields = [
    ["Liner code", values.code], ["Liner name", values.linerName],
    ["Status", statusLabel(record)], ["Version", record.linerCodeVersion],
    ["Carrier type", values.carrierType], ["Parent company", values.parentCompany],
    ["Address", record.address], ["Street", values.street], ["Street number", values.streetNumber],
    ["Building / Floor", values.floor], ["Postal code", values.postCode], ["City", values.city],
    ["Area (state / region / province)", values.state], ["Country", values.country],
    ["UN Country Code", values.unCountryCode], ["UN/LOCODE location part", values.unLocode],
    ["Website", values.website, "website"], ["Valid From", values.validFrom],
    ["Valid To", values.validTo], ["Remarks", values.remarks]
  ];
  for (const [label, value, name] of fields) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    linkedValue(description, name, value);
    list.append(term, description);
  }
  field("record-title").textContent = `${record.linerSMDGCode} - ${record.linerName}`;
  field("record-details").replaceChildren(list);
  field("record-panel").hidden = false;
  field("record-title").focus();
}

function render() {
  closeDetails();
  const code = field("list-code-search").value.trim().toLocaleLowerCase("en");
  const words = field("list-name-search").value.trim().toLocaleLowerCase("en").split(/\s+/).filter(Boolean);
  const status = field("list-status").value;
  const matches = records.filter(record =>
    (!status || record.codeStatus === status)
    && record.linerSMDGCode.toLocaleLowerCase("en").includes(code)
    && words.every(word => record.linerName.toLocaleLowerCase("en").includes(word)));
  const sortByName = field("list-sort").value === "name";
  matches.sort((a, b) =>
    (sortByName ? a.linerName.localeCompare(b.linerName, "en") : 0)
    || a.linerSMDGCode.localeCompare(b.linerSMDGCode, "en"));
  const start = page * pageSize;
  const visible = matches.slice(start, start + pageSize);
  const rows = document.createDocumentFragment();
  for (const record of visible) {
    const row = document.createElement("tr");
    row.setAttribute("role", "row");
    for (const [label, value] of [
      ["Code", record.linerSMDGCode], ["Liner name", record.linerName],
      ["Country", record.addressLocation?.address?.country || "Not provided"], ["Status", statusLabel(record)]
    ]) {
      const cell = document.createElement("td");
      cell.setAttribute("role", "cell");
      cell.dataset.label = label;
      cell.textContent = value;
      row.append(cell);
    }
    const cell = document.createElement("td");
    cell.setAttribute("role", "cell");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = "Details";
    button.dataset.code = record.linerSMDGCode;
    button.setAttribute("aria-label", `Details for ${record.linerSMDGCode}`);
    button.setAttribute("aria-controls", "record-panel");
    button.addEventListener("click", () => showDetails(record));
    cell.append(button);
    row.append(cell);
    rows.append(row);
  }
  field("list-rows").replaceChildren(rows);
  field("list-message").textContent = matches.length
    ? `${matches.length} of ${records.length} codes match. Showing ${start + 1}-${start + visible.length}.`
    : `No codes match your search (${records.length} codes in this snapshot). Try another search or clear filters.`;
  field("list-results").hidden = matches.length === 0;
  field("list-page").textContent = `Page ${page + 1} of ${Math.max(1, Math.ceil(matches.length / pageSize))}`;
  field("list-previous").disabled = page === 0;
  field("list-next").disabled = start + pageSize >= matches.length;
}

async function load() {
  closeDetails();
  field("list-controls").disabled = true;
  field("list-retry").hidden = true;
  field("list-results").hidden = true;
  field("list-message").textContent = "Loading the public code-list snapshot...";
  try {
    const response = await fetch("data/_combined.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Code-list request failed (HTTP ${response.status}).`);
    records = validateRecords(await response.json());
    page = 0;
    render();
    field("list-controls").disabled = false;
  } catch (error) {
    field("list-message").textContent = `Unable to load the public code list. ${error.message} Please retry or use the official Excel download.`;
    field("list-retry").hidden = false;
  }
}

for (const [id, event] of [["list-code-search", "input"], ["list-name-search", "input"], ["list-status", "change"], ["list-sort", "change"]]) {
  field(id).addEventListener(event, () => {
    page = 0;
    render();
  });
}
field("clear-search").addEventListener("click", () => {
  field("list-code-search").value = "";
  field("list-name-search").value = "";
  field("list-status").value = "";
  field("list-sort").value = "code";
  page = 0;
  render();
  field("list-code-search").focus();
});
field("close-record").addEventListener("click", () => {
  const button = [...field("list-rows").querySelectorAll("button")].find(button => button.dataset.code === selectedCode);
  closeDetails();
  button?.focus();
});
for (const [id, direction] of [["list-previous", -1], ["list-next", 1]]) {
  field(id).addEventListener("click", () => {
    page += direction;
    render();
    field("list-results").scrollIntoView({ block: "start" });
    field("list-message").focus();
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
