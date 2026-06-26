// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Dropbox backend. Talks to the v2 HTTP API directly (no SDK — a handful of
// endpoints don't justify ~100 kB of bundle) and stores files under the app's
// scoped folder.
//
// `createDropboxFileStore` returns the byte-level `FileStore` — the seam an app
// with a custom on-disk layout binds its own adapter over.
// `createDropboxAdapter` is the convenience path: it wraps that store in the
// framework's single-file binding so a whole document lands as one file.
//
// The OAuth app key and folder name are the app's to supply — register a
// "Scoped access" app with permission type "App folder" at
// https://www.dropbox.com/developers/apps and pass the resulting key in.

import { AuthError, RateLimitError, type StorageAdapter } from "../adapter.ts";
import { createFileStoreAdapter } from "../file-store-adapter.ts";
import type { FileEntry, FileStore } from "../file-store.ts";
import {
  bearerAuthHeader,
  createRequestLog,
  type FetchImpl,
  parseRetryAfterMs,
  readErrorBody,
} from "../http-utils.ts";
import { type Logger, noopLogger } from "../logger.ts";
import {
  type OAuthConfig,
  type TokenResult,
  completeAuth,
  refreshAccessToken,
  startAuth,
} from "../oauth-pkce.ts";

const TOKEN_ENDPOINT = "https://api.dropboxapi.com/oauth2/token";
const AUTH_BASE = "https://www.dropbox.com/oauth2/authorize";
const UPLOAD_ENDPOINT = "https://content.dropboxapi.com/2/files/upload";
const DOWNLOAD_ENDPOINT = "https://content.dropboxapi.com/2/files/download";
const LIST_FOLDER_ENDPOINT = "https://api.dropboxapi.com/2/files/list_folder";
const LIST_FOLDER_CONTINUE_ENDPOINT =
  "https://api.dropboxapi.com/2/files/list_folder/continue";
const DELETE_ENDPOINT = "https://api.dropboxapi.com/2/files/delete_v2";

// 1-second coalescing window so cloud sync matches local-storage "save on every
// change" in feel — rapid edits within a single gesture collapse into one
// network save.
const SAVE_DEBOUNCE_MS = 1000;

// Floor for the cooldown after Dropbox returns 429 "too_many_write_operations".
const RATE_LIMIT_FALLBACK_MS = 5000;

// `sessionStorage` survives the OAuth redirect round-trip but is scoped to the
// tab, so a parallel auth flow in another tab can't race with this.
const PKCE_VERIFIER_KEY = "oss:dropbox:pkce:verifier";

/**
 * Serialize an argument struct for the `Dropbox-API-Arg` header. ASCII-escape
 * every character at or above U+0080 to its `\uXXXX` form — the browser's
 * `fetch` refuses header values above U+00FF, and Dropbox decodes the escapes
 * back to the original string.
 */
export function dropboxApiArg(arg: unknown): string {
  return JSON.stringify(arg).replace(
    /[\u0080-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

/**
 * Live access to the user's Dropbox tokens. The access token is short-lived
 * (~4 hours), so the adapter holds a mutable copy and exchanges the refresh
 * token for a fresh one on any 401 before retrying. `refreshToken` may be null
 * for legacy connections authorized before refresh tokens were captured. Pass a
 * bare string for the simple, refresh-less case.
 */
export type DropboxAuth = {
  accessToken: string;
  refreshToken: string | null;
  onAccessTokenRefreshed: (accessToken: string) => void;
};

export type DropboxFileStoreOptions = {
  /** Path the store is scoped to (e.g. `/sub`); empty resolves at app-folder root. */
  rootPath?: string;
  fetchImpl?: FetchImpl;
  /** OAuth app key — only needed for the silent-refresh path of a 401. */
  appKey?: string;
  logger?: Logger;
};

type DropboxEntry = {
  ".tag": "file" | "folder" | "deleted";
  path_display?: string;
  path_lower?: string;
  rev?: string;
};

type ListFolderResult = {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
};

/** Build the byte-level `FileStore` for a Dropbox connection. */
export function createDropboxFileStore(
  auth: string | DropboxAuth,
  options: DropboxFileStoreOptions = {},
): FileStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const log = options.logger ?? noopLogger;
  const rootPath = options.rootPath ?? "";
  const authedFetch = createAuthedFetch(
    auth,
    fetchImpl,
    log,
    options.appKey ?? "",
  );
  const rootPrefix = `${rootPath}/`.toLowerCase();

  function relativePath(entry: DropboxEntry): string | null {
    const full = entry.path_display ?? entry.path_lower;
    if (!full) return null;
    if (full.toLowerCase().startsWith(rootPrefix)) {
      return full.slice(rootPrefix.length);
    }
    return null;
  }

  async function listOnce(
    endpoint: string,
    body: unknown,
  ): Promise<ListFolderResult | null> {
    const res = await authedFetch(endpoint, (token) => ({
      method: "POST",
      headers: {
        ...bearerAuthHeader(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }));
    if (res.status === 409) return null; // path/not_found — empty folder
    if (!res.ok) {
      const detail = await readErrorBody(res);
      throw new Error(`Dropbox list_folder failed: ${res.status} ${detail}`);
    }
    return (await res.json()) as ListFolderResult;
  }

  return {
    async list(): Promise<FileEntry[]> {
      let page = await listOnce(LIST_FOLDER_ENDPOINT, {
        path: rootPath,
        recursive: true,
      });
      if (!page) return [];
      const out: FileEntry[] = [];
      for (;;) {
        for (const entry of page.entries) {
          if (entry[".tag"] !== "file") continue;
          const path = relativePath(entry);
          if (path) out.push({ path, rev: entry.rev });
        }
        if (!page.has_more) break;
        const next = await listOnce(LIST_FOLDER_CONTINUE_ENDPOINT, {
          cursor: page.cursor,
        });
        if (!next) break;
        page = next;
      }
      return out;
    },

    async read(path: string): Promise<string | null> {
      const res = await authedFetch(
        DOWNLOAD_ENDPOINT,
        (token) => ({
          method: "POST",
          headers: {
            ...bearerAuthHeader(token),
            "Dropbox-API-Arg": dropboxApiArg({ path: `${rootPath}/${path}` }),
          },
        }),
        `download ${path}`,
      );
      if (res.status === 409) return null;
      if (!res.ok) {
        const detail = await readErrorBody(res);
        throw new Error(`Dropbox download failed: ${res.status} ${detail}`);
      }
      return res.text();
    },

    async write(path: string, text: string): Promise<void> {
      const res = await authedFetch(
        UPLOAD_ENDPOINT,
        (token) => ({
          method: "POST",
          headers: {
            ...bearerAuthHeader(token),
            "Dropbox-API-Arg": dropboxApiArg({
              path: `${rootPath}/${path}`,
              mode: "overwrite",
              mute: true,
            }),
            "Content-Type": "application/octet-stream",
          },
          body: text,
        }),
        `upload ${path}`,
      );
      if (res.status === 429) {
        throw new RateLimitError(
          parseRetryAfterMs(res.headers, RATE_LIMIT_FALLBACK_MS),
        );
      }
      if (!res.ok) {
        const detail = await readErrorBody(res);
        throw new Error(`Dropbox upload failed: ${res.status} ${detail}`);
      }
    },

    async remove(path: string): Promise<void> {
      const res = await authedFetch(DELETE_ENDPOINT, (token) => ({
        method: "POST",
        headers: {
          ...bearerAuthHeader(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: `${rootPath}/${path}` }),
      }));
      if (res.status === 409) return; // already gone
      if (!res.ok) {
        const detail = await readErrorBody(res);
        throw new Error(`Dropbox delete failed: ${res.status} ${detail}`);
      }
    },
  };
}

export type CreateDropboxAdapterOptions = DropboxFileStoreOptions & {
  /** Relative path the document is stored under. Defaults to `document.json`. */
  fileName?: string;
};

/** Whole-document Dropbox adapter: the document lives as one file in the app folder. */
export function createDropboxAdapter(
  auth: string | DropboxAuth,
  options: CreateDropboxAdapterOptions = {},
): StorageAdapter {
  const store = createDropboxFileStore(auth, options);
  return createFileStoreAdapter(store, {
    id: "dropbox",
    label: "Dropbox",
    fileName: options.fileName,
    saveDebounceMs: SAVE_DEBOUNCE_MS,
    logger: options.logger,
  });
}

type AuthedFetch = (
  url: string,
  build: (token: string) => RequestInit,
  // Optional human label for the sync log (e.g. `download x.md`). The file store
  // passes the relative path so a failure names the file — never the access
  // token or contents. Defaults to the URL's host + path.
  label?: string,
) => Promise<Response>;

// Build the bearer-token fetch the file store runs on: issue with the current
// access token, and on a 401 swap in a fresh one via the refresh token
// (coalescing concurrent refreshes) and retry exactly once before surfacing
// `AuthError`.
function createAuthedFetch(
  auth: string | DropboxAuth,
  fetchImpl: FetchImpl,
  log: Logger,
  appKey: string,
): AuthedFetch {
  let currentAccessToken: string;
  let refreshToken: string | null;
  let onAccessTokenRefreshed: ((token: string) => void) | null;
  if (typeof auth === "string") {
    currentAccessToken = auth;
    refreshToken = null;
    onAccessTokenRefreshed = null;
  } else {
    currentAccessToken = auth.accessToken;
    refreshToken = auth.refreshToken;
    onAccessTokenRefreshed = auth.onAccessTokenRefreshed;
  }

  // Coalesce in-flight refreshes so a concurrent burst doesn't trade the
  // refresh_token in twice.
  let pendingRefresh: Promise<string> | null = null;
  async function refreshOnce(): Promise<string | null> {
    if (!refreshToken) {
      log.warn("refresh skipped — no refresh token (legacy connection)");
      return null;
    }
    pendingRefresh ??= (async () => {
      try {
        const fresh = await refreshDropboxAccessToken(
          appKey,
          refreshToken!,
          fetchImpl,
        );
        currentAccessToken = fresh;
        onAccessTokenRefreshed?.(fresh);
        return fresh;
      } finally {
        pendingRefresh = null;
      }
    })();
    try {
      return await pendingRefresh;
    } catch (err) {
      log.error("refresh failed", err);
      return null;
    }
  }

  return async function authedFetch(
    url: string,
    build: (token: string) => RequestInit,
    labelOverride?: string,
  ): Promise<Response> {
    // Per-request diagnostics with a 401 silent-refresh retry interleaved
    // between the first attempt and the closing status line.
    const rlog = createRequestLog(log, url, labelOverride);
    let res = await rlog.attempt(() =>
      fetchImpl(url, build(currentAccessToken)),
    );
    if (res.status === 401) {
      log.info("401 — attempting silent refresh");
      const fresh = await refreshOnce();
      if (fresh) {
        res = await rlog.attempt(
          () => fetchImpl(url, build(fresh)),
          " (post-refresh)",
        );
      }
    }
    if (res.status === 401) {
      const body = await readErrorBody(res);
      throw new AuthError(`Dropbox auth failed: 401 ${body}`);
    }
    return rlog.logStatus(res);
  };
}

// ---- OAuth (PKCE) ---------------------------------------------------

function dropboxOAuth(appKey: string, logger?: Logger): OAuthConfig {
  return {
    authBase: AUTH_BASE,
    tokenEndpoint: TOKEN_ENDPOINT,
    clientId: appKey,
    state: "dropbox",
    verifierKey: PKCE_VERIFIER_KEY,
    providerName: "Dropbox",
    extraAuthParams: { token_access_type: "offline" },
    logger,
  };
}

export type DropboxAuthResult = TokenResult;

/** Redirect to Dropbox's consent screen to begin the connect flow. */
export function startDropboxAuth(
  appKey: string,
  logger?: Logger,
): Promise<void> {
  return startAuth(dropboxOAuth(appKey, logger));
}

/**
 * True when a Dropbox OAuth flow is mid-flight — i.e. `startDropboxAuth` stashed
 * a PKCE verifier in `sessionStorage` and the redirect back from Dropbox has not
 * yet been consumed by `completeDropboxAuth`.
 */
export function hasPendingDropboxAuth(): boolean {
  return sessionStorage.getItem(PKCE_VERIFIER_KEY) !== null;
}

/** Complete the connect flow: trade the redirect's `?code=` for tokens. */
export function completeDropboxAuth(
  appKey: string,
  code: string,
  fetchImpl: FetchImpl = fetch,
  logger?: Logger,
): Promise<DropboxAuthResult> {
  return completeAuth(dropboxOAuth(appKey, logger), code, fetchImpl);
}

/** Trade a refresh token for a fresh access token. */
export function refreshDropboxAccessToken(
  appKey: string,
  refreshToken: string,
  fetchImpl: FetchImpl = fetch,
  logger?: Logger,
): Promise<string> {
  return refreshAccessToken(
    dropboxOAuth(appKey, logger),
    refreshToken,
    fetchImpl,
  );
}

/**
 * Delete a folder (and everything inside it) from Dropbox. A 409
 * (path/not_found) is treated as "already gone".
 */
export async function deleteDropboxPath(
  accessToken: string,
  path: string,
  fetchImpl: FetchImpl = fetch,
): Promise<void> {
  const res = await fetchImpl(DELETE_ENDPOINT, {
    method: "POST",
    headers: {
      ...bearerAuthHeader(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });
  if (res.status === 409) return;
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(`Dropbox delete failed: ${res.status} ${body}`);
  }
}
