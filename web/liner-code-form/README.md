# Liner-code form preview

A standalone, static **demonstration**, not an official submission service. It
supports Add, Update and Delete previews and an opt-in browser-local review
workflow. It does not change existing GitHub issue forms, CLI, API, repository
code-list files, or issue-processing automation.

## Default preview behavior (workflow demo off)

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

The form's **Enable browser-local workflow demo** checkbox opts into local
persistence. Opening the form with `?demo=1` enables this mode directly.
Unlike the default preview, this mode saves
requests, including fictional contact information, in `localStorage`. The page
discloses this before submission and replaces the preview-only privacy text.
Never enter real personal information.

The public form and reviewer workspace are standalone pages with no navigation
links between them, including after submission. Open the form at `?demo=1`
and the reviewer workspace separately at `reviewer.html`. Use the same browser
and origin (including port) for both pages. Submitted requests appear as cards
under **All tasks** after signing in. Separate URLs do not provide security or
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

Only the simulated login session is held in page memory. Sign out, refresh or
leaving requires signing in again, but saved requests and assignments survive.
Passwords are cleared after every attempt and are not written to storage.
Browser password managers and extensions remain outside the application's
control.

The workspace initializes once with the deployment snapshot and three complete
sample requests (Add, Update, Delete), with fictional contacts. All tasks are
cards with reference, code, liner, action, status, assignee and submission date.
Search and status/assignee filters work across the queue. Only Liner Codes is
enabled; requests include a list identifier for explicit routing.

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
- **Delete request** on the detail screen permanently removes any demo request,
  including closed requests, contacts, notes and history, after confirmation.
  It does not require assignment and does not undo earlier publication or
  change the demo code list. Cancel keeps unsaved edits. Stale versions and
  failed storage writes block deletion without losing the request. This is a
  demo cleanup feature, not production retention or audit policy.
- The **Demo code list** screen supports searching, paged record details and
  a JSON download. It contains only liner fields, excluding requester contacts,
  request reasons and reviewer notes. Subsequent test forms use this updated
  list, so an added code can then be updated or deleted.

Deletion removes the code from the demo list, not from request history. The demo
uses a projection of public liner fields, not production versioning, activation,
change-log or deletion semantics. No official dataset, release or API changes.

### Storage, conflicts and workspace tools

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

**Workspace tools** provides:

- Export JSON with a warning that fictional contacts and notes are included.
- Validate and import JSON (8 MB maximum), with confirmation before replacing
  the entire workspace; no merge. A concurrent change blocks replacement.
- Reset, with confirmation, to the deployment snapshot and fresh sample requests.

Storage is limited to one browser profile and origin (including port). It is
not shared across people/devices, not private from other users of that browser,
and not tamper-proof. Export/import can move a test workspace manually. This
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
concurrent tabs, downloads/import/reset, storage failures and mobile layout.
The original preview regressions still verify absence of writes, storage and
submission when workflow mode is off.
The mobile Safari/WebKit regression checks empty and populated date fields at
320, 375, 390 and 430 pixels wide against the Remarks field boundaries.

## Current public deployment

The live preview uses branch-based GitHub Pages from the root of `gh-pages`.
Pushing source changes to `data-linercodes-webform-preview` does not update the
website. No PR or merge into `main` is required to publish this preview:

1. Run the unit and browser tests, then `npm run build`.
2. In a separate worktree for the latest `gh-pages`, copy only the built
   `index.html`, `reviewer.html`, `reviewer.js`, `workflow.js`, `styles.css`, `app.js`, `core.js`, `countries.js`,
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
