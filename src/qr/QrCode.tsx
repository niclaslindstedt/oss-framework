// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// <QrCode value="…" /> — renders a scannable QR code as inline SVG. It is
// always dark-on-white with a quiet zone, whatever the theme: an inverted or
// borderless code is one many phone cameras refuse to read.

import { useMemo } from "react";

import { encodeQr, type Ecl } from "./encode.ts";
import { QR_QUIET_ZONE, qrPath } from "./svg.ts";

export type QrCodeProps = {
  value: string;
  /** Rendered size in CSS pixels. Default 240. */
  size?: number;
  /** Error-correction level. Default "M". */
  ecl?: Ecl;
  /** Accessible label; the payload itself is usually a secret, so do not echo it. */
  label?: string;
  className?: string;
};

export function QrCode({
  value,
  size = 240,
  ecl = "M",
  label = "QR code",
  className,
}: QrCodeProps) {
  const qr = useMemo(() => encodeQr(value, { ecl }), [value, ecl]);
  const view = qr.size + QR_QUIET_ZONE * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${view} ${view}`}
      shapeRendering="crispEdges"
      style={{ display: "block", background: "#ffffff", borderRadius: 8 }}
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path d={qrPath(qr)} fill="#000000" />
    </svg>
  );
}
