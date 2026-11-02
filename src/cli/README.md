# SMDG Cli

## Liner-code data synchronization

Individual liner-code JSON files and `_index.json` in `data/liner-codes` are the
source for `_combined.json`. Single-code updates (GitHub forms and Excel
application forms) and bulk Excel imports regenerate the combined file before
the issue-processing workflow creates a pull request.

Bulk imports write the combined records in index/filename order, regardless of
the order of rows in the workbook. Regeneration preserves liner-code values and
change history; it does not create a new liner-code version or history entry.

To repair stale combined data or regenerate after a manual JSON edit, run from
the repository root with the .NET 8 SDK:

```sh
dotnet run --project src/cli/SmdgCli/SmdgCli.csproj -- liner-codes pack combined -o data/liner-codes
```

Commit the generated `_combined.json` with the source-data changes. The data PR
workflow regenerates and compares it without pushing repair commits; the release
workflow also refuses to release if regeneration produces a difference.

Pull-request verification allows deleting liner-code files, provided their
filenames are also removed from `_index.json` and their codes from `_combined.json`
(compared case-insensitively). Renamed files are validated under their new names.
Validation comments report how many individual files were validated and list any
deleted codes.

Repository maintainers should require the data workflow's `pack` check for
data-changing pull requests and ensure the CLI tests pass. Branch protection is
a GitHub setting, not something this code change configures. The data workflow
has path filters, so do not require its check globally without also making it
run for every pull request.

## Excel application form (V2)

Issues created with the "Liner code data change request (Excel V2)" template carry the
`attachment-excel-v2` label and are processed by `liner-codes convert excel-v2`. The form
has a fixed layout: headers in row 9 and one liner code in row 10 of the
"Application form liner codes" sheet.

| Cell | Field | | Cell | Field |
|------|-------|-|------|-------|
| A10 | `linerSMDGCode` | | J10 | `addressLocation.address.floor` |
| B10 | `linerName` | | K10 | `addressLocation.address.postCode` |
| C10 | `parentCompany` | | L10 | `addressLocation.address.city` |
| D10 | `carrierType` (VOCC/NVOCC) | | M10 | `addressLocation.address.state` |
| E10 | `validFrom` | | N10 | `addressLocation.address.country` |
| F10 | `validTo` | | O10 | `UnCountryCode` (first 2) and `UnLocode` (last 3) |
| G10 | `website` | | R10 | `remarks` |
| H10 | `addressLocation.address.street` | | P10, Q10 | applicant name and mail, not stored |
| I10 | `addressLocation.address.streetNumber` | | | |

The single-line `address` is generated from the structured fields. The command checks the
row 9 headers, the fields marked mandatory in the template and that the code in the issue
matches A10, comments the result on the issue and, when valid, writes the liner-code file and
rebuilds `_combined.json`. Only Add and Update are supported.

Dates must be Excel date cells or text in `YYYY-MM-DD` format. The country (N10) must be one
of the names in the form dropdown, and the first 2 characters of the UNLOCODE (O10) must be
its ISO 3166-1 alpha-2 code (`Utilities/CountryCodes.cs`, the same list as `site/countries.js`).

## Testing

```sh
dotnet test src/cli/SmdgCli.Test/SmdgCli.Test.csproj
```

The synchronization tests use temporary directories and generate their own Excel
workbooks. No additional input files or real GitHub issues are needed. GitHub
calls in the Excel-form tests are substituted; the Excel reader, mapping, and
file writes run locally.

### Synchronization fix

- Rebuild the combined file after each single-code write.
- Use the same deterministic rebuild for bulk writes.
- Check generated data in CI instead of committing repairs from the PR workflow.
