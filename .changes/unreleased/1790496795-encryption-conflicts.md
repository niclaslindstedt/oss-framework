---
type: Fixed
title: Encrypted conflicts carry plaintext
---

A save conflict through `withEncryption` now hands the backend's newer copy up decrypted, so a caller's merge reads the document instead of the envelope; wrong and missing passphrases throw the new `WrongPasswordError` and `EncryptionLockedError` classes with the same messages as before.
