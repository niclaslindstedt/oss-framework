// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public QR surface, available under the "@niclaslindstedt/oss-framework/qr"
// subpath: a dependency-free encoder, an SVG renderer and a React component
// to show a code, and `scanQrCode` to read one through a native shell.

export {
  encodeQr,
  type Ecl,
  type QrCode as QrMatrix,
  type QrOptions,
} from "./encode.ts";
export { qrPath, qrToSvg, QR_QUIET_ZONE } from "./svg.ts";
export { QrCode, type QrCodeProps } from "./QrCode.tsx";
export {
  scanQrCode,
  canScanQrCode,
  ScanQrError,
  SCAN_QR_MESSAGE,
  SCAN_QR_RESULT_EVENT,
  type ScanQrFailure,
  type ScanQrLabels,
  type ScanQrMessage,
  type ScanQrResult,
} from "./scan.ts";
