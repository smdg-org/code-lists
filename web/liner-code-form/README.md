# Liner-code form preview

A standalone, static **demonstration**, not a submission service. It supports
Add, Update and Delete request previews. It does not change the existing GitHub
issue forms, CLI, API, code-list files, or issue-processing automation.

## Behavior

- Add has no change reason or change comments. Duplicate liner codes are checked
  against the bundled `_combined.json`, ignoring case and surrounding whitespace.
  Liner codes require exactly three ASCII letters or numbers.
- Liner name, carrier type, street, postal code, city, area, country and website
  are required for Add and Update. Carrier type starts with an empty selection.
  Valid From is also required for Add, matching the existing add mapper.
  Required fields display a red asterisk, with native required-field semantics
  retained for assistive technology.
- Optional UN/LOCODE location parts require three letters/numbers; optional
  country codes require two letters. These checks validate format only, not
  membership in the official UN/LOCODE registry.
- Country selection includes 249 ISO 3166-1 countries and territories, with
  English names supplied by `Intl.DisplayNames`. Existing non-standard country
  names are retained as selectable existing values rather than silently changed.
- Update and Delete begin with two linked dropdowns: codes from `linerSMDGCode`
  and names from `linerName`, each showing the full list without a filter field. Selecting
  either loads the record and synchronizes the other; neither dropdown is
  individually required. Names display only the name but use the unique liner
  code internally, so records with identical names remain separate entries.
  Clear either selection to hide the details until a record is chosen. Update
  prefills editable fields; Delete shows the selected code/name without editable
  company/address fields. Reasons are required; comments are optional.
- Validate displays errors or a confirmation on screen only. It never submits,
  downloads, stores or sends the entered values anywhere. Switching request type,
  clearing, or refreshing discards draft entries. Browser extensions and browser
  autofill are outside the application's control; do not enter private data.
- Dates and remarks are prefilled without silently substituting processing dates.
  No versioning, deletion semantics or history changes are executed in this demo.
- If loading the code list fails, the form is disabled and an explicit retry is
  offered. The bundled list is a deployment snapshot, not a live registry.
  Future real submission would need server-side revalidation for stale data and
  concurrent requests.

The visual design is inspired by the official SMDG site's navy/white palette,
red accents and document layout. The official SMDG logo is bundled locally from
<https://smdg.org/wp-content/uploads/SMDG-Logo-0400x095-1.png>; the logo remains
the property of SMDG. No site photographs, fonts or stylesheets are copied or
loaded. No analytics or third-party runtime services are included.

## Run and test locally

Requires Node.js 22+ (24 used in CI), npm, and Python 3 for the preview server.

```sh
cd web/liner-code-form
npm ci
npm test
npx playwright install --with-deps chromium
npm run test:browser
npm run build
npm run preview
```

Open <http://127.0.0.1:4173>. The server binds to localhost. For WSL/remote VS
Code, forward port 4173 privately if necessary. Stop it with Ctrl+C.
If a preview is already running, use `PREVIEW_TEST_PORT=4175 npm run test:browser`
to run the browser tests on a separate port without stopping it.

The build copies only the web assets (including the logo) and the repository's public combined
JSON into ignored `dist/`. It never reads the internal enrichment workbook or
copies the repository into the deployment. Unit tests cover validation and
prefill; browser tests cover Add/Update/Delete, actual bundled-data loading,
load failures, mobile layout, and absence of writes/storage/submission.

## Optional public deployment

Nothing deploys on push or PR creation. The test workflow runs checks only.
To publish this non-submitting demo after review:

1. Merge the feature PR into `main`.
2. Confirm this repository does not already use GitHub Pages for another site:
   deploying this artifact would replace that site.
3. In repository **Settings > Pages**, select **GitHub Actions** as the source,
   subject to organization permissions.
4. In **Actions > Liner Code Form - Deploy Demo**, choose **Run workflow** on
   `main`. The workflow reruns tests before deploying.
5. Use the URL reported by the deployment (normally
   `https://smdg-org.github.io/code-lists/`).

This is a public webpage, not a GitHub-login-protected page. There are no write
credentials in it. Do not add the real request form or submission integrations
until authorization, validation, privacy and review behavior are designed.
