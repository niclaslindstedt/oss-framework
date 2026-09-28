<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Running inside a native shell

An app built on the framework can ship the same web build three ways: as a
website in a browser tab, as an installed PWA, and inside a **native shell** — a
thin native app (Expo / React Native, `react-native-webview`) that serves the
built site from a loopback origin and shows it full screen. This page is the
contract between the page and such a shell: how the page knows it is in one,
and the messages the two exchange.

The page learns everything from what the shell itself puts on `window`. Nothing
is guessed from a user agent, and nothing is compiled in: the same bundle runs
in a tab, an installed window and a shell.

## Recognizing the shell

`isNativeShell()` (from `@niclaslindstedt/oss-framework/pwa`) is `true` when
either of these is present:

| Signal                                          | Who puts it there                                                                                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `window.ReactNativeWebView.postMessage`         | `react-native-webview`, before the page's scripts run, in any `<WebView>` given an `onMessage` prop. A shell that listens to its page at all has it already.                        |
| `window.__ossShell = { version, capabilities }` | The shell, in `injectedJavaScriptBeforeContentLoaded`. Declares the shell (for a wrapper that is not `react-native-webview`) and lists the message contracts it implements (below). |

A native shell on a phone has no browser chrome — no address bar, no browser
back-swipe owning the screen edge — so `isStandaloneMobile()` /
`useStandaloneMobile()` count it as standalone, exactly like an installed PWA.

### Opting an app in: the edge-swipe setting

An app that offers "swipe from the edge to open the menu" (and with it, hiding
the floating menu button) gates that setting on `useStandaloneMobile()`. With
this release the gate opens inside the shell too, so the app itself changes
nothing beyond the framework version. What each piece needs:

- **The web app** gates the setting (and the `useEdgeSwipeOpen` /
  `showButton={false}` wiring it drives) on `useStandaloneMobile()` from the
  framework — not on a local copy of the old detection, and not on a
  `__NATIVE_BUILD__`-style compile-time flag.
- **The shell** passes `onMessage` to its `<WebView>` (every fleet shell does,
  for its theme reporter). Nothing else. A wrapper that is not
  `react-native-webview` injects `window.__ossShell = { version: 1,
capabilities: [] }` instead.

## The descriptor

A shell that implements any of the message contracts below advertises it, before
the page loads, in `window.__ossShell`:

```js
// injectedJavaScriptBeforeContentLoaded
window.__ossShell = window.__ossShell || { version: 1, capabilities: [] };
```

`version` is the descriptor's version (`1`). `capabilities` is a list of
contract names — today `save-file`, below. `nativeShellCan("save-file")` reads
it. The page uses a contract only when its name is listed **and**
the `ReactNativeWebView` bridge is present, so a shell that has not implemented
one keeps the web behavior rather than posting into the void.

## Contract `save-file`: exports through the share sheet

A browser export is a download: an anchor clicked at a `blob:` URL
(`downloadBlob`). Inside a WebView that click goes nowhere — the WebView offers
the `blob:` URL to the shell as a navigation, and the shell has nothing to open
it with. `saveFile` (from `@niclaslindstedt/oss-framework/files`) is the export
call that works in both places:

```ts
import { saveFile } from "@niclaslindstedt/oss-framework/files";

await saveFile({ blob, filename: "drawing.png" }); // bytes
await saveFile({ text: csv, filename: "export.csv", mimeType: MIME_CSV }); // text, as UTF-8
```

Without the capability it downloads, exactly as `downloadBlob` does, and
resolves `"downloaded"`. In a shell that advertises `save-file` it sends the
bytes to the shell, which writes them to a temporary file and opens the iOS /
Android share sheet; it resolves `"shared"` when the shell reports back, and
rejects with the shell's error when it reports a failure. There is no timeout:
the sheet stays open as long as the user leaves it open.

### Page → shell

One JSON string through `window.ReactNativeWebView.postMessage`:

```json
{
  "type": "oss-framework/save-file",
  "version": 1,
  "id": "sfm1k2x3-1",
  "filename": "export.csv",
  "mimeType": "text/csv",
  "base64": "YSxiDQox..."
}
```

| Field      | Meaning                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `type`     | Always `"oss-framework/save-file"`. Anything else is not this contract.                                             |
| `version`  | `1`. A shell answers a version it does not know with `ok: false`.                                                   |
| `id`       | Opaque. Echo it back unchanged; the page settles the matching call by it.                                           |
| `filename` | The name to offer, extension included. The page has already replaced `/` and `\` and dropped control characters.    |
| `mimeType` | Without parameters (`text/csv`, never `text/csv;charset=utf-8`); `application/octet-stream` when the page had none. |
| `base64`   | The file's bytes, standard base64 with padding. Text was encoded as UTF-8 first.                                    |

The payload crosses the bridge as one string, so it costs a third more than the
file. That is fine for documents, images and archives of a few tens of
megabytes.

### Shell → page

Exactly one answer per request, delivered by injecting a script:

```js
window.dispatchEvent(
  new CustomEvent("oss-framework/save-file-result", {
    detail: { id: "sfm1k2x3-1", ok: true },
  }),
);
```

`detail` is `{ id, ok: true }` once the share sheet has been shown and closed
(whether or not the user picked a target — the platform does not say), or
`{ id, ok: false, error: "…" }` when the file could not be written or sharing is
unavailable. The page shows `error` to nobody by default; the app decides.

### What the shell must do

1. **Advertise it** in `injectedJavaScriptBeforeContentLoaded`, and only once
   the rest of this list is in place:
   `window.__ossShell = { version: 1, capabilities: ["save-file"] }` (merge into
   an existing descriptor if the shell sets one for another contract).
2. **Route the message** in `onMessage`: parse, and hand anything with
   `type === "oss-framework/save-file"` to the handler below.
3. **Never trust the name.** Take its last path component again, and fall back
   to `file` when that leaves nothing.
4. **Write, share, answer** — the reference below — and keep no more than the
   latest export on disk.
5. **Stop sending `blob:` and `data:` URLs to `Linking.openURL`** in
   `onShouldStartLoadWithRequest`: return `false` for them. With `saveFile` in
   place nothing should navigate there, and the system browser cannot open a
   URL that only exists inside the WebView anyway.

### Reference: the native half (`expo-file-system` + `expo-sharing`)

Both packages ship with the Expo SDK (`npx expo install expo-file-system
expo-sharing`); neither needs a config plugin.

```ts
// native/src/saveFileBridge.ts
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export const SAVE_FILE_TYPE = "oss-framework/save-file";
const RESULT_EVENT = "oss-framework/save-file-result";

/** Injected before the page loads (beside any other provider scripts). */
export const SAVE_FILE_DESCRIPTOR = `(function () {
  var shell = window.__ossShell || { version: 1, capabilities: [] };
  if (shell.capabilities.indexOf("save-file") < 0) shell.capabilities.push("save-file");
  window.__ossShell = shell;
})(); true;`;

export type SaveFileRequest = {
  type: string;
  version: number;
  id: string;
  filename: string;
  mimeType: string;
  base64: string;
};

export function isSaveFileRequest(value: unknown): value is SaveFileRequest {
  const m = value as Partial<SaveFileRequest> | null;
  return (
    typeof m === "object" &&
    m !== null &&
    m.type === SAVE_FILE_TYPE &&
    typeof m.id === "string" &&
    typeof m.filename === "string" &&
    typeof m.mimeType === "string" &&
    typeof m.base64 === "string"
  );
}

/** iOS picks share targets by UTI, not MIME type. Extend as exports need. */
const UTI: Record<string, string> = {
  "application/json": "public.json",
  "application/pdf": "com.adobe.pdf",
  "application/zip": "public.zip-archive",
  "image/jpeg": "public.jpeg",
  "image/png": "public.png",
  "image/svg+xml": "public.svg-image",
  "text/calendar": "public.calendar-event",
  "text/csv": "public.comma-separated-values-text",
  "text/markdown": "net.daringfireball.markdown",
  "text/plain": "public.plain-text",
  "text/vcard": "public.vcard",
};

function bareName(name: string): string {
  const last = name.split(/[\\/]/).pop()?.trim() ?? "";
  return last === "" || last === "." || last === ".." ? "file" : last;
}

/** The script that settles the page's promise. */
export function saveFileResultScript(
  id: string,
  ok: boolean,
  error?: string,
): string {
  const detail = ok ? { id, ok } : { id, ok, error };
  return `window.dispatchEvent(new CustomEvent(${JSON.stringify(
    RESULT_EVENT,
  )}, { detail: ${JSON.stringify(detail)} })); true;`;
}

/** Write the bytes to the cache, open the share sheet, answer. */
export async function answerSaveFile(
  request: SaveFileRequest,
  inject: (script: string) => void,
): Promise<void> {
  if (request.version !== 1) {
    inject(saveFileResultScript(request.id, false, "Unsupported version."));
    return;
  }
  // One directory per request, so the file keeps exactly the name the user
  // sees in the sheet. The previous export's directory goes first: it is not
  // deleted when its sheet closes, because an Android target may still be
  // reading it after the chooser has returned.
  const root = `${FileSystem.cacheDirectory}exports/`;
  const dir = `${root}${request.id.replace(/[^\w-]/g, "_")}/`;
  const uri = dir + bareName(request.filename);
  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Sharing is not available on this device.");
    }
    await FileSystem.deleteAsync(root, { idempotent: true });
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    await FileSystem.writeAsStringAsync(uri, request.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await Sharing.shareAsync(uri, {
      mimeType: request.mimeType,
      UTI: UTI[request.mimeType],
      dialogTitle: bareName(request.filename),
    });
    inject(saveFileResultScript(request.id, true));
  } catch (error) {
    inject(
      saveFileResultScript(
        request.id,
        false,
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
}
```

Wiring it into the `<WebView>`:

```tsx
<WebView
  ref={webView}
  injectedJavaScriptBeforeContentLoaded={`${OTHER_SCRIPTS}\n${SAVE_FILE_DESCRIPTOR}`}
  onShouldStartLoadWithRequest={(request) => {
    if (/^(blob|data):/i.test(request.url)) return false;
    // … the shell's existing rules
  }}
  onMessage={(event) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.nativeEvent.data);
    } catch {
      parsed = null;
    }
    if (isSaveFileRequest(parsed)) {
      void answerSaveFile(parsed, (script) =>
        webView.current?.injectJavaScript(script),
      );
      return;
    }
    // … the shell's other messages
  }}
/>
```

The payload is the user's document: don't log `base64`, keep no more than the
latest export (in the cache directory, which the next export clears and the OS
may purge), and hand it to nothing but the share sheet.
