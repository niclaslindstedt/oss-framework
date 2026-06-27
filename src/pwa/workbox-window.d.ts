// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Minimal ambient declaration for the slice of `workbox-window` the PWA update
// hook touches. `workbox-window` is an optional peer dependency the consuming
// app supplies (it owns the service-worker build), so the framework declares
// only what it uses rather than taking a hard dependency on the package's
// types. The real module is loaded lazily (`import("workbox-window")`) and only
// in a production browser with a service worker; tsup keeps the specifier
// external, and the test/demo configs alias it to an empty stub so Vite's
// import analysis can still resolve `src/pwa/usePwaUpdate.ts`.

declare module "workbox-window" {
  export interface WorkboxLifecycleEvent {
    isUpdate?: boolean;
  }

  export class Workbox {
    constructor(
      scriptURL: string,
      options?: {
        scope?: string;
        type?: "classic" | "module";
        updateViaCache?: ServiceWorkerUpdateViaCache;
      },
    );
    addEventListener(
      type: "waiting" | "controlling" | "activated" | "installed",
      listener: (event: WorkboxLifecycleEvent) => void,
    ): void;
    register(): Promise<ServiceWorkerRegistration | undefined>;
    messageSkipWaiting(): void;
  }
}
