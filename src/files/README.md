<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `files` — browser file plumbing

Every local-first app eventually moves bytes across the browser boundary:
export a rendered document, save or open a stored binary payload, take in a
picked file. This module is that plumbing, in four small pieces you can adopt
independently — zero dependencies, Web APIs only:

- **`download.ts`** — save to disk via a transient anchor: `downloadText` for
  rendered text documents, `downloadBlob` for binary, plus common `MIME_*`
  constants (`MIME_TEXT`, `MIME_CSV`, `MIME_JSON`, `MIME_VCARD`, `MIME_ICS`,
  `MIME_ZIP`) so adopters don't re-spell the charset suffix.
- **`open.ts`** — open in a new tab: `openBlobInTab` (object URL, revoked
  after a grace period so the tab can load), `openDataUrlInTab` and
  `saveDataUrl` for payloads stored as `data:` URLs, and the `dataUrlToBlob`
  conversion they share. The data URL is decoded to a real Blob first, because
  some browsers refuse to navigate to a giant `data:` URL.
- **`codec.ts`** — the pure base64 `data:` URL ⇄ bytes seam:
  `dataUrlToBytes` / `bytesToDataUrl` (`DataUrlBytes`). This is what a cloud
  backend uses to file inline payloads out as real binary files, and back.
- **`intake.ts`** — read picked / dropped `File` objects to inline payloads:
  `readFileAsDataUrl` for one file, `readFilesWithLimit(files, { maxBytes })`
  for a batch, partitioning into `accepted` (`ReadFileData`: name, type, size,
  data URL) and `rejected` (`ReadFileRejection`: `"too-large"` /
  `"read-failed"`), so the UI can report refusals instead of dropping files on
  the floor.

```ts
import {
  downloadText,
  downloadBlob,
  openBlobInTab,
  openDataUrlInTab,
  saveDataUrl,
  dataUrlToBlob,
  dataUrlToBytes,
  bytesToDataUrl,
  readFileAsDataUrl,
  readFilesWithLimit,
  MIME_JSON,
  type DataUrlBytes,
  type ReadFileData,
  type ReadFileRejection,
  type FileIntake,
} from "@niclaslindstedt/oss-framework/files";
```

## What it owns vs. what stays in your app

The module moves **bytes**, not records. What a payload _is_ — its id, which
record it hangs off, how a list of them is ordered — is your app's vocabulary
and stays on your side of the seam.

| In the framework                                   | In your app                                               |
| -------------------------------------------------- | --------------------------------------------------------- |
| anchor / object-URL / FileReader mechanics         | what gets exported, and when                              |
| the size cap and the accepted / rejected partition | the cap's value, and the message shown for a rejection    |
| the base64 data-URL ⇄ bytes codec                  | where the bytes live (document, cloud file) and their ids |

## Usage

```ts
// Export a rendered document.
downloadText("everything.json", renderJson(data), MIME_JSON);

// Open a stored PDF payload in a new tab; fall back to a download.
if (!openDataUrlInTab(item.data, item.mime)) {
  saveDataUrl(item.name || "file", item.data, item.mime);
}

// Take in picked files, capped at 10 MB each.
const { accepted, rejected } = await readFilesWithLimit(files, {
  maxBytes: 10 * 1024 * 1024,
});
```
