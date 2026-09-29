<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/qr`

Show a scannable QR code — a device-pairing code, a share invite, a link —
with no dependency, and read one with the phone's camera inside a native
shell.

```tsx
import { QrCode } from "@niclaslindstedt/oss-framework/qr";

<QrCode value={payload} size={220} label="Scan to add this device" />;
```

- `encodeQr(text, { ecl })` — the module matrix (byte mode, UTF-8, versions
  1–40, levels L/M/Q/H, automatic mask choice).
- `qrToSvg(qr, { size, dark, light })` — a standalone SVG string.
- `<QrCode>` — inline SVG, always dark on white with a quiet zone (inverted
  codes are unreadable to many cameras), `role="img"` with a label. Do not
  put the payload in the label: pairing and invite payloads are secrets.

## Scanning

```ts
import { canScanQrCode, scanQrCode } from "@niclaslindstedt/oss-framework/qr";

if (canScanQrCode()) {
  const text = await scanQrCode({ labels: { hint, cancel } }); // null = cancelled
}
```

- `canScanQrCode()` — true only inside a native shell that advertises the
  `scan-qr` capability. Show a Scan button on it; keep a paste field
  everywhere.
- `scanQrCode({ labels })` — the shell opens its camera (asking for it then,
  not at launch), reads one code, closes and answers; no frame is kept.
  Resolves with the text or `null`; rejects with `ScanQrError` (`reason`:
  `"denied"` or `"unavailable"`).
- The text is unvalidated. For a storage pairing or invite code use
  `scanStorageCode` from `@niclaslindstedt/oss-framework/storage`, which
  checks it before returning.

The message contract and the shell's reference half (expo-camera, and the
camera permission string) are in
[`docs/native-shell.md`](../../docs/native-shell.md).
