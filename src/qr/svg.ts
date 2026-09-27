// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A QR code as a standalone SVG string: one path, crisp at any size, with
// the four-module quiet zone scanners need.

import type { QrCode } from "./encode.ts";

export const QR_QUIET_ZONE = 4;

/** The SVG path data (`d`) for the dark modules, offset by the quiet zone. */
export function qrPath(qr: QrCode): string {
  let d = "";
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y]![x])
        d += `M${x + QR_QUIET_ZONE},${y + QR_QUIET_ZONE}h1v1h-1z`;
    }
  }
  return d;
}

export function qrToSvg(
  qr: QrCode,
  options: { size?: number; dark?: string; light?: string } = {},
): string {
  const view = qr.size + QR_QUIET_ZONE * 2;
  const size = options.size ?? view * 6;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="${options.light ?? "#ffffff"}"/>` +
    `<path d="${qrPath(qr)}" fill="${options.dark ?? "#000000"}"/></svg>`
  );
}
