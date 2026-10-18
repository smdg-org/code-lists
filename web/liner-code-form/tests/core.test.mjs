import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCode, prefill, validateRecords, validateRequest, websiteHref } from "../core.js";
import { countries } from "../countries.js";

const record = {
  linerSMDGCode: "MSK", linerName: "Maersk", carrierType: "VOCC",
  addressLocation: { UnLocode: "CPH", UnCountryCode: "DK", address: {
    street: "Esplanaden", streetNumber: "50", floor: "1", postCode: "1263",
    city: "Copenhagen", state: "Capital Region", country: "Denmark"
  } },
  website: "https://example.com", validFrom: "2020-01-01", validTo: "2030-01-01",
  remarks: "Line one\nLine two"
};
const values = {
  ...prefill(record), code: "Z9Z", reason: "", contactName: "Test User", contactEmail: "test@example.com"
};

test("website links safely normalize www addresses without changing stored values", () => {
  assert.equal(websiteHref("www.example.com/path"), "https://www.example.com/path");
  assert.equal(websiteHref("http://example.com"), "http://example.com/");
  assert.equal(websiteHref("HTTPS://example.com"), "https://example.com/");
  for (const value of ["", "javascript:alert(1)", "data:text/html,hi", "//example.com", "www.", "https://exa mple.com"]) {
    assert.equal(websiteHref(value), "");
  }
});

test("normalization and duplicates are case-insensitive exact matches", () => {
  assert.equal(normalizeCode(" mSk "), "MSK");
  assert.match(validateRequest("add", { ...values, code: " msk " }, [record]).code, /already exists/);
  assert.deepEqual(validateRequest("add", values, [record]), {});
});

test("add requires fields but does not require a reason or comments", () => {
  for (const key of ["linerName", "carrierType", "street", "postCode", "city", "state", "country", "website", "validFrom", "contactName", "contactEmail"]) {
    assert.ok(validateRequest("add", { ...values, [key]: "" }, [record])[key], key);
  }
  assert.deepEqual(validateRequest("add", values, [record]), {});
});

test("contact email is validated for add, update and delete", () => {
  for (const mode of ["add", "update", "delete"]) {
    assert.ok(validateRequest(mode, { ...values, code: mode === "add" ? "Z9Z" : "MSK", reason: "Reason", contactEmail: "not-an-email" }, [record]).contactEmail);
    assert.ok(validateRequest(mode, { ...values, code: mode === "add" ? "Z9Z" : "MSK", reason: "Reason", contactName: "" }, [record]).contactName);
  }
});

test("liner codes require exactly three alphanumeric characters", () => {
  for (const code of ["", "A", "AB", "ABCD", "A?C"]) {
    assert.ok(validateRequest("add", { ...values, code }, [record]).code);
  }
});

test("optional location codes enforce exact lengths and allowed characters", () => {
  assert.deepEqual(validateRequest("add", { ...values, unLocode: "", unCountryCode: "" }, [record]), {});
  for (const unLocode of ["NY", "USNYC", "A!C"]) {
    assert.ok(validateRequest("add", { ...values, unLocode }, [record]).unLocode);
  }
  for (const unCountryCode of ["U", "USA", "12"]) {
    assert.ok(validateRequest("add", { ...values, unCountryCode }, [record]).unCountryCode);
  }
});

test("update and delete require an existing code and a reason", () => {
  for (const mode of ["update", "delete"]) {
    assert.ok(validateRequest(mode, values, [record]).code);
    assert.ok(validateRequest(mode, { code: "MSK" }, [record]).reason);
  }
  assert.deepEqual(validateRequest("update", { ...values, code: "MSK", reason: "New address" }, [record]), {});
  assert.deepEqual(validateRequest("delete", { ...values, code: "MSK", reason: "No longer used" }, [record]), {});
});

test("website protocols and calendar dates are validated", () => {
  for (const website of ["www.example.com", "WWW.example.com/path?q=1", "http://example.com", "https://example.com"]) {
    assert.equal(validateRequest("add", { ...values, website }, [record]).website, undefined);
  }
  for (const website of ["example.com", "www.", "www.example", "www.example.com/a b", "javascript:alert(1)", "ftp://example.com"]) {
    assert.ok(validateRequest("add", { ...values, website }, [record]).website);
  }
  assert.ok(validateRequest("add", { ...values, validFrom: "2025-02-30" }, [record]).validFrom);
  assert.ok(validateRequest("add", { ...values, validTo: "2019-01-01" }, [record]).validTo);
});

test("prefill preserves fields, dates and multiline text without mutating data", () => {
  const original = JSON.stringify(record);
  const filled = prefill(record);
  assert.equal(filled.streetNumber, "50");
  assert.equal(filled.country, "Denmark");
  assert.equal(filled.validTo, "2030-01-01");
  assert.equal(filled.remarks, "Line one\nLine two");
  filled.street = "Changed only in memory";
  assert.equal(JSON.stringify(record), original);
  assert.equal(prefill({ linerSMDGCode: "AAA", linerName: "A" }).city, "");
});

test("bad or duplicate source data is rejected, not treated as an empty registry", () => {
  for (const data of [null, {}, [], [record, record], [{ linerSMDGCode: "A", linerName: "A" }]]) {
    assert.throws(() => validateRecords(data));
  }
  assert.equal(validateRecords([record]).length, 1);
});

test("country selector contains all 249 unique ISO countries and territories", () => {
  assert.equal(countries.length, 249);
  assert.equal(new Set(countries.map(country => country.code)).size, 249);
  assert.ok(countries.some(country => country.code === "US"));
  assert.ok(countries.some(country => country.code === "AQ"));
});
