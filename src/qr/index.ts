// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public QR surface, available under the "@niclaslindstedt/oss-framework/qr"
// subpath: a dependency-free encoder, an SVG renderer and a React component.

export {
  encodeQr,
  type Ecl,
  type QrCode as QrMatrix,
  type QrOptions,
} from "./encode.ts";
export { qrPath, qrToSvg, QR_QUIET_ZONE } from "./svg.ts";
export { QrCode, type QrCodeProps } from "./QrCode.tsx";
