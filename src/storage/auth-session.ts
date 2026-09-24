// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The page's half of the IN-APP SIGN-IN — an authentication session a host
// offers.
//
// A phone wrapper serves the app in a WebView from its own origin (a loopback
// `http://localhost:<port>`, or `file://`). The redirect flow in
// `./oauth-pkce.ts` cannot finish there: the providers refuse to show their
// consent screen inside an embedded WebView, so the wrapper sends it to the
// system browser — and the redirect then lands in that browser, on an origin
// the provider does not know and a page that does not hold the PKCE verifier.
//
// What the platform offers instead is an AUTHENTICATION SESSION (on iOS,
// `ASWebAuthenticationSession`; on Android, a Custom Tab): a browser sheet the
// app opens over itself, which closes the moment the provider redirects to a
// URI the app claims, and hands that URI back. That is a native API, so a host
// has to offer it — and this is the seam it offers it through.
//
// The seam is a CAPABILITY, not an identity. The page never asks whether it is
// running inside a wrapper; it asks whether a window property carries an
// auth-session host, and a browser (which has none) keeps the redirect flow.
// Every decision — the PKCE challenge, the `state` check, the token exchange —
// stays on this side, in `runAuthSessionAuth`. The host opens a URL and hands
// back where it ended; it never sees a token.

/** Where a host installs itself. Framework-wide rather than per app, so the
 *  one injected script serves every app a wrapper is built around. */
export const AUTH_SESSION_HOST_PROPERTY = "__ossAuthSession";

/** The event a host fires once it has installed itself. A host injected after
 *  the page has loaded can land either side of the app's first render; an app
 *  that shows or hides something on the host's presence listens for this. */
export const AUTH_SESSION_HOST_EVENT = "oss:auth-session-host";

/**
 * What a host has to provide.
 *
 * `redirectUri` is the host's to choose because only the host can claim it —
 * a custom scheme registered to the app (`calc://oauth`), for instance. The
 * provider's app registration must list that exact string.
 */
export type AuthSessionHost = {
  /** Bumped only for a breaking change to the shape below; a host announcing
   *  a version this build does not know is ignored rather than called with the
   *  wrong arguments. */
  readonly version: 1;
  /** The URI the host catches. The authorization request carries it, and the
   *  token exchange replays it. */
  readonly redirectUri: string;
  /**
   * Open `url` in an authentication session and resolve with the full URL the
   * provider redirected to once it reaches `redirectUri` — query string and
   * all, unread. Resolves `null` when the user closed the sheet. Rejects when
   * the session could not be opened at all.
   */
  open(url: string): Promise<string | null>;
};

type HostWindow = { [AUTH_SESSION_HOST_PROPERTY]?: unknown };

/**
 * The installed host, or null. Validates the shape rather than trusting it:
 * the value arrives from code outside this bundle.
 */
export function getAuthSessionHost(
  win: object | undefined = typeof window !== "undefined" ? window : undefined,
): AuthSessionHost | null {
  if (!win) return null;
  const candidate = (win as HostWindow)[AUTH_SESSION_HOST_PROPERTY];
  if (typeof candidate !== "object" || candidate === null) return null;
  const host = candidate as Partial<AuthSessionHost>;
  if (host.version !== 1) return null;
  if (typeof host.redirectUri !== "string" || host.redirectUri === "") {
    return null;
  }
  if (typeof host.open !== "function") return null;
  return host as AuthSessionHost;
}
