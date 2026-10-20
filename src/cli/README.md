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
