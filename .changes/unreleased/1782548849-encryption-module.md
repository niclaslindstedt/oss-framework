---
type: Added
title: encryption module — at-rest crypto + storage adapter wrapper
---

A new `encryption` subpath export (`@niclaslindstedt/oss-framework/encryption`): at-rest encryption for a local-first app. `withEncryption(adapter, passwordRef)` wraps any `StorageAdapter` so `save` enciphers and `load` decrypts at the byte boundary, working over any backend (localStorage, folder, cloud) and the offline cache. The pure crypto — `encryptText` / `decryptEnvelope` over a self-describing AES-GCM + PBKDF2 JSON envelope (OWASP-aligned 600k-iteration KDF), plus `parseEnvelope` / `isEncryptedEnvelope` sniffers — is also exported for per-value use. The framework holds the passphrase nowhere: your app collects it and threads it in by reference (`null` passes bytes through, so enabling encryption is non-destructive), and owns the lock/unlock UI.
