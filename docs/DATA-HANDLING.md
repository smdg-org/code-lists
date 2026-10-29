# Data Handling Flows

## Requesting Data Changes Process

The process begins when the requester creates a GitHub issue using the appropriate template: [New Issue](https://github.com/smdg-org/code-lists/issues/new/choose).

Requesters can submit their application by either:

* Filling out the GitHub application form
* Uploading an Excel application form

```mermaid
flowchart TD
    newchange[Data change is needed]
    mdform[GitHub Application Form]
    xlsform[Excel Application Form]
    issuecreated[Issue Created by users]
    validation{{ Issue processing and Data validation }}
    pr{{Pull/Change Request Created}}
    review[Revew/Approval by SMDG]
    flowend@{ shape: stadium, label: "Data changes are published" }

    newchange --> mdform
    newchange --> xlsform
    mdform --> issuecreated
    xlsform --> issuecreated
    issuecreated -->|automatically| validation
    validation -->|when invalid, feedback to the change is provided| issuecreated
    validation -->|when data is valid| pr
    pr --> review
    review -->|when details needed, the reviewer adds comments| issuecreated
    review -->|changes are merged| flowend
```

## Data Release Process

Once the changes are merged into the dataset, automated workflows ensure that the API is updated, a new Excel version is published under: [Releases](https://github.com/smdg-org/code-lists/releases), and the [liner-code list page](https://smdg-org.github.io/code-lists/liner-codes.html) is refreshed.

The pages in [site/](../site/) are static and read-only. On every change to `main`, the publish workflow copies `data/liner-codes/_combined.json` next to them and deploys the result to GitHub Pages; data can only be changed through pull requests to `main`.

```mermaid
flowchart LR
    push[New data changes are published]
    packxls{{SMDG Code Lists Excel is created}}
    release{{GitHub Release is created}}
    upload{{Data is uploaded to Database}}
    api[BIC API for Codes]
    pages{{Liner-code list page is published}}

    push --> packxls
    packxls --> release

    push --> upload
    upload --> api

    push --> pages

```

## Bulk Data Update Process

This process is exclusively for the SMDG team when making changes that impact all or most SMDG codes.

The process begins when the SMDG data owner creates a GitHub issue for bulk updates using the appropriate template: [New Issue](https://github.com/smdg-org/code-lists/issues/new/choose).

```mermaid
flowchart TD
    newchange[Data bulk change is needed]
    xls[Codes List Excel Attached]
    issuecreated[Issue Created]
    validation{{ Issue processing and Data validation }}
    pr{{Pull/Change Request Created}}
    review[Revew/Approval by SMDG]
    flowend@{ shape: stadium, label: "Data changes are published" }

    newchange --> xls
    xls --> issuecreated
    issuecreated -->|automatically| validation
    validation -->|when invalid, feedback to the change is provided| issuecreated
    validation -->|when data is valid| pr
    pr --> review
    review -->|changes are merged| flowend
```
