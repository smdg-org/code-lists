export const normalizeCode = value => String(value ?? "").trim().toUpperCase();

export function validateRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("The code list is empty or is not an array.");
  }
  const codes = new Set();
  for (const record of records) {
    if (!record || !/^[A-Z0-9]{3}$/.test(record.linerSMDGCode)
        || typeof record.linerName !== "string" || !record.linerName.trim()
        || codes.has(record.linerSMDGCode)) {
      throw new Error("The code list contains an invalid or duplicate record.");
    }
    codes.add(record.linerSMDGCode);
  }
  return records;
}

export function prefill(record) {
  const location = record.addressLocation ?? {};
  const address = location.address ?? {};
  return {
    code: record.linerSMDGCode,
    linerName: record.linerName,
    carrierType: record.carrierType ?? "",
    parentCompany: record.parentCompany ?? "",
    unLocode: location.UnLocode ?? "",
    unCountryCode: location.UnCountryCode ?? "",
    street: address.street ?? "",
    streetNumber: address.streetNumber ?? "",
    floor: address.floor ?? "",
    postCode: address.postCode ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    country: address.country ?? "",
    website: record.website ?? "",
    remarks: record.remarks ?? "",
    validFrom: record.validFrom ?? "",
    validTo: record.validTo ?? ""
  };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function websiteHref(value) {
  const website = String(value ?? "").trim();
  if (!/^(www\.|https?:\/\/)/i.test(website) || /\s/.test(website)) return "";
  try {
    const withoutScheme = /^www\./i.test(website);
    const url = new URL(withoutScheme ? `https://${website}` : website);
    if (!["http:", "https:"].includes(url.protocol)
        || (withoutScheme && !/^www\.[^.]+\..+$/i.test(url.hostname))) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function validateRequest(mode, values, records) {
  const errors = {};
  if (!["add", "update", "delete"].includes(mode)) {
    return { mode: "Choose Add, Update or Delete." };
  }
  const code = normalizeCode(values.code);
  const existing = records.find(record => record.linerSMDGCode === code);
  if (!/^[A-Z0-9]{3}$/.test(code)) {
    errors.code = "Enter exactly 3 letters or numbers.";
  } else if (mode === "add" && existing) {
    errors.code = `${code} already exists (${existing.linerName}). Choose another code.`;
  } else if (mode !== "add" && !existing) {
    errors.code = "Select an existing liner code.";
  }
  if (mode !== "add" && !values.reason?.trim()) {
    errors.reason = mode === "delete" ? "Enter a delete reason." : "Enter a change reason.";
  }
  if (!values.contactName?.trim()) errors.contactName = "Enter your name.";
  if (!values.contactEmail?.trim()) {
    errors.contactEmail = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())) {
    errors.contactEmail = "Enter a valid email address.";
  }
  if (mode === "delete") return errors;

  for (const [field, label] of Object.entries({
    linerName: "Liner name", street: "Street", postCode: "Postal code",
    city: "City", state: "Area", country: "Country", website: "Website"
  })) {
    if (!values[field]?.trim()) errors[field] = `${label} is required.`;
  }
  if (!["NVOCC", "VOCC"].includes(values.carrierType)) {
    errors.carrierType = "Select a carrier type.";
  }
  if (values.linerName?.length > 100) errors.linerName = "Use at most 100 characters.";
  if (values.parentCompany?.length > 100) errors.parentCompany = "Use at most 100 characters.";
  if (values.unLocode && !/^[A-Z0-9]{3}$/.test(normalizeCode(values.unLocode))) {
    errors.unLocode = "Use exactly 3 letters or numbers, without the country prefix.";
  }
  if (values.unCountryCode && !/^[A-Z]{2}$/.test(normalizeCode(values.unCountryCode))) {
    errors.unCountryCode = "Use exactly 2 letters.";
  }
  if (values.website && !websiteHref(values.website)) {
    errors.website = "Enter a website address starting with www., http:// or https://.";
  }
  if (mode === "add" && !values.validFrom) errors.validFrom = "Valid From is required for a new code.";
  for (const field of ["validFrom", "validTo"]) {
    if (values[field] && !validDate(values[field])) errors[field] = "Enter a valid date (YYYY-MM-DD).";
  }
  if (!errors.validFrom && !errors.validTo && values.validFrom && values.validTo
      && values.validTo < values.validFrom) {
    errors.validTo = "Valid To must not be before Valid From.";
  }
  return errors;
}
