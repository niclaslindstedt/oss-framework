// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Stand-in for the `workbox-window` optional peer dependency the PWA update
// hook loads lazily. The package is supplied by the consuming app (it owns the
// service-worker build) and is not installed here, so the test and demo configs
// alias the specifier to this stub. The hook only reaches the real
// `import("workbox-window")` in a production browser with a service worker, so
// this no-op `Workbox` never actually runs under test — it exists so Vite's
// import analysis can resolve `src/pwa/usePwaUpdate.ts`.
export class Workbox {
  constructor(_scriptURL: string, _options?: unknown) {}
  addEventListener(_type: string, _listener: (event: unknown) => void): void {}
  async register(): Promise<undefined> {
    return undefined;
  }
  messageSkipWaiting(): void {}
}
