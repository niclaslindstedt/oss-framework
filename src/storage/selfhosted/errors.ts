// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Typed errors for the self-hosted backend, beyond the storage contract's
// ConflictError / AuthError / RateLimitError (which it reuses).

/** Ciphertext did not authenticate: wrong key, or data moved or tampered with. */
export class DecryptError extends Error {
  constructor(message = "decryption failed") {
    super(message);
    this.name = "DecryptError";
  }
}

/** The signed-in account's role in the namespace does not allow this. */
export class ForbiddenError extends Error {
  constructor(message = "not allowed") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** The owner's storage quota would be exceeded. */
export class QuotaExceededError extends Error {
  constructor(
    readonly usedBytes: number,
    readonly quotaBytes: number,
  ) {
    super(`storage quota exceeded (${usedBytes} of ${quotaBytes} bytes used)`);
    this.name = "QuotaExceededError";
  }
}

/** The server went back in time for a namespace: a rollback or a restore. */
export class RollbackError extends Error {
  constructor(
    readonly namespaceId: string,
    readonly seen: number,
    readonly served: number,
  ) {
    super(`namespace ${namespaceId} moved back from ${seen} to ${served}`);
    this.name = "RollbackError";
  }
}

/** A thing that does not exist (or that this account may not see). */
export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** The account has no key on this device yet (pair, approve or recover). */
export class KeysMissingError extends Error {
  constructor(message = "this device has no account key yet") {
    super(message);
    this.name = "KeysMissingError";
  }
}

/** Any other API error, with the server's code and status. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** Internal: a conditional write lost the race; `current` is the server's version. */
export class PreconditionError extends Error {
  constructor(readonly current: Record<string, unknown> | null) {
    super("revision mismatch");
    this.name = "PreconditionError";
  }
}

/** The change feed can no longer reach the requested point: resync. */
export class CursorExpiredError extends Error {
  constructor() {
    super("change cursor expired; resync");
    this.name = "CursorExpiredError";
  }
}
