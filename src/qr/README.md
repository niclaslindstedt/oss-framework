<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/qr`

Show a scannable QR code — a device-pairing code, a share invite, a link —
with no dependency.

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
