// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The page's view of a native shell: an app that ships this web build inside a
// native wrapper (an Expo / React Native WebView serving the site from a
// loopback origin) rather than in a browser tab or an installed PWA.
//
// Two facts are read here, and both are things the shell itself puts on
// `window` — nothing is guessed from a user agent:
//
// - **That there is a shell.** `react-native-webview` installs
//   `window.ReactNativeWebView` (its `postMessage` bridge) before the page's
//   own scripts run, in every WebView that listens for messages. A shell of
//   another kind declares itself with the descriptor below instead.
// - **What the shell can do.** The descriptor a shell injects before the page
//   loads, `window.__ossShell = { version: 1, capabilities: [...] }`. A
//   capability is a promise that the shell implements the native half of one
//   of the framework's message contracts (see docs/native-shell.md); the page
//   uses a capability only when the shell advertised it, so a shell that has
//   not caught up keeps the web behavior rather than posting into the void.
//
// Pure platform plumbing, no React — `standalone.ts`, the `files` module's
// `saveFile` and the `qr` module's `scanQrCode` build on it.

/** Where a shell's descriptor lives on `window`. */
export const NATIVE_SHELL_PROPERTY = "__ossShell";

/** A message contract a shell can implement. Spelled out in
 *  docs/native-shell.md. */
export type NativeShellCapability = "save-file" | "scan-qr";

/** What a shell injects as `window.__ossShell` before the page loads. */
export interface NativeShellDescriptor {
  /** The descriptor's own version. `1` today. */
  version: number;
  /** The message contracts the shell implements. */
  capabilities?: readonly string[];
}

type ShellWindow = Window & {
  [NATIVE_SHELL_PROPERTY]?: unknown;
  ReactNativeWebView?: { postMessage?: unknown };
};

function shellWindow(): ShellWindow | null {
  return typeof window === "undefined" ? null : (window as ShellWindow);
}

/** The descriptor the shell injected, or `null` when there is none (or it is
 *  not shaped like one). */
export function nativeShellDescriptor(): NativeShellDescriptor | null {
  const raw = shellWindow()?.[NATIVE_SHELL_PROPERTY];
  if (typeof raw !== "object" || raw === null) return null;
  const { version, capabilities } = raw as Record<string, unknown>;
  if (typeof version !== "number") return null;
  return {
    version,
    capabilities: Array.isArray(capabilities)
      ? capabilities.filter((c): c is string => typeof c === "string")
      : [],
  };
}

/** The `react-native-webview` bridge, when the page runs inside one. */
function reactNativeBridge(): { postMessage: (data: string) => void } | null {
  const bridge = shellWindow()?.ReactNativeWebView;
  if (!bridge || typeof bridge.postMessage !== "function") return null;
  return bridge as { postMessage: (data: string) => void };
}

/** True when the page runs inside a native shell: a `react-native-webview`
 *  host, or any wrapper that injected a `window.__ossShell` descriptor. */
export function isNativeShell(): boolean {
  return reactNativeBridge() !== null || nativeShellDescriptor() !== null;
}

/** True when the shell advertised `capability` and there is a bridge to reach
 *  it over. */
export function nativeShellCan(capability: NativeShellCapability): boolean {
  if (!reactNativeBridge()) return false;
  return nativeShellDescriptor()?.capabilities?.includes(capability) ?? false;
}

/** Post one message to the shell as a JSON string. Returns false when there is
 *  no bridge, or it threw — the caller falls back or reports the failure. */
export function postToNativeShell(message: object): boolean {
  const bridge = reactNativeBridge();
  if (!bridge) return false;
  try {
    bridge.postMessage(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}
