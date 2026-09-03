// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Politeness for a *bulk* transfer — the sweep that reads or writes many files
// at once, as opposed to the single small request per save that
// `save-retry.ts` governs.
//
// The two shapes fail differently. A document save is one request, so the save
// path can be blunt about it. A sweep over hundreds of files (media,
// attachments, a backup set) fans out, and the naive `Promise.all` that drives
// one goes wrong twice over:
//
//   - **The provider throttles.** Dropbox answers `429 Too Many Requests` with
//     a `Retry-After` that nothing in a byte transport reads — the request
//     simply fails and the file goes missing.
//   - **The browser gives up.** Beyond its per-host connection budget a fetch
//     is rejected outright with a bare `TypeError` whose wording is
//     engine-specific: WebKit says `Load failed`, Chromium `Failed to fetch`,
//     Firefox `NetworkError when attempting to fetch resource`. Nothing is
//     wrong with the file — the request never left.
//
// So this module supplies the two things that make a sweep survive a real
// network: {@link mapLimit}, which keeps only a handful of transfers in flight
// at a time (the throttling is largely *self*-inflicted, so this is the actual
// fix), and {@link withTransientRetries}, which honours a `Retry-After` and
// backs off through a transient failure instead of reporting the file as
// unreadable.

import { RateLimitError } from "./adapter.ts";
import { noopLogger, type Logger } from "./logger.ts";
import { backoffDelayMs } from "./save-retry.ts";

/**
 * How many transfers one sweep keeps in flight at once. Low on purpose: cloud
 * providers throttle per app *and* per user, and a browser only opens a
 * handful of connections per host anyway — queueing beyond that buys no
 * throughput and is what turns a large document into a 429 storm.
 */
export const DEFAULT_TRANSFER_CONCURRENCY = 4;

/** Attempts (the first try plus its retries) any one transfer gets. */
export const DEFAULT_TRANSFER_ATTEMPTS = 5;

/**
 * Ceiling on a single wait, so a hostile or mistaken `Retry-After` can't wedge
 * a sweep for minutes.
 */
const DEFAULT_MAX_WAIT_MS = 30_000;

/**
 * The engine-specific wording a browser uses when a `fetch` never completed.
 * Matched (rather than trusting `TypeError` alone) so a genuine programming
 * `TypeError` isn't retried five times before surfacing.
 */
const NETWORK_FAILURE =
  /load failed|failed to fetch|networkerror|network request failed|connection|aborted|timed out/i;

/**
 * An HTTP status the provider is expected to recover from on its own — a 5xx.
 * Distinct from a plain `Error` so {@link withTransientRetries} can tell "the
 * service hiccuped" from "this path is wrong".
 */
export class TransientHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "TransientHttpError";
    this.status = status;
  }
}

/**
 * Whether a failure is worth trying again: a provider throttle, a 5xx, or the
 * browser refusing to make the request at all. Anything else — a 404, a bad
 * path, a bug — is reported as-is rather than retried.
 *
 * Note the deliberate difference from `isRetryableSaveError`: there a
 * `RateLimitError` is *not* retried, because the save path answers a throttle
 * with its own cooldown. A sweep has no such scheduler, so it waits and
 * carries on.
 */
export function isTransientTransferError(err: unknown): boolean {
  if (err instanceof RateLimitError) return true;
  if (err instanceof TransientHttpError) return true;
  return err instanceof TypeError && NETWORK_FAILURE.test(err.message);
}

export type TransferRetryOptions = {
  /** Where the "retrying in …" lines go. Silent by default. */
  log?: Logger;
  /** Attempts including the first. Defaults to {@link DEFAULT_TRANSFER_ATTEMPTS}. */
  attempts?: number;
  /** Ceiling on one wait, however long the provider asked for. */
  maxWaitMs?: number;
  /** Injectable so tests don't spend real seconds asleep. */
  wait?: (ms: number) => Promise<void>;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `op`, retrying it through a throttle or a transient network failure. A
 * `RateLimitError` waits exactly as long as the provider asked (clamped);
 * everything else backs off exponentially. Gives up after `attempts` and
 * rethrows the last failure, so the caller's existing "leave it unread" /
 * "keep it inline" handling still applies — this only stops a *recoverable*
 * blip from being treated as a lost file.
 *
 * `label` names the transfer in the log line.
 */
export async function withTransientRetries<T>(
  label: string,
  op: () => Promise<T>,
  options: TransferRetryOptions = {},
): Promise<T> {
  const {
    log = noopLogger,
    attempts = DEFAULT_TRANSFER_ATTEMPTS,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    wait = sleep,
  } = options;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await op();
    } catch (err) {
      if (attempt + 1 >= attempts || !isTransientTransferError(err)) throw err;
      const asked =
        err instanceof RateLimitError
          ? err.retryAfterMs
          : backoffDelayMs(attempt);
      const delay = Math.min(Math.max(0, asked), maxWaitMs);
      log.warn(
        `${label}: ${errMsg(err)} — retrying in ${Math.round(delay)}ms ` +
          `(attempt ${attempt + 2}/${attempts})`,
      );
      await wait(delay);
    }
  }
}

/**
 * `items.map(fn)` with at most `limit` calls in flight, results in input
 * order. `fn` is expected to handle its own failures — a rejection propagates
 * and the remaining workers are left running, so callers pass an `fn` that
 * never throws.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const i = next;
        next += 1;
        if (i >= items.length) return;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
