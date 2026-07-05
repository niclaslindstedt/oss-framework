// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public `files` surface: browser file plumbing for local-first apps —
// saving rendered documents and binary payloads to disk (`download.ts`),
// opening them in a new tab (`open.ts`), reading picked files to inline
// `data:` URLs with a size cap (`intake.ts`), and the base64 data-URL ⇄ bytes
// codec underneath it all (`codec.ts`). See ./README.md.

export {
  downloadText,
  downloadBlob,
  MIME_TEXT,
  MIME_CSV,
  MIME_JSON,
  MIME_VCARD,
  MIME_ICS,
  MIME_ZIP,
} from "./download.ts";
export {
  dataUrlToBlob,
  openBlobInTab,
  openDataUrlInTab,
  saveDataUrl,
} from "./open.ts";
export { dataUrlToBytes, bytesToDataUrl, type DataUrlBytes } from "./codec.ts";
export {
  readFileAsDataUrl,
  readFilesWithLimit,
  type ReadFileData,
  type ReadFileRejection,
  type FileIntake,
} from "./intake.ts";
