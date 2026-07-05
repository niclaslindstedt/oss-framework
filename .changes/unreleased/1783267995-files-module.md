---
type: Added
title: Files
---

New `files` module: browser file plumbing — save rendered documents and binary
payloads to disk (`downloadText` / `downloadBlob` + `MIME_*` constants), open
them in a new tab (`openBlobInTab`, `openDataUrlInTab`, `saveDataUrl`), read
picked files to inline data URLs with a byte-size cap (`readFilesWithLimit`),
and the base64 data-URL ⇄ bytes codec underneath (`dataUrlToBytes` /
`bytesToDataUrl`).
