// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared OAuth 2.0 PKCE helpers used by cloud storage adapters that sign in
// through a full-page browser redirect (Dropbox, and any future provider that
// issues a refresh token). The helpers are pure and stateless; each provider
// owns its own `sessionStorage` key for the verifier so parallel auth flows
// don't race each other.
//
// (Google Drive uses the GIS popup flow instead — see `./gdrive/gis-oauth.ts`.)

import { toBase64Url } from "./base64url.ts";
import { type FetchImpl, readErrorBody } from "./http-utils.ts";
import { type Logger, noopLogger } from "./logger.ts";

/**
 * 64 random bytes encoded as base64url — comfortably above the 43-character
 * minimum the spec requires and well below the 128-character maximum, so the
 * resulting string fits in a URL without truncation.
 */
export function randomVerifier(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function challengeFor(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64Url(new Uint8Array(digest));
}

/**
 * The OAuth app registration must list this exact URI. We derive it from the
 * current page's origin + pathname so a production deploy at `/` and a preview
 * at `/preview/` each round-trip back to themselves — without the pathname, the
 * redirect would land the preview build on production, where the PKCE verifier
 * (stashed under the preview's `sessionStorage` key) is invisible and auth
 * completion bails.
 *
 * The trailing slash is trimmed: Google's OAuth client config rejects redirect
 * URIs that end in `/`, and Dropbox accepts either form, so the slash-less
 * spelling is the only one that satisfies both.
 */
export function redirectUri(): string {
  const pathname = window.location.pathname.replace(/\/+$/, "");
  return `${window.location.origin}${pathname}`;
}

export type TokenResult = {
  accessToken: string;
  refreshToken: string | null;
};

/**
 * All the per-provider knobs the three flow helpers below need. The helpers are
 * uniform across providers; only this record changes.
 *
 * `extraAuthParams` carries the bits providers legitimately differ on (Dropbox
 * needs `token_access_type=offline`, …), merged into the redirect's query
 * string verbatim. `providerName` is the human-readable label that surfaces in
 * thrown error messages.
 */
export type OAuthConfig = {
  authBase: string;
  tokenEndpoint: string;
  clientId: string;
  /**
   * OAuth `state` echoed back by the redirect so a multi-provider app can route
   * the `?code=` to the right token exchange.
   */
  state: string;
  /**
   * `sessionStorage` key for the PKCE verifier. Per-provider so parallel flows
   * don't race each other on the same slot.
   */
  verifierKey: string;
  providerName: string;
  extraAuthParams?: Record<string, string>;
  /** Optional sink for the flow's diagnostics. Defaults to a no-op. */
  logger?: Logger;
};

/**
 * Pick which cloud provider issued an inbound OAuth `?code=`. The authoritative
 * signal is the PKCE verifier stashed in `sessionStorage` before redirecting —
 * exactly one is live during a redirect, so its presence alone identifies the
 * flow. The `state` query param disambiguates only when both are present (an
 * aborted prior flow left a stale verifier behind). Returns `null` when nothing
 * identifies the flow — the caller should log and bail rather than fall through
 * to a hardcoded provider.
 */
export function pickOauthProvider<Id extends string>(args: {
  state: string | null;
  pending: ReadonlyArray<{ id: Id; isPending: boolean }>;
}): Id | null {
  const live = args.pending.filter((p) => p.isPending);
  if (live.length === 1) return live[0]!.id;
  if (live.length > 1) {
    const matched = live.find((p) => p.id === args.state);
    return matched ? matched.id : null;
  }
  return null;
}

/**
 * Kick the user out to the provider's consent screen. Returns nothing — the
 * next thing that happens is a full-page redirect back to the app with
 * `?code=…&state=<config.state>` set.
 */
export async function startAuth(config: OAuthConfig): Promise<void> {
  const log = config.logger ?? noopLogger;
  log.info(
    `${config.providerName}: startAuth (redirect=${redirectUri()}, state=${config.state})`,
  );
  const verifier = randomVerifier();
  sessionStorage.setItem(config.verifierKey, verifier);
  const challenge = await challengeFor(verifier);
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: config.state,
    ...(config.extraAuthParams ?? {}),
  });
  window.location.assign(`${config.authBase}?${params.toString()}`);
}

/**
 * Trade the code from the redirect for an access (and, where the provider
 * issues one, refresh) token. The caller persists both and cleans the URL.
 * Throws on any failure so the caller can surface the error in the UI.
 */
export async function completeAuth(
  config: OAuthConfig,
  code: string,
  fetchImpl: FetchImpl = fetch,
): Promise<TokenResult> {
  const log = config.logger ?? noopLogger;
  log.info(`${config.providerName}: completeAuth (code received)`);
  const verifier = sessionStorage.getItem(config.verifierKey);
  if (!verifier) {
    log.error(
      `${config.providerName}: completeAuth aborted — missing verifier`,
    );
    throw new Error("Missing PKCE verifier — restart the connect flow");
  }
  sessionStorage.removeItem(config.verifierKey);
  const params = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: config.clientId,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const res = await postForm(config, params, fetchImpl, "token exchange");
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!json.access_token) {
    log.error(`${config.providerName}: response missing access_token`);
    throw new Error(
      `${config.providerName} token response missing access_token`,
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
  };
}

/**
 * Trade a refresh token for a fresh access token. Returns the new access token
 * only — the providers we support keep the refresh token stable across calls
 * under PKCE, so the caller only persists the new access token. Throws on any
 * failure so the adapter can fall back to surfacing the original 401.
 */
export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string,
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  const log = config.logger ?? noopLogger;
  log.info(`${config.providerName}: refreshAccessToken`);
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });
  const res = await postForm(config, params, fetchImpl, "refresh");
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    log.error(`${config.providerName}: refresh response missing access_token`);
    throw new Error(
      `${config.providerName} refresh response missing access_token`,
    );
  }
  return json.access_token;
}

// POST a form-encoded body to the token endpoint, timing the round-trip and
// throwing a provider-labelled error on a non-ok status. Shared by the token
// exchange and the refresh, which differ only in their params and label.
async function postForm(
  config: OAuthConfig,
  params: URLSearchParams,
  fetchImpl: FetchImpl,
  op: string,
): Promise<Response> {
  const log = config.logger ?? noopLogger;
  const start = performance.now();
  let res: Response;
  try {
    res = await fetchImpl(config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (err) {
    log.error(`${config.providerName}: ${op} network error`, err);
    throw err;
  }
  const ms = (performance.now() - start).toFixed(0);
  log.info(`${config.providerName}: ${op} → ${res.status} (${ms}ms)`);
  if (!res.ok) {
    const body = await readErrorBody(res);
    log.error(`${config.providerName}: ${op} failed`, body);
    throw new Error(`${config.providerName} ${op} failed: ${res.status}`);
  }
  return res;
}
