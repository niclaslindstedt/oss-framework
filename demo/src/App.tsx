// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { SidebarDemo } from "./demos/sidebar.tsx";
import { StorageDemo } from "./demos/storage.tsx";
import { ThemeDemo } from "./demos/theme.tsx";

// The framework's preview site. One demo per component lives under
// `src/demos/<component>.tsx` and is rendered in a section here. The theme demo
// showcases the appearance picker / settings modal applied live with
// `useApplyTheme`; the storage demo drives the swappable `StorageAdapter`
// contract. Add further sections below as the public surface grows.
export function App() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-fg-bright">
          OSS Framework — demo
        </h1>
        <p className="mt-1 text-muted">
          Preview site for <code>@niclaslindstedt/oss-framework</code>.
          Component demos appear here as the framework grows.
        </p>
      </header>

      <div className="flex flex-col gap-14">
        <ThemeDemo />
        <SidebarDemo />
        <StorageDemo />
      </div>
    </main>
  );
}
