# Liner-code form preview

A standalone, static **demonstration**, not an official submission service. It
supports Add, Update and Delete requests and a browser-local review
workflow. It does not change existing GitHub issue forms, CLI, API, repository
code-list files, or issue-processing automation.

## Searchable public code list

Open `liner-codes.html` to browse the bundled public repository snapshot without
downloading Excel. Separate **Search by code** and **Search by name** fields
provide case-insensitive partial matching in their respective fields only.
All entered name words must match; using both fields combines the filters.
Filter by Active, Expired or Marked for deletion, sort by code or name, and
browse 25 entries per page. All statuses are included by default.
Select **Details** to view company, address, location, website, validity,
and version. Remarks are omitted from public details. Missing values are
explicitly shown as **Not provided**;
unsafe website values remain plain text. Details appear in a separate panel
above the table, with focus moved to the record heading. **Close details**
returns focus to the entry's button. Filtering, sorting or changing pages
closes the panel so it cannot show a stale selection.
At mobile widths (640 pixels and below), results use full-width cards instead
of squeezed table columns. Codes and Details buttons stay on one line;
country and status retain visible labels. Desktop keeps the table layout.

**Fill a new request** links to the existing form at `./`, initially in Add mode.
The form also links back to the list. Reviewer navigation remains separate.
The list reads only the deployed public JSON, never browser-local reviewer
storage or contact details. Demo publication does not change it. It is not a
live registry or guaranteed to match the latest official Excel release; the
page links to the official download page and identifies the request form as a
demo. Loading failures disable search and offer an explicit retry and the
official download alternative.

**Download Excel (all codes)** fetches `data/_combined.json` again with
`cache: "no-store"` on every click; it does not use the search results, current
page, or browser-local reviewer data. The download contains **Active**
(`codeStatus === "Active"`), **Outdated** (every other status), and the original
**Description** sheet. The provided `liner-codes-template.xlsx` preserves the
logo, text and layout of rows 1-8; the 17 export headers are on row 9 and records
start on row 10. The version label in merged cells D4-G4 is updated on both data
sheets to the download date in `vYYYYMMDD` format, using the browser's local date.
The download filename uses that same date.

Columns A-Q are Code, Liner Name, Parent Company, Carrier Type, Valid From,
Valid To, Website, Street, Street Number, Building/Floor, ZP Code, City, State,
Country, UNLOCODE, Status and Last update. Remarks are not exported on either
data sheet; Status is column P and Last update is column Q. UNKNOWN carrier types
and missing values are blank. UNLOCODE concatenates `UnCountryCode` and `UnLocode`;
Last update is the latest `changeLogs[].lastUpdateDate` (the dataset has no
top-level `lastUpdatedDate`). Validity and update dates are Excel date cells;
postcodes, street numbers and other text remain text. Free-text addresses are
not exported. Export errors are displayed explicitly and the button can retry.
ZIP handling uses the locally bundled, MIT-licensed `fflate` dependency; there
are no third-party runtime requests. Run `npm install` before building.

## Form validation and preview-only mode

### Reviewer-initiated corrections

After demo sign-in, **Edit current data** is available only in the reviewer
workspace. Search by code or liner name, select **Edit**, and change company,
website, carrier, address/location, validity, status or remarks fields. The code
is read-only; this view does not add, rename or delete records. Choose a listed
reviewer and provide a change reason. Only changed fields are compared, and
**Review changes** opens a confirmation before **Publish to demo list** applies
the correction without creating a submission or requiring another approval.

Publication uses the existing locked browser-local store and rechecks the full
record against the opened baseline, including after the confirmation dialog.
Conflicts and save failures retain entries and show an explicit error. Reload
the current record to resolve conflicts; unsaved edits require confirmation
before being discarded. Direct-edit history retains the reviewer name, time,
reason and before/after values. Existing metadata and change logs are preserved;
direct-edit history is separate from official repository change logs. Status
edits also keep `isActive` consistent.

This does not change individual repository JSON, combined data, the public search
page or its Excel download. The demo login is not authorization, and listed
reviewer names are not verified identities. Production publication requires
server-side authentication and permission checks. Existing saved demo workspaces
remain usable; metadata previously absent from local records is not restored
automatically from the public snapshot.

The original form URL (`./`) now saves demo requests through **Review request**
then **Submit** on the summary. No query parameter or mode switch is needed.
For development regression checks only, `?preview=1` retains the earlier
no-save/no-send preview behavior described below.

- Add has no change reason or change comments. Duplicate liner codes are checked
  against the bundled `_combined.json`, ignoring case and surrounding whitespace.
  Liner codes require exactly three ASCII letters or numbers.
- Liner name, carrier type, street, postal code, city, area, country and website
  are required for Add and Update. Carrier type starts with an empty selection.
  Valid From is also required for Add, matching the existing add mapper.
  Required fields display a red asterisk, with native required-field semantics
  retained for assistive technology.
- Website addresses may start with `www.`, `http://` or `https://`. The entered
  value is preserved; the preview does not add a scheme to the request.
- Valid websites have an **Open website (new tab)** link beside editable fields,
  and are clickable in summaries, comparisons, deletion details, publication
  confirmations and demo list details. `www.` links use HTTPS without changing
  stored text. Invalid/unsafe addresses remain plain text. Contact emails use
  explicit mail links rather than relying on mobile automatic detection.
  Mail links prefill `SMDG Liner Code Request - {code} - {linerName}` using
  the original request's code and liner name (the form summary uses its entered
  values). The subject is URL-encoded and remains editable in the mail app.
- Name and a valid email address are required as contact details for all three
  request types. They are held in browser memory only. The preview does not
  transmit or save them; a real service could use them only to contact the
  requester.
- Optional UN/LOCODE location parts require three letters/numbers; optional
  country codes require two letters. The country code is displayed before the
  location part. These checks validate format only, not membership in the
  official UN/LOCODE registry.
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
- Review validates the request and displays a summary before the Submit button.
  Back returns to the form without clearing values. Submit displays a preview-only
  confirmation; it never sends, saves, downloads or submits the entered values
  anywhere. Switching request type, clearing, or refreshing discards draft
  entries. Browser extensions and browser autofill are outside the application's
  control; use test contact details rather than private data.
- Update summaries show every field, highlight changed liner data with a
  "Changed" label, and display its previous published value. Returning with Back
  and reviewing again recalculates the highlights.
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

## End-to-end workflow demo

The form at its original URL uses local persistence by default. Clicking
**Review request** validates and displays the summary without saving.
**Submit** on that summary saves
requests, including fictional contact information, in `localStorage`. The page
discloses this before submission and replaces the preview-only privacy text.
Never enter real personal information.

The public form and reviewer workspace are standalone pages with no navigation
links between them, including after submission. Open the form at `./`
and the reviewer workspace separately at `reviewer.html`. Use the same browser
and origin (including port) for both pages. Submitted requests appear as cards
under **Active tasks** after signing in. Separate URLs do not provide security or
separate-domain hosting; sharing local demo data still requires the same origin.

### Login and task cards

Open `reviewer.html` directly. Use the public demonstration username `linercodelists` and
password `SMDGLCL2026` to open all demo tasks directly. There is no personal
profile-selection step. Open a task to optionally assign it to one of these names:

- Javier Moral
- Thalke Diepenbrock
- Mark Lim
- Jasmin Dronner
- Anna Eder

Anyone with the shared demo login can view all tasks, assign or reassign each
task to any name, or return it to Unassigned; this does not verify anyone's identity.
For pending/under-review requests, assignment sets Under review and unassignment
returns Pending review. Needs information is preserved during reassignment.
Assignment is not required to open a task. The credentials are
intentionally public demo values in the static source, not secrets or real
authentication. Never reuse them for a real account.
The sign-in page does not display the credentials; removing the visible hint
does not make browser-side authentication secure or hide values in the source.

Only the simulated login session is held in page memory. Sign out, refresh or
leaving requires signing in again, but saved requests and assignments survive.
Passwords are cleared after every attempt and are not written to storage.
Browser password managers and extensions remain outside the application's
control.

The workspace initializes once with the deployment snapshot and three complete
sample requests (Add, Update, Delete), with fictional contacts. All tasks are
cards with reference, code, liner, action, status, assignee and submission date.
**Active tasks** is the default view and includes Pending review, Under review
and Needs information requests. Published and rejected requests automatically
appear only in **Archive**, keeping the main queue focused on outstanding work.
Both views support search and status/assignee filters, with counts and status
options scoped to that view. Switching views clears filters. Archived cards
still open their read-only details and history, and Back returns to the view
they were opened from. Archiving does not delete requests or change saved data.
Only Liner Codes is enabled; requests include a list identifier for explicit routing.
The current workspace tab is highlighted in blue, including while viewing its
request details. Published labels are green, rejected labels are red and
Unassigned labels are black; card backgrounds and borders do not change.

### Request screens and actions

Opening a card displays the original contact and request details, assignment
and history. Add shows the editable proposal without a comparison table.
Update shows the editable proposal and current/original/proposed comparison,
with changed rows highlighted. Delete shows only the record details, without
a proposal editor or comparison table. Open deletion requests display the
current record; closed requests retain their saved baseline. If the record is
missing, its saved baseline is labelled explicitly and publication is blocked.
Original submissions and original baselines remain intact when proposals change.

- Assign, reassign or unassign inside the request. No identity selector appears
  after login. Assign before taking review actions; the shared account can act
  for any assignee.
- **Save draft** is optional and can retain incomplete proposals. Publication
  always reuses the form's validation rules.
- **Add note**, **Needs information**, **Resume review** and **Reject request**
  retain proposal edits and append history. Notes/reasons are required for
  notes, clarification and rejection. Clarification retains the assignee.
  No email or secure requester reply link is sent; enter agreed corrections
  directly after simulated contact.
- **Approve and publish - demo** validates and previews the exact final values
  in a confirmation dialog. It directly adds/updates/removes the demo record;
  no separate save, requester resubmission or second approval is required.
- Rejection and publication close the request against further actions.
  Failed saves never show a successful outcome. Cancelled dialogs retain edits;
  leaving a dirty proposal prompts before discarding it.
- **Delete request** is available only on archived (published or rejected)
  request details, never on active requests. A warning banner explains that
  deletion permanently erases the request, contacts, notes and history with
  no recovery option. **Delete permanently** explicitly confirms the deletion;
  **Cancel** or Escape keeps the request.
  It does not require assignment and does not undo earlier publication or
  change the demo code list. Stale versions and
  failed storage writes block deletion without losing the request. This is a
  demo cleanup feature, not production retention or audit policy.
- The **Demo code list** screen supports searching, paged record details and
  a JSON download. It contains only liner fields, excluding requester contacts,
  request reasons and reviewer notes. Subsequent test forms use this updated
  list, so an added code can then be updated or deleted.

Deletion removes the code from the demo list, not from request history. The demo
uses a projection of public liner fields, not production versioning, activation,
change-log or deletion semantics. No official dataset, release or API changes.

### Storage and conflicts

`workflow.js` shares validation, lifecycle and storage between the two pages.
The versioned workspace (`smdg-liner-workflow-demo-v1`) is one localStorage
document containing records and requests. Writes use browser Web Locks on
localhost/HTTPS, re-read the latest workspace, and save atomically. Unsupported
browsers, denied storage, quota failures and invalid stored data fail explicitly
without silently recreating the workspace.

Request versions block stale actions from another tab. A saved record baseline
blocks stale Update/Delete publication; duplicate Add and repeat publication
are blocked too. After comparing current/original/proposed values, a reviewer
can explicitly acknowledge a changed baseline with a note. This retains the
proposal, does not silently merge fields, and records the acknowledgement.
A removed code cannot be rebased. Stale form submission retains entries and
offers a demo-list refresh before reviewing again.

The reviewer panel does not expose workspace export, import or reset controls.
The **Demo code list** download remains available and excludes request contacts
and reviewer notes.

Storage is limited to one browser profile and origin (including port). It is
not shared across people/devices, not private from other users of that browser,
and not tamper-proof. This
simulation provides no genuine authentication, authorization or audit guarantee.
Production needs a backend and real identity/storage/publication services;
API integration remains out of scope.

## Run and test locally

Requires Node.js 22+ (24 used in CI), npm, and Python 3 for the preview server.

```sh
cd web/liner-code-form
npm ci
npm test
npx playwright install --with-deps chromium webkit
npm run test:browser
npm run build
npm run preview
```

Open <http://127.0.0.1:4173>. The server binds to localhost. For WSL/remote VS
Code, forward port 4173 privately if necessary. Stop it with Ctrl+C.
If a preview is already running, use `PREVIEW_TEST_PORT=4175 npm run test:browser`
to run the browser tests on a separate port without stopping it.

The build copies only the web assets (including the logo) and the repository's
public combined JSON into ignored `dist/`. It never reads the internal
enrichment workbook or copies the repository into the deployment. Unit tests
cover form validation, prefill, lifecycle, conflicts, imports and publication.
Browser tests cover Add/Update/Delete end to end, contact disclosures, cards,
assignment, editable comparisons, clarification/rejection, persistence,
concurrent tabs, public-list downloads, active/archive views, storage failures
and mobile layout.
The original preview regressions still verify absence of writes, storage and
submission in the explicit developer preview mode (`?preview=1`).
The mobile Safari/WebKit regression checks empty and populated date fields at
320, 375, 390 and 430 pixels wide against the Remarks field boundaries.

## Current public deployment

The live preview uses branch-based GitHub Pages from the root of `gh-pages`.
Pushing source changes to `data-linercodes-webform-preview` does not update the
website. No PR or merge into `main` is required to publish this preview:

1. Run the unit and browser tests, then `npm run build`.
2. In a separate worktree for the latest `gh-pages`, copy only the built
   `index.html`, `liner-codes.html`, `liner-codes.js`, `reviewer.html`, `reviewer.js`, `workflow.js`, `links.js`, `styles.css`, `app.js`, `core.js`, `countries.js`,
   `smdg-logo.png` and `data/_combined.json` from `dist/`.
3. Preserve `.nojekyll`, review the deployment diff, and commit with the source
   commit identifier.
4. Push `gh-pages`, wait for the **pages-build-deployment** workflow to succeed,
   and verify the published page.

Never merge `gh-pages` into a source branch or copy dependencies, test results,
internal data or credentials into the deployment.

## Optional Actions-based deployment

The optional deployment workflow does not run on source pushes or PR creation.
The test workflow runs checks only.
The following is an alternative to the current branch-based setup and requires
changing the Pages source. To adopt it after review:

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
