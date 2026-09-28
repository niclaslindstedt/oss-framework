// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import { isNativeShell } from "./nativeShell.ts";

// Detects the one context where hiding chrome / offering inward edge gestures
// is safe: the app runs with no browser around it — launched as an installed
// PWA (standalone display mode), or shipped inside a native shell's WebView —
// on a touch phone / tablet (Android or iOS). The replacement gesture — an
// inward swipe from the screen edge — collides with the browser's own
// back-swipe in a normal tab, but a standalone window or a shell's WebView has
// no such chrome, so the edge is free.
// Everywhere else (desktop, a non-installed mobile tab) the app should keep its
// visible affordance and hide the swipe-only setting. Pure platform plumbing —
// no app-specific coupling.

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayModeStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  // iOS Safari predates the display-mode media query for home-screen apps
  // and reports the installed state on `navigator` instead.
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayModeStandalone || iosStandalone;
}

function isMobileOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return true;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS reports a desktop Safari user agent; a Mac-like UA with a
  // multi-touch screen is really an iPad.
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/** True when running with no browser chrome on Android or iOS: as an
 *  installed PWA, or inside a native shell (see `isNativeShell`). */
export function isStandaloneMobile(): boolean {
  return (isStandalone() || isNativeShell()) && isMobileOS();
}

/**
 * The standalone-mobile flag as a hook. It can't change within a session
 * (you can't move from a tab to an installed window without a reload), so
 * it's read once into state and never updated.
 */
export function useStandaloneMobile(): boolean {
  return useState(isStandaloneMobile)[0];
}
