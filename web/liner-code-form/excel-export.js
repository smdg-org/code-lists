import { unzipSync, zipSync, strFromU8, strToU8 } from "./vendor/fflate.js";
import { validateRecords } from "./core.js";

const spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationships = "http://schemas.openxmlformats.org/package/2006/relationships";
const officeRelationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const excelHeaders = [
  "Code", "Liner Name", "Parent Company", "Carrier Type", "Valid From", "Valid To",
  "Website", "Street", "Street Number", "Building/Floor", "ZP Code", "City",
  "State", "Country", "UNLOCODE", "Status", "Last update"
];

export function excelValues(record) {
  const location = record.addressLocation ?? {};
  const address = location.address ?? {};
  const lastUpdate = (record.changeLogs ?? []).map(log => log.lastUpdateDate).filter(Boolean).sort().at(-1);
  return [
    record.linerSMDGCode, record.linerName, record.parentCompany,
    record.carrierType?.toUpperCase() === "UNKNOWN" ? "" : record.carrierType,
    record.validFrom, record.validTo, record.website, address.street, address.streetNumber,
    address.floor, address.postCode, address.city, address.state, address.country,
    `${location.UnCountryCode ?? ""}${location.UnLocode ?? ""}`,
    record.codeStatus, lastUpdate
  ].map(value => value ?? "");
}

function parse(bytes) {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("The Excel template contains invalid XML.");
  return doc;
}

const children = (node, name) => [...node.children].filter(child => child.localName === name);
const first = (node, name) => children(node, name)[0];
const serialize = doc => strToU8(new XMLSerializer().serializeToString(doc));

function element(doc, name, attributes = {}, text) {
  const node = doc.createElementNS(spreadsheet, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function excelDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid export date: ${value}`);
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid export date: ${value}`);
  }
  return (timestamp - Date.UTC(1899, 11, 30)) / 86400000;
}

function cell(doc, reference, value, style, date = false) {
  const node = element(doc, "c", { r: reference, s: style });
  if (value === "") return node;
  if (date) {
    node.append(element(doc, "v", {}, String(excelDate(value))));
  } else {
    node.setAttribute("t", "inlineStr");
    const string = element(doc, "is");
    const text = element(doc, "t", {}, value);
    text.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    string.append(text);
    node.append(string);
  }
  return node;
}

function calendarDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function worksheet(bytes, records, date) {
  const doc = parse(bytes);
  const root = doc.documentElement;
  const data = first(root, "sheetData");
  if (!data) throw new Error("The Excel template has no worksheet data.");
  const version = [...data.getElementsByTagNameNS(spreadsheet, "c")].find(node => node.getAttribute("r") === "D4");
  if (!version) throw new Error("The Excel template version cell D4 is missing.");
  const versionText = element(doc, "is");
  versionText.append(element(doc, "t", {}, `v${date.replaceAll("-", "")}`));
  version.setAttribute("t", "inlineStr");
  version.replaceChildren(versionText);
  for (const row of [...data.children]) {
    if (Number(row.getAttribute("r")) >= 9) row.remove();
  }
  const lastColumn = String.fromCharCode(64 + excelHeaders.length);
  const spans = `1:${excelHeaders.length}`;
  const header = element(doc, "row", { r: 9, ht: 40, customHeight: 1, spans });
  excelHeaders.forEach((value, i) => header.append(cell(doc, `${String.fromCharCode(65 + i)}9`, value, i === 0 ? 20 : 21)));
  data.append(header);
  records.forEach((record, index) => {
    const number = index + 10;
    const row = element(doc, "row", { r: number, spans });
    excelValues(record).forEach((value, i) => {
      const date = [4, 5, 16].includes(i);
      row.append(cell(doc, `${String.fromCharCode(65 + i)}${number}`, value, date ? 29 : i === 0 ? 25 : 26, date));
    });
    data.append(row);
  });
  first(root, "dimension").setAttribute("ref", `A1:${lastColumn}${records.length + 9}`);
  // Remove rules and links tied to the old columns/records, retaining branding links.
  for (const name of ["sortState", "dataValidations", "sheetProtection", "autoFilter"]) {
    first(root, name)?.remove();
  }
  const hyperlinks = first(root, "hyperlinks");
  if (hyperlinks) {
    for (const link of [...hyperlinks.children]) {
      if (!/^[A-Z]+[1-8]$/.test(link.getAttribute("ref"))) link.remove();
    }
    if (!hyperlinks.children.length) hyperlinks.remove();
  }
  const filter = element(doc, "autoFilter", { ref: `A9:${lastColumn}${records.length + 9}` });
  root.insertBefore(filter, data.nextSibling);
  const cols = first(root, "cols");
  cols.replaceChildren();
  [8.5546875, 43.109375, 32, 15, 15, 15, 38, 32, 16, 36, 14, 25, 28, 28, 16, 24, 15].forEach((width, i) => {
    cols.append(element(doc, "col", { min: i + 1, max: i + 1, width, customWidth: 1 }));
  });
  return serialize(doc);
}

export function createExcel(template, records, downloadDate = new Date()) {
  validateRecords(records);
  for (const record of records) {
    if (typeof record.codeStatus !== "string" || !record.codeStatus.trim()) {
      throw new Error(`Missing code status for ${record.linerSMDGCode}.`);
    }
  }
  const files = unzipSync(new Uint8Array(template));
  const date = calendarDate(downloadDate);
  const sorted = [...records].sort((a, b) => a.linerSMDGCode.localeCompare(b.linerSMDGCode, "en"));
  files["xl/worksheets/sheet2.xml"] = worksheet(files["xl/worksheets/sheet1.xml"], sorted.filter(record => record.codeStatus !== "Active"), date);
  files["xl/worksheets/sheet1.xml"] = worksheet(files["xl/worksheets/sheet1.xml"], sorted.filter(record => record.codeStatus === "Active"), date);
  const outdated = parse(files["xl/worksheets/sheet2.xml"]);
  first(first(outdated.documentElement, "sheetViews"), "sheetView").setAttribute("tabSelected", "0");
  files["xl/worksheets/sheet2.xml"] = serialize(outdated);

  const workbook = parse(files["xl/workbook.xml"]);
  const sheets = children(first(workbook.documentElement, "sheets"), "sheet");
  sheets[0].setAttribute("name", "Active");
  sheets[1].setAttribute("name", "Outdated");
  first(workbook.documentElement, "definedNames")?.remove();
  files["xl/workbook.xml"] = serialize(workbook);

  const rels = parse(files["xl/worksheets/_rels/sheet1.xml.rels"]);
  const retainedIds = new Set();
  for (const sheetPath of ["xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
    const doc = parse(files[sheetPath]);
    for (const node of doc.getElementsByTagName("*")) {
      const id = node.getAttributeNS(officeRelationships, "id");
      if (id) retainedIds.add(id);
    }
  }
  for (const rel of [...rels.documentElement.children]) {
    if (!retainedIds.has(rel.getAttribute("Id"))) rel.remove();
  }
  files["xl/worksheets/_rels/sheet1.xml.rels"] = serialize(rels);
  // Give each data sheet its own drawing part while sharing the unchanged logo image.
  const drawing = [...rels.getElementsByTagNameNS(relationships, "Relationship")].find(rel => rel.getAttribute("Type").endsWith("/drawing"));
  if (!drawing) throw new Error("The Excel template logo drawing is missing.");
  const drawingPath = `xl/${drawing.getAttribute("Target").replace("../", "")}`;
  files["xl/drawings/export-outdated.xml"] = files[drawingPath];
  const drawingName = drawingPath.split("/").at(-1);
  const drawingRels = `xl/drawings/_rels/${drawingName}.rels`;
  if (files[drawingRels]) files["xl/drawings/_rels/export-outdated.xml.rels"] = files[drawingRels];
  drawing.setAttribute("Target", "../drawings/export-outdated.xml");
  files["xl/worksheets/_rels/sheet2.xml.rels"] = serialize(rels);
  const types = parse(files["[Content_Types].xml"]);
  const override = types.createElementNS(types.documentElement.namespaceURI, "Override");
  override.setAttribute("PartName", "/xl/drawings/export-outdated.xml");
  override.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.drawing+xml");
  types.documentElement.append(override);
  files["[Content_Types].xml"] = serialize(types);
  return zipSync(files);
}

export async function downloadExcel() {
  const [dataResponse, templateResponse] = await Promise.all([
    fetch("data/_combined.json", { cache: "no-store" }),
    fetch("liner-codes-template.xlsx", { cache: "no-store" })
  ]);
  if (!dataResponse.ok) throw new Error(`Code-list request failed (HTTP ${dataResponse.status}).`);
  if (!templateResponse.ok) throw new Error(`Excel template request failed (HTTP ${templateResponse.status}).`);
  const [records, template] = await Promise.all([dataResponse.json(), templateResponse.arrayBuffer()]);
  const downloadDate = new Date();
  const bytes = createExcel(template, records, downloadDate);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `SMDG-Liner-codes-${calendarDate(downloadDate)}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
