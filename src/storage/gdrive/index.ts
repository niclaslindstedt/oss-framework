// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Google Drive backend. Talks to the Drive v3 REST API directly (no SDK).
// Files live inside an app folder at the root of the user's My Drive, so they
// stay visible and editable from drive.google.com.
//
// `createGdriveFileStore` returns the byte-level `FileStore` — the seam an app
// with a custom on-disk layout binds its own adapter over.
// `createGdriveAdapter` is the convenience path: it wraps that store in the
// framework's single-file binding so a whole document lands as one file.
//
// The GIS OAuth flow that hands this adapter its access token lives in
// `./gis-oauth.ts`.

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

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

const SAVE_DEBOUNCE_MS = 1000;

// Floor for the cooldown after Drive rate-limits a request, used when the
// response carries no usable `Retry-After`. Drive usually omits the header and
// just asks clients to back off exponentially.
const RATE_LIMIT_FALLBACK_MS = 5000;

// Unlike Dropbox's clean 429, Google Drive signals a rate limit mostly as HTTP
// 403 with a structured `reason` in the JSON body. A bare 429 counts too. A 403
// quota-exhaustion (`dailyLimitExceeded`) is deliberately NOT treated as a
// transient throttle: that's a hard cap, not a "retry shortly" signal.
function isDriveRateLimit(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status !== 403) return false;
  return (
    body.includes("userRateLimitExceeded") || body.includes("rateLimitExceeded")
  );
}

function gdriveError(
  op: string,
  status: number,
  body: string,
  headers?: Headers,
): Error {
  // Map a rate limit to the typed signal so a caller can park and resume after
  // a cooldown instead of going red — mirrors the Dropbox adapter's 429.
  if (isDriveRateLimit(status, body)) {
    return new RateLimitError(
      parseRetryAfterMs(headers, RATE_LIMIT_FALLBACK_MS),
    );
  }
  const message = `Google Drive ${op} failed: ${status} ${body}`;
  return status === 401 ? new AuthError(message) : new Error(message);
}

type LoggedFetch = (
  url: string,
  init: RequestInit,
  // Optional human label for the sync log. Callers pass the relative path /
  // operation so a failure names the file — never the access token or contents.
  label?: string,
) => Promise<Response>;

function createLoggedFetch(fetchImpl: FetchImpl, log: Logger): LoggedFetch {
  return async function loggedFetch(
    url: string,
    init: RequestInit,
    labelOverride?: string,
  ): Promise<Response> {
    const rlog = createRequestLog(log, url, labelOverride);
    const res = await rlog.attempt(() => fetchImpl(url, init));
    return rlog.logStatus(res);
  };
}

/** A URL that opens Drive's web UI (a folder, or My Drive when the id is unknown). */
export function gdriveWebUrl(folderId: string | null): string {
  return folderId
    ? `https://drive.google.com/drive/folders/${folderId}`
    : "https://drive.google.com/drive/my-drive";
}

type DriveFile = {
  id: string;
  name?: string;
  mimeType?: string;
  version?: string;
};
type DriveListResponse = { files?: DriveFile[] };

export type GdriveFileStoreOptions = {
  /** App folder name at the My Drive root. All managed files live inside it. */
  appFolderName: string;
  /** Optional subfolder of the app folder to scope this store to. */
  subfolder?: string;
  fetchImpl?: FetchImpl;
  logger?: Logger;
};

function splitPath(relDir: string): string[] {
  return relDir.split("/").filter((s) => s.length > 0);
}

function randomBoundary(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/** Build the byte-level `FileStore` for a Google Drive connection. */
export function createGdriveFileStore(
  token: string,
  options: GdriveFileStoreOptions,
): FileStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const log = options.logger ?? noopLogger;
  const appFolderName = options.appFolderName;
  const subfolder = options.subfolder ?? "";
  const loggedFetch = createLoggedFetch(fetchImpl, log);
  // Cache folder ids by their relative directory path ("" = the store root).
  // Drive ids are stable, so this only ever grows within a store's lifetime.
  const dirIdCache = new Map<string, string>();

  function authHeader(): Record<string, string> {
    return bearerAuthHeader(token);
  }

  async function searchOne(
    query: string,
    label: string,
  ): Promise<string | null> {
    const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(
      query,
    )}&spaces=drive&fields=files(id)`;
    const res = await loggedFetch(url, { headers: authHeader() }, label);
    if (!res.ok) {
      const body = await readErrorBody(res);
      throw gdriveError("search", res.status, body, res.headers);
    }
    const json = (await res.json()) as DriveListResponse;
    return json.files?.[0]?.id ?? null;
  }

  async function findChildFolder(
    name: string,
    parentId: string,
  ): Promise<string | null> {
    return searchOne(
      `name='${name}' and mimeType='${FOLDER_MIME_TYPE}'` +
        ` and '${parentId}' in parents and trashed=false`,
      `find folder ${name}`,
    );
  }

  async function findChildFolderAtRoot(name: string): Promise<string | null> {
    return searchOne(
      `name='${name}' and mimeType='${FOLDER_MIME_TYPE}'` +
        ` and 'root' in parents and trashed=false`,
      `find folder ${name}`,
    );
  }

  async function createFolder(
    name: string,
    parentId: string | null,
  ): Promise<string> {
    const body: Record<string, unknown> = { name, mimeType: FOLDER_MIME_TYPE };
    if (parentId) body.parents = [parentId];
    const res = await loggedFetch(
      `${DRIVE_FILES_API}?fields=id`,
      {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      `create folder ${name}`,
    );
    if (!res.ok) {
      const detail = await readErrorBody(res);
      throw gdriveError("folder create", res.status, detail, res.headers);
    }
    return ((await res.json()) as DriveFile).id;
  }

  // Resolve the id of the directory at `relDir`, creating each missing segment
  // when `create` is set. Returns null when a segment is absent and `create` is
  // false.
  async function resolveDirId(
    relDir: string,
    create: boolean,
  ): Promise<string | null> {
    if (dirIdCache.has(relDir)) return dirIdCache.get(relDir)!;

    let appId = await findChildFolderAtRoot(appFolderName);
    if (!appId) {
      if (!create) return null;
      appId = await createFolder(appFolderName, null);
    }

    let parentId = appId;
    for (const segment of [...splitPath(subfolder), ...splitPath(relDir)]) {
      let id = await findChildFolder(segment, parentId);
      if (!id) {
        if (!create) return null;
        id = await createFolder(segment, parentId);
      }
      parentId = id;
    }
    dirIdCache.set(relDir, parentId);
    return parentId;
  }

  async function listDir(
    dirId: string,
    prefix: string,
    out: FileEntry[],
  ): Promise<void> {
    const query = `'${dirId}' in parents and trashed=false`;
    const url =
      `${DRIVE_FILES_API}?q=${encodeURIComponent(query)}&spaces=drive` +
      `&fields=files(id,name,mimeType,version)`;
    const res = await loggedFetch(
      url,
      { headers: authHeader() },
      `list ${prefix || "(root)"}`,
    );
    if (!res.ok) {
      const body = await readErrorBody(res);
      throw gdriveError("list", res.status, body, res.headers);
    }
    const files = ((await res.json()) as DriveListResponse).files ?? [];
    for (const file of files) {
      const path = prefix ? `${prefix}/${file.name}` : (file.name ?? "");
      if (file.mimeType === FOLDER_MIME_TYPE) {
        await listDir(file.id, path, out);
      } else {
        out.push({ path, rev: file.version });
      }
    }
  }

  function dirAndName(path: string): { dir: string; name: string } {
    const idx = path.lastIndexOf("/");
    return idx === -1
      ? { dir: "", name: path }
      : { dir: path.slice(0, idx), name: path.slice(idx + 1) };
  }

  async function findFileId(path: string): Promise<string | null> {
    const { dir, name } = dirAndName(path);
    const dirId = await resolveDirId(dir, false);
    if (!dirId) return null;
    return searchOne(
      `name='${name}' and '${dirId}' in parents and trashed=false`,
      `find ${path}`,
    );
  }

  async function createFile(
    parentId: string,
    name: string,
    text: string,
    label: string = name,
  ): Promise<void> {
    const meta = JSON.stringify({ name, parents: [parentId] });
    const boundary = `oss-${randomBoundary()}`;
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain\r\n\r\n${text}\r\n` +
      `--${boundary}--`;
    const res = await loggedFetch(
      `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id`,
      {
        method: "POST",
        headers: {
          ...authHeader(),
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
      `create ${label}`,
    );
    if (!res.ok) {
      const errBody = await readErrorBody(res);
      throw gdriveError("create", res.status, errBody, res.headers);
    }
  }

  return {
    async list(): Promise<FileEntry[]> {
      const rootId = await resolveDirId("", false);
      if (!rootId) return [];
      const out: FileEntry[] = [];
      await listDir(rootId, "", out);
      return out;
    },

    async read(path: string): Promise<string | null> {
      const fileId = await findFileId(path);
      if (!fileId) return null;
      const res = await loggedFetch(
        `${DRIVE_FILES_API}/${fileId}?alt=media`,
        { headers: authHeader() },
        `download ${path}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) {
        const body = await readErrorBody(res);
        throw gdriveError("download", res.status, body, res.headers);
      }
      return res.text();
    },

    async write(path: string, text: string): Promise<void> {
      const { dir, name } = dirAndName(path);
      const dirId = await resolveDirId(dir, true);
      if (!dirId) throw new Error(`Google Drive: cannot resolve ${dir}`);
      const existing = await searchOne(
        `name='${name}' and '${dirId}' in parents and trashed=false`,
        `find ${path}`,
      );
      if (existing) {
        const res = await loggedFetch(
          `${DRIVE_UPLOAD_API}/${existing}?uploadType=media`,
          {
            method: "PATCH",
            headers: { ...authHeader(), "Content-Type": "text/plain" },
            body: text,
          },
          `update ${path}`,
        );
        if (!res.ok) {
          const body = await readErrorBody(res);
          throw gdriveError("update", res.status, body, res.headers);
        }
        return;
      }
      await createFile(dirId, name, text, path);
    },

    async remove(path: string): Promise<void> {
      const fileId = await findFileId(path);
      if (!fileId) return;
      const res = await loggedFetch(
        `${DRIVE_FILES_API}/${fileId}`,
        { method: "DELETE", headers: authHeader() },
        `delete ${path}`,
      );
      if (!res.ok && res.status !== 404) {
        const body = await readErrorBody(res);
        throw gdriveError("delete", res.status, body, res.headers);
      }
    },
  };
}

export type CreateGdriveAdapterOptions = GdriveFileStoreOptions & {
  /** Relative path the document is stored under. Defaults to `document.json`. */
  fileName?: string;
};

/** Whole-document Google Drive adapter: the document lives as one file in the app folder. */
export function createGdriveAdapter(
  token: string,
  options: CreateGdriveAdapterOptions,
): StorageAdapter {
  const store = createGdriveFileStore(token, options);
  return createFileStoreAdapter(store, {
    id: "gdrive",
    label: "Google Drive",
    fileName: options.fileName,
    saveDebounceMs: SAVE_DEBOUNCE_MS,
    logger: options.logger,
  });
}

export {
  GDRIVE_SCOPE,
  preloadGdriveAuth,
  startGdriveAuth,
} from "./gis-oauth.ts";
