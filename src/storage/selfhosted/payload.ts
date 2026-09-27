// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What pairing and invite QR codes carry (SPEC §9), and how apps parse what
// was scanned or pasted — a bare `oss-storage://…` URI, or an app link
// `https://app.example/#oss=<base64url(uri)>`.

import { b64u, unb64u, fromUtf8, utf8 } from "./crypto.ts";

export type PairingPayload = {
  kind: "pair";
  server: string;
  /** Server-minted pairing code (console / CLI / admin page). */
  code?: string;
  /** Device-created: the secret X (code and key are derived from it). */
  secret?: Uint8Array;
  name?: string;
  /** SHA-256 of the server's TLS public key, for native pinning. */
  fp?: string;
};

export type InvitePayload = {
  kind: "invite";
  server: string;
  secret: Uint8Array;
  role?: "editor" | "viewer";
  name?: string;
};

export type Payload = PairingPayload | InvitePayload;

export class PayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadError";
  }
}

function checkServer(url: string | null): string {
  if (!url) throw new PayloadError("the code names no server");
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new PayloadError("the code's server URL is malformed");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:")
    throw new PayloadError("the server URL must be http(s)");
  return url.replace(/\/+$/, "");
}

/** Parse a scanned or pasted payload (URI or app link). */
export function parsePayload(input: string): Payload {
  let text = input.trim();
  const hash = text.indexOf("#oss=");
  if (hash >= 0) {
    try {
      text = fromUtf8(unb64u(text.slice(hash + 5).split("&")[0]!));
    } catch {
      throw new PayloadError("the link is damaged");
    }
  }
  const m = /^oss-storage:\/\/(pair|invite)\?(.*)$/.exec(text);
  if (!m) throw new PayloadError("not a storage pairing or invite code");
  const q = new URLSearchParams(m[2]);
  if (q.get("v") !== "1") throw new PayloadError("this code needs a newer app");
  const server = checkServer(q.get("s"));
  const secret = q.get("x");
  const decodeSecret = () => {
    try {
      const s = unb64u(secret!);
      if (s.length !== 32) throw new Error();
      return s;
    } catch {
      throw new PayloadError("the code's secret is damaged");
    }
  };
  if (m[1] === "pair") {
    const code = q.get("c") ?? undefined;
    if (!code && !secret)
      throw new PayloadError(
        "the code carries neither a pairing code nor a secret",
      );
    return {
      kind: "pair",
      server,
      ...(code ? { code } : {}),
      ...(secret ? { secret: decodeSecret() } : {}),
      ...(q.get("n") ? { name: q.get("n")! } : {}),
      ...(q.get("fp") ? { fp: q.get("fp")! } : {}),
    };
  }
  if (!secret) throw new PayloadError("the invite carries no secret");
  const role = q.get("r");
  return {
    kind: "invite",
    server,
    secret: decodeSecret(),
    ...(role === "editor" || role === "viewer" ? { role } : {}),
    ...(q.get("n") ? { name: q.get("n")! } : {}),
  };
}

export function formatPayload(p: Payload, appUrl?: string): string {
  const q = new URLSearchParams({ v: "1", s: p.server });
  if (p.kind === "pair") {
    if (p.code) q.set("c", p.code);
    if (p.secret) q.set("x", b64u(p.secret));
    if (p.fp) q.set("fp", p.fp);
  } else {
    q.set("x", b64u(p.secret));
    if (p.role) q.set("r", p.role);
  }
  if (p.name) q.set("n", p.name);
  const uri = `oss-storage://${p.kind}?${q.toString()}`;
  return appUrl ? `${appUrl}#oss=${b64u(utf8(uri))}` : uri;
}
