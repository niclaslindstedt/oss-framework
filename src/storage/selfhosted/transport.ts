// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HTTP to the storage server: sign-in by signing a server challenge with the
// device key, short-lived bearer tokens refreshed transparently, typed errors
// the storage contract already knows how to react to, and the live event
// stream (Server-Sent Events over `fetch`, so the bearer token travels in a
// header rather than a URL).

import { AuthError, RateLimitError } from "../adapter.ts";
import { parseRetryAfterMs, type FetchImpl } from "../http-utils.ts";
import { type Logger, noopLogger } from "../logger.ts";
import { authMessage } from "./crypto.ts";
import {
  ApiRequestError,
  CursorExpiredError,
  ForbiddenError,
  NotFoundError,
  PreconditionError,
  QuotaExceededError,
} from "./errors.ts";

export type Signer = {
  serverId: string;
  deviceId: string;
  sign(message: string): Promise<string>;
};

export type RequestOptions = {
  json?: unknown;
  body?: Uint8Array;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  /** Send the bearer token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
};

export type ServerEvent =
  | { type: "hello"; serverId: string; time: number }
  | { type: "ns"; ns: string; seq: number }
  | { type: "namespaces" }
  | { type: "device"; deviceId: string; revoked: boolean };

// The server sends an exact Retry-After; this is only the floor when it does not.
const RATE_LIMIT_FALLBACK_MS = 1000;

/** Map an error response to the typed error a caller can act on. */
export async function errorFor(res: Response): Promise<Error> {
  let body: {
    error?: { code?: string; message?: string; [k: string]: unknown };
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // not JSON
  }
  const e = body.error ?? {};
  const message = e.message ?? `HTTP ${res.status}`;
  switch (res.status) {
    case 401:
      return new AuthError(message);
    case 403:
      return new ForbiddenError(message);
    case 404:
      return new NotFoundError(message);
    case 409:
    case 412:
      if (res.status === 412 || "current" in e) {
        return new PreconditionError(
          (e.current as Record<string, unknown> | null | undefined) ?? null,
        );
      }
      return new ApiRequestError(res.status, e.code ?? "conflict", message, e);
    case 410:
      return new CursorExpiredError();
    case 429:
      return new RateLimitError(
        parseRetryAfterMs(res.headers, RATE_LIMIT_FALLBACK_MS),
      );
    case 507:
      return new QuotaExceededError(
        Number(e.usedBytes ?? 0),
        Number(e.quotaBytes ?? 0),
      );
    default:
      return new ApiRequestError(res.status, e.code ?? "error", message, e);
  }
}

export class Transport {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private pendingAuth: Promise<string> | null = null;
  private signer: Signer | null = null;
  readonly fetchImpl: FetchImpl;
  readonly log: Logger;

  constructor(
    readonly serverUrl: string,
    opts: { fetchImpl?: FetchImpl; logger?: Logger } = {},
  ) {
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
    this.log = opts.logger ?? noopLogger;
  }

  setSigner(signer: Signer | null): void {
    this.signer = signer;
    this.token = null;
  }

  private url(path: string, query?: RequestOptions["query"]): string {
    const u = new URL(
      path,
      this.serverUrl.endsWith("/") ? this.serverUrl : `${this.serverUrl}/`,
    );
    u.pathname = (
      new URL(this.serverUrl).pathname.replace(/\/$/, "") + path
    ).replace(/\/{2,}/g, "/");
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) u.searchParams.set(k, String(v));
    }
    return u.toString();
  }

  private async signIn(): Promise<string> {
    const s = this.signer;
    if (!s) throw new AuthError("this device is not paired");
    const ch = await this.fetchImpl(this.url("/v1/auth/challenge"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: s.deviceId }),
    });
    if (!ch.ok) throw await errorFor(ch);
    const { challenge } = (await ch.json()) as { challenge: string };
    const signature = await s.sign(
      authMessage(s.serverId, s.deviceId, challenge),
    );
    const tok = await this.fetchImpl(this.url("/v1/auth/token"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: s.deviceId, challenge, signature }),
    });
    if (!tok.ok) throw await errorFor(tok);
    const out = (await tok.json()) as { token: string; expiresAt: number };
    this.token = out.token;
    // Refresh a little early; server and device clocks may differ.
    this.tokenExpiresAt =
      Date.now() + Math.max(10_000, out.expiresAt - Date.now() - 30_000);
    return out.token;
  }

  /** A valid token, signing in (once, for concurrent callers) when needed. */
  async accessToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() < this.tokenExpiresAt)
      return this.token;
    this.pendingAuth ??= this.signIn().finally(() => {
      this.pendingAuth = null;
    });
    return this.pendingAuth;
  }

  /** Perform a request; non-2xx answers become typed errors. */
  async request(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<Response> {
    const headers: Record<string, string> = { ...opts.headers };
    let body: BodyInit | undefined;
    if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.json);
    } else if (opts.body !== undefined) {
      headers["Content-Type"] ??= "application/octet-stream";
      body = new Uint8Array(opts.body);
    }
    const auth = opts.auth !== false;
    const send = async (force: boolean) => {
      if (auth)
        headers.Authorization = `Bearer ${await this.accessToken(force)}`;
      return this.fetchImpl(this.url(path, opts.query), {
        method,
        headers,
        body,
        signal: opts.signal,
      });
    };
    let res = await send(false);
    if (res.status === 401 && auth && this.signer) {
      this.log.info("401 — signing in again");
      res = await send(true);
    }
    if (!res.ok) throw await errorFor(res);
    return res;
  }

  async json<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const res = await this.request(method, path, opts);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /**
   * Follow `/v1/events` until `signal` aborts, reconnecting with backoff.
   * Resolves when aborted; an authentication failure is reported through
   * `onError` and ends the stream (the device was revoked or signed out).
   */
  async events(
    onEvent: (event: ServerEvent) => void,
    opts: {
      signal: AbortSignal;
      onError?: (err: unknown) => void;
      maxBackoffMs?: number;
    },
  ): Promise<void> {
    let delay = 500;
    while (!opts.signal.aborted) {
      try {
        const res = await this.request("GET", "/v1/events", {
          signal: opts.signal,
          headers: { Accept: "text/event-stream" },
        });
        delay = 500;
        await readSse(res, onEvent, opts.signal);
      } catch (err) {
        if (opts.signal.aborted) return;
        opts.onError?.(err);
        if (err instanceof AuthError) return;
      }
      if (opts.signal.aborted) return;
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, opts.maxBackoffMs ?? 30_000);
    }
  }
}

async function readSse(
  res: Response,
  onEvent: (e: ServerEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const stop = () => void reader.cancel().catch(() => {});
  signal.addEventListener("abort", stop, { once: true });
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        try {
          onEvent(JSON.parse(data) as ServerEvent);
        } catch {
          // ignore malformed events
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", stop);
  }
}
