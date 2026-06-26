// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A minimal logger seam. The cloud adapters emit per-request sync diagnostics
// (which endpoint / file ran, how long, how it ended) that are invaluable when
// debugging a flaky link — but *where* those lines go is the app's call. So
// the framework defines only the shape, defaults to a no-op (a library must
// not write to a console it doesn't own), and lets an app inject its own sink
// (an in-app log buffer, the console, a file) wherever an adapter takes a
// `logger` option.

export type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/** A logger that discards everything — the default when an app injects none. */
export const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * A logger that forwards to the matching `console` methods, prefixing each
 * line with `[<scope>]`. A convenience sink for apps that just want the lines
 * in devtools; pass it as the `logger` option on any adapter.
 */
export function consoleLogger(scope: string): Logger {
  const tag = `[${scope}]`;
  return {
    info: (...args) => console.info(tag, ...args),
    warn: (...args) => console.warn(tag, ...args),
    error: (...args) => console.error(tag, ...args),
  };
}
