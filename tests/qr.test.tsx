// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { render } from "@testing-library/react";
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";

import {
  encodeQr,
  QrCode,
  qrToSvg,
  type Ecl,
  type QrMatrix,
} from "../src/qr/index.ts";

function decode(qr: QrMatrix): string | null {
  const scale = 4;
  const border = 4;
  const dim = (qr.size + border * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4);
  for (let py = 0; py < dim; py++) {
    for (let px = 0; px < dim; px++) {
      const x = Math.floor(px / scale) - border;
      const y = Math.floor(py / scale) - border;
      const dark =
        x >= 0 && y >= 0 && x < qr.size && y < qr.size && qr.modules[y]![x];
      const i = (py * dim + px) * 4;
      data[i] = data[i + 1] = data[i + 2] = dark ? 0 : 255;
      data[i + 3] = 255;
    }
  }
  return jsQR(data, dim, dim)?.data ?? null;
}

describe("QR encoder", () => {
  it("round-trips pairing payloads and many sizes/levels", () => {
    const uri =
      "oss-storage://pair?v=1&s=https%3A%2F%2Fhome.example&x=Q2hhbGxlbmdlLWNvZGUtMzItYnl0ZXMtYmFzZTY0dXJs";
    expect(decode(encodeQr(uri))).toBe(uri);
    for (const len of [1, 40, 200, 600]) {
      for (const ecl of ["L", "M", "Q", "H"] as Ecl[]) {
        const text = Array.from({ length: len }, (_, i) =>
          String.fromCharCode(48 + (i % 60)),
        ).join("");
        expect(decode(encodeQr(text, { ecl }))).toBe(text);
      }
    }
    expect(decode(encodeQr("Hälsa ✓"))).toBe("Hälsa ✓");
  });

  it("renders SVG and a React component with an accessible label", () => {
    const qr = encodeQr("hello");
    expect(qrToSvg(qr)).toMatch(/^<svg[^>]+viewBox="0 0 29 29"/);
    const { container, getByRole } = render(
      <QrCode value="hello" size={100} label="Pairing code" />,
    );
    expect(getByRole("img", { name: "Pairing code" })).toBeTruthy();
    expect(container.querySelector("path")!.getAttribute("d")).toContain(
      "M4,4",
    );
  });
});
