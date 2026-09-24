// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
//
// The in-app half of the OAuth flow (`runAuthSessionAuth`) and the seam a host
// fills (`getAuthSessionHost`). The host only opens a browser sheet and hands
// back where it ended, so everything worth getting wrong is here: which URI
// the provider is told to redirect to, that the SAME URI is replayed at the
// token endpoint, that a callback carrying someone else's `state` — or landing
// somewhere other than the redirect URI — never gets its code spent, and that
// a failed or cancelled attempt leaves no verifier behind.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_SESSION_HOST_PROPERTY,
  type AuthSessionHost,
  getAuthSessionHost,
} from "../src/storage/auth-session.ts";
import type { OAuthConfig } from "../src/storage/oauth-pkce.ts";
import {
  isAuthCancelled,
  runAuthSessionAuth,
} from "../src/storage/oauth-pkce.ts";

const REDIRECT = "calc://oauth";

const CONFIG: OAuthConfig = {
  authBase: "https://provider.test/oauth2/authorize",
  tokenEndpoint: "https://provider.test/oauth2/token",
  clientId: "test-client",
  state: "dropbox",
  verifierKey: "test:pkce:verifier",
  providerName: "Dropbox",
  extraAuthParams: { token_access_type: "offline" },
};

function tokenResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** A host whose sheet "ends" on `landed` — or on whatever the test computes
 *  from the URL it was asked to open. */
function hostLandingOn(
  landed: string | null | ((url: string) => string | null),
): AuthSessionHost & { open: ReturnType<typeof vi.fn> } {
  return {
    version: 1,
    redirectUri: REDIRECT,
    open: vi.fn(async (url: string) =>
      typeof landed === "function" ? landed(url) : landed,
    ),
  };
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runAuthSessionAuth", () => {
  it("sends the provider to the host's redirect URI and replays it at the token endpoint", async () => {
    const host = hostLandingOn(`${REDIRECT}?code=auth-code&state=dropbox`);
    const fetchImpl = vi.fn(async () =>
      tokenResponse({ access_token: "at", refresh_token: "rt" }),
    );

    const result = await runAuthSessionAuth(
      CONFIG,
      host,
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ accessToken: "at", refreshToken: "rt" });

    expect(host.open).toHaveBeenCalledTimes(1);
    const url = new URL(host.open.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe(CONFIG.authBase);
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBe("dropbox");
    expect(url.searchParams.get("token_access_type")).toBe("offline");

    const [endpoint, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(endpoint).toBe(CONFIG.tokenEndpoint);
    const body = new URLSearchParams(init.body as string);
    expect(body.get("redirect_uri")).toBe(REDIRECT);
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("code_verifier")).toBeTruthy();

    // Nothing navigated: the page that started the flow finishes it.
    expect(sessionStorage.getItem(CONFIG.verifierKey)).toBeNull();
  });

  it("does not navigate the page", async () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      assign,
    } as Location);
    const host = hostLandingOn(null);
    await expect(runAuthSessionAuth(CONFIG, host)).rejects.toThrow();
    expect(assign).not.toHaveBeenCalled();
  });

  it("tolerates a trailing slash and a fragment on the callback", async () => {
    const host = hostLandingOn(`${REDIRECT}/?code=c&state=dropbox#_=_`);
    const fetchImpl = vi.fn(async () => tokenResponse({ access_token: "at" }));
    await expect(
      runAuthSessionAuth(CONFIG, host, fetchImpl as unknown as typeof fetch),
    ).resolves.toEqual({ accessToken: "at", refreshToken: null });
  });

  it("never spends a code that came back with someone else's state", async () => {
    const host = hostLandingOn(`${REDIRECT}?code=auth-code&state=not-ours`);
    const fetchImpl = vi.fn();
    await expect(
      runAuthSessionAuth(CONFIG, host, fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/unexpected state/i);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CONFIG.verifierKey)).toBeNull();
  });

  it("never reads a callback that landed somewhere other than the redirect URI", async () => {
    const host = hostLandingOn(
      "https://elsewhere.test/oauth?code=auth-code&state=dropbox",
    );
    const fetchImpl = vi.fn();
    await expect(
      runAuthSessionAuth(CONFIG, host, fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/other than the redirect URI/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces a declined consent with the provider's own description", async () => {
    const host = hostLandingOn(
      `${REDIRECT}?error=access_denied&error_description=${encodeURIComponent(
        "The user chose not to continue",
      )}&state=dropbox`,
    );
    await expect(runAuthSessionAuth(CONFIG, host)).rejects.toThrow(
      /The user chose not to continue/,
    );
    expect(sessionStorage.getItem(CONFIG.verifierKey)).toBeNull();
  });

  it("reports a closed sheet as a cancellation, and leaves no verifier", async () => {
    const host = hostLandingOn(null);
    const err = await runAuthSessionAuth(CONFIG, host).catch((e: unknown) => e);
    expect(isAuthCancelled(err)).toBe(true);
    expect(isAuthCancelled(new Error("boom"))).toBe(false);
    expect(sessionStorage.getItem(CONFIG.verifierKey)).toBeNull();
  });

  it("drops the verifier when the host could not open a session", async () => {
    const host = hostLandingOn(null);
    host.open.mockRejectedValueOnce(new Error("another session is open"));
    await expect(runAuthSessionAuth(CONFIG, host)).rejects.toThrow(
      /another session/,
    );
    expect(sessionStorage.getItem(CONFIG.verifierKey)).toBeNull();
  });
});

describe("getAuthSessionHost", () => {
  const at = (value: unknown) =>
    getAuthSessionHost({ [AUTH_SESSION_HOST_PROPERTY]: value });
  const good = { version: 1, redirectUri: REDIRECT, open: () => null };

  it("is null where no host installed itself — the web", () => {
    expect(getAuthSessionHost({})).toBeNull();
    expect(getAuthSessionHost(window)).toBeNull();
  });

  it("finds a well-formed host under the framework-wide property", () => {
    expect(AUTH_SESSION_HOST_PROPERTY).toBe("__ossAuthSession");
    expect(at(good)).toBe(good);
  });

  it("ignores a host of a version it does not know", () => {
    expect(at({ ...good, version: 2 })).toBeNull();
  });

  it("ignores a host with no redirect URI or no open", () => {
    expect(at({ ...good, redirectUri: "" })).toBeNull();
    expect(at({ ...good, redirectUri: 7 })).toBeNull();
    expect(at({ ...good, open: "yes" })).toBeNull();
    expect(at(null)).toBeNull();
    expect(at("host")).toBeNull();
  });
});
