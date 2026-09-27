// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  AuthError,
  ConflictError,
  RateLimitError,
} from "../src/storage/index.ts";
import {
  PreconditionError,
  QuotaExceededError,
} from "../src/storage/selfhosted/errors.ts";
import {
  Transport,
  type ServerEvent,
} from "../src/storage/selfhosted/transport.ts";

type Call = { url: string; init?: RequestInit };

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function scripted(
  handler: (
    url: URL,
    init: RequestInit | undefined,
    n: number,
  ) => Response | Promise<Response>,
) {
  const calls: Call[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), init });
    return handler(url, init, calls.length);
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

const signer = {
  serverId: "srv_1",
  deviceId: "dev_1",
  sign: async (m: string) => `sig(${m})`,
};

describe("Transport", () => {
  it("signs in with a signed challenge and sends the bearer token", async () => {
    let tokens = 0;
    const { fetchImpl, calls } = scripted((url) => {
      if (url.pathname === "/base/v1/auth/challenge")
        return json(200, { challenge: "c1" });
      if (url.pathname === "/base/v1/auth/token") {
        tokens++;
        return json(200, {
          token: `t${tokens}`,
          expiresAt: Date.now() + 600_000,
        });
      }
      return json(200, { ok: true });
    });
    const t = new Transport("https://h.example/base", { fetchImpl });
    t.setSigner(signer);
    expect(await t.json("GET", "/v1/me")).toEqual({ ok: true });
    await t.json("GET", "/v1/me");
    expect(tokens).toBe(1);
    const tokenCall = calls.find((c) => c.url.endsWith("/v1/auth/token"))!;
    expect(JSON.parse(String(tokenCall.init!.body))).toEqual({
      deviceId: "dev_1",
      challenge: "c1",
      signature: "sig(oss-storage/v1/auth|srv_1|dev_1|c1)",
    });
    const me = calls.filter((c) => c.url.endsWith("/v1/me"));
    expect((me[0]!.init!.headers as Record<string, string>).Authorization).toBe(
      "Bearer t1",
    );
  });

  it("re-authenticates once on 401, then surfaces AuthError", async () => {
    let meCalls = 0;
    const { fetchImpl } = scripted((url) => {
      if (url.pathname.endsWith("/challenge"))
        return json(200, { challenge: "c" });
      if (url.pathname.endsWith("/token"))
        return json(200, { token: "t", expiresAt: Date.now() + 600_000 });
      meCalls++;
      return meCalls === 1
        ? json(401, { error: { code: "unauthenticated", message: "expired" } })
        : json(200, {});
    });
    const t = new Transport("https://h.example", { fetchImpl });
    t.setSigner(signer);
    await t.json("GET", "/v1/me");
    expect(meCalls).toBe(2);

    const { fetchImpl: always401 } = scripted((url) =>
      url.pathname.endsWith("/challenge")
        ? json(200, { challenge: "c" })
        : url.pathname.endsWith("/token")
          ? json(200, { token: "t", expiresAt: Date.now() + 600_000 })
          : json(401, {
              error: { code: "unauthenticated", message: "revoked" },
            }),
    );
    const t2 = new Transport("https://h.example", { fetchImpl: always401 });
    t2.setSigner(signer);
    await expect(t2.json("GET", "/v1/me")).rejects.toBeInstanceOf(AuthError);
  });

  it("maps statuses to typed errors", async () => {
    const cases: [Response, unknown][] = [
      [
        json(412, {
          error: { code: "conflict", message: "m", current: { rev: "7" } },
        }),
        PreconditionError,
      ],
      [
        json(
          429,
          { error: { code: "rate_limited", message: "m" } },
          { "Retry-After": "3" },
        ),
        RateLimitError,
      ],
      [
        json(507, {
          error: {
            code: "quota_exceeded",
            message: "m",
            usedBytes: 5,
            quotaBytes: 4,
          },
        }),
        QuotaExceededError,
      ],
    ];
    for (const [res, type] of cases) {
      const t = new Transport("https://h.example", {
        fetchImpl: (async () => res) as typeof fetch,
      });
      const err = await t
        .json("GET", "/v1/info", { auth: false })
        .catch((e) => e);
      expect(err).toBeInstanceOf(type as never);
      if (err instanceof RateLimitError) expect(err.retryAfterMs).toBe(3000);
      if (err instanceof PreconditionError)
        expect(err.current).toEqual({ rev: "7" });
    }
    expect(ConflictError).toBeDefined();
  });

  it("parses the SSE stream and stops when aborted", async () => {
    const encoder = new TextEncoder();
    const { fetchImpl } = scripted((url) => {
      if (url.pathname.endsWith("/challenge"))
        return json(200, { challenge: "c" });
      if (url.pathname.endsWith("/token"))
        return json(200, { token: "t", expiresAt: Date.now() + 600_000 });
      const body = new ReadableStream({
        start(c) {
          c.enqueue(
            encoder.encode(
              'retry: 3000\n\nevent: hello\ndata: {"type":"hello","serverId":"s","time":1}\n\n: ping\n\nevent: ns\ndata: {"type":"ns",',
            ),
          );
          c.enqueue(encoder.encode('"ns":"ns_1","seq":4}\n\n'));
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    });
    const t = new Transport("https://h.example", { fetchImpl });
    t.setSigner(signer);
    const ac = new AbortController();
    const got: ServerEvent[] = [];
    const done = t.events(
      (e) => {
        got.push(e);
        if (got.length === 2) ac.abort();
      },
      { signal: ac.signal },
    );
    await done;
    expect(got).toEqual([
      { type: "hello", serverId: "s", time: 1 },
      { type: "ns", ns: "ns_1", seq: 4 },
    ]);
  });
});
