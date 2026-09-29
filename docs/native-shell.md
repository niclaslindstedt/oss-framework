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
contract names — today `save-file` and `scan-qr`, below. `nativeShellCan("save-file")` reads
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

## Contract `scan-qr`: a QR code read with the phone's camera

A browser tab has no scanner the page can count on, so pairing a device with a
self-hosted storage server there means pasting its code. Inside a phone app's
shell the page can ask the shell to scan instead. `scanQrCode` (from
`@niclaslindstedt/oss-framework/qr`) is the call, and `canScanQrCode()` says
whether it works here — a shell that advertises `scan-qr` — so the app shows a
**Scan** button only where it does. The paste field stays in every build.

```ts
import { canScanQrCode, ScanQrError } from "@niclaslindstedt/oss-framework/qr";
import {
  scanStorageCode,
  StoragePayloadError,
} from "@niclaslindstedt/oss-framework/storage";

if (canScanQrCode()) {
  try {
    // "pair" by default; an invite screen passes { kind: "invite" }.
    const code = await scanStorageCode({
      labels: { hint: t("scanHint"), cancel: t("cancel") },
    });
    if (code !== null) acceptCode(code); // the same path as a paste
  } catch (error) {
    if (error instanceof ScanQrError && error.reason === "denied") {
      // "Camera access is off for this app. Allow it in Settings, or paste
      // the code."
    } else if (error instanceof StoragePayloadError) {
      // "That is not a pairing code." (error.message says which way)
    }
  }
}
```

`scanQrCode()` resolves with the text exactly as read, or `null` when the user
closed the scanner. It rejects with a `ScanQrError` whose `reason` is `denied`
(the camera is not allowed — the page, not the shell, tells the user what to
do, in its own language) or `unavailable` (no scanner here, no camera, or the
shell failed to open it). A second call while the scanner is open returns the
same promise, so a double tap opens one scanner. There is no timeout.

**Validation belongs to the page, not the shell.** The shell reads any QR code
and answers with its text; `scanQrCode` returns it untouched.
`scanStorageCode` (from `/storage`) is the pairing step: it trims the text,
parses it as a storage code — a bare `oss-storage://pair?…` URI, or an app link
carrying one after `#oss=` — and rejects with a `StoragePayloadError` when it
is not one, or not of the kind asked for (`pair` by default). What it returns is
the string a paste gives, so the app hands it to the same code path, and
`client.pair(code, device)` parses it once more on the way in. The code is a
one-time secret: show it nowhere, log it nowhere, keep it nowhere.

### Page → shell

One JSON string through `window.ReactNativeWebView.postMessage`:

```json
{
  "type": "oss-framework/scan-qr",
  "version": 1,
  "id": "sqm1k2x3-1",
  "labels": {
    "hint": "Point the camera at the pairing code",
    "cancel": "Cancel"
  }
}
```

| Field     | Meaning                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`    | Always `"oss-framework/scan-qr"`. Anything else is not this contract.                                                                                                               |
| `version` | `1`. A shell answers a version it does not know with `ok: false, reason: "unavailable"`.                                                                                            |
| `id`      | Opaque, at most 64 characters. Echo it back unchanged; the page settles the matching call by it.                                                                                    |
| `labels`  | Optional. `hint` (the line over the camera) and `cancel` (the button that closes it), already in the page's language. Either may be missing; the shell falls back to its own words. |

### Shell → page

Exactly one answer per request, delivered by injecting a script:

```js
window.dispatchEvent(
  new CustomEvent("oss-framework/scan-qr-result", {
    detail: { id: "sqm1k2x3-1", ok: true, text: "oss-storage://pair?v=1&…" },
  }),
);
```

| `detail`                                          | When                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `{ id, ok: true, text: "…" }`                     | A QR code was read: its text, exactly as decoded.                                                                                     |
| `{ id, ok: true, text: null }`                    | The user closed the scanner (Cancel, Android's back button, the sheet dismissed).                                                     |
| `{ id, ok: false, reason: "denied" }`             | The user declined the camera now, or earlier and the system will not ask again. The shell shows nothing more; the page explains.      |
| `{ id, ok: false, reason: "unavailable", error }` | No camera, the camera failed to start, a scan was already open, or an unknown `version`. `error` is for a log line, not for the user. |

### What the shell must do

1. **Advertise it** in `injectedJavaScriptBeforeContentLoaded`, and only once
   the rest of this list is in place (merge into an existing descriptor):
   `window.__ossShell = { version: 1, capabilities: ["scan-qr"] }`.
2. **Route the message** in `onMessage`: parse, and hand anything with
   `type === "oss-framework/scan-qr"` to the scanner — only from the page's own
   origin (`event.nativeEvent.url`), so nothing else loaded in the WebView can
   open the camera.
3. **Open the camera only on request.** Nothing camera-related is mounted or
   asked for at launch: the permission prompt appears the first time the user
   taps Scan, and a refusal is answered as `denied`, not retried.
4. **Scan one code.** QR only (`barcodeTypes: ["qr"]`); the first code read
   closes the scanner. Guard the handler — the camera reports the same code
   many times a second.
5. **Keep no frame.** Take no picture, record nothing, write nothing to disk;
   only the decoded text leaves the scanner. Unmount the camera before
   answering.
6. **Close and answer the page** — exactly once, whichever way it ends.
7. **Never log the text.** A pairing code is a one-time secret; it goes into
   the answer script and nowhere else.

### Reference: the native half (`expo-camera`)

Storage Remote's approach, shaped as the fleet's other bridges are, against
the Expo SDK 57 packages (`npx expo install expo-camera`, `~57.0.5`;
`react-native-safe-area-context` is already in every shell). Two files, split as
the other bridges are: the strings and narrowing, which import nothing from
Expo so a root test can pin them against the framework's `SCAN_QR_MESSAGE` and
`SCAN_QR_RESULT_EVENT`; and the camera.

```ts
// native/src/scanQrBridge.ts — strings and narrowing only; imports nothing
// from Expo, so a root test can pin it against the framework.
export const SCAN_QR_TYPE = "oss-framework/scan-qr";
const RESULT_EVENT = "oss-framework/scan-qr-result";

/** Injected before the page loads (beside any other provider scripts). */
export const SCAN_QR_DESCRIPTOR = `(function () {
  var shell = window.__ossShell || { version: 1, capabilities: [] };
  if (shell.capabilities.indexOf("scan-qr") < 0) shell.capabilities.push("scan-qr");
  window.__ossShell = shell;
})(); true;`;

export type ScanQrLabels = { hint?: string; cancel?: string };

export type ScanQrRequest = {
  type: string;
  version: number;
  id: string;
  labels?: ScanQrLabels;
};

export type ScanQrAnswer =
  | { ok: true; text: string | null }
  | { ok: false; reason: "denied" | "unavailable"; error?: string };

export function isScanQrRequest(value: unknown): value is ScanQrRequest {
  const m = value as Partial<ScanQrRequest> | null;
  return (
    typeof m === "object" &&
    m !== null &&
    m.type === SCAN_QR_TYPE &&
    typeof m.version === "number" &&
    typeof m.id === "string" &&
    m.id.length > 0 &&
    m.id.length <= 64
  );
}

/** A label the page sent, or the shell's own. */
export function scanLabel(
  request: ScanQrRequest,
  key: keyof ScanQrLabels,
  fallback: string,
): string {
  const value = request.labels?.[key];
  return typeof value === "string" && value.trim() !== ""
    ? value.slice(0, 200)
    : fallback;
}

/** The script that settles the page's promise. The text is a one-time secret:
 *  it goes into this script and nowhere else — never a log. */
export function scanQrResultScript(id: string, answer: ScanQrAnswer): string {
  const detail = JSON.stringify({ id, ...answer })
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/<\/(script)/gi, "<\\/$1");
  return `window.dispatchEvent(new CustomEvent(${JSON.stringify(
    RESULT_EVENT,
  )}, { detail: ${detail} })); true;`;
}
```

```tsx
// native/src/QrScanner.tsx — the camera, mounted only while the page waits
// on a scan. It asks for the camera then (never at launch), reads the first QR
// code it sees, and closes. No picture is taken and no frame is kept: the
// preview goes to the screen and only the decoded text goes back.
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  scanLabel,
  type ScanQrAnswer,
  type ScanQrRequest,
} from "./scanQrBridge";

export function QrScanner({
  request,
  onAnswer,
}: {
  request: ScanQrRequest;
  onAnswer: (answer: ScanQrAnswer) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [done, setDone] = useState(false);
  const answered = useRef(false);
  const asked = useRef(false);

  const finish = (answer: ScanQrAnswer) => {
    if (answered.current) return;
    answered.current = true;
    setDone(true); // unmounts the camera before the page hears back
    onAnswer(answer);
  };

  // Ask once, now that the user asked to scan. A refusal closes the scanner
  // and the page says what to do (Settings, or paste) in its own language.
  useEffect(() => {
    if (!permission || permission.granted || asked.current) return;
    asked.current = true;
    if (!permission.canAskAgain) {
      finish({ ok: false, reason: "denied" });
      return;
    }
    requestPermission().then(
      (response) => {
        if (!response.granted) finish({ ok: false, reason: "denied" });
      },
      () => finish({ ok: false, reason: "unavailable" }),
    );
  });

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => finish({ ok: true, text: null })}
    >
      <View style={styles.fill}>
        {permission?.granted && !done ? (
          <CameraView
            style={styles.fill}
            facing="back"
            animateShutter={false}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => finish({ ok: true, text: data })}
            onMountError={({ message }) =>
              finish({ ok: false, reason: "unavailable", error: message })
            }
          />
        ) : null}
        <SafeAreaView edges={["bottom"]} style={styles.bar}>
          <Text style={styles.hint}>
            {scanLabel(request, "hint", "Point the camera at the code")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => finish({ ok: true, text: null })}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>
              {scanLabel(request, "cancel", "Cancel")}
            </Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  hint: { color: "#fff", fontSize: 15, marginBottom: 12, textAlign: "center" },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  pressed: { opacity: 0.8 },
  buttonLabel: { color: "#141a26", fontSize: 16, fontWeight: "600" },
});
```

Wiring it into the app (`origin` is the loopback origin the shell serves the
page from):

```tsx
export default function App() {
  const webView = useRef<WebView>(null);
  const [scan, setScan] = useState<ScanQrRequest | null>(null);
  const answerScan = useCallback((id: string, answer: ScanQrAnswer) => {
    webView.current?.injectJavaScript(scanQrResultScript(id, answer));
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      // Only the bundled page may open the camera.
      if (!event.nativeEvent.url.startsWith(origin)) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (isScanQrRequest(parsed)) {
        if (parsed.version !== 1) {
          answerScan(parsed.id, {
            ok: false,
            reason: "unavailable",
            error: "Unsupported version.",
          });
        } else if (scan) {
          answerScan(parsed.id, {
            ok: false,
            reason: "unavailable",
            error: "A scan is already open.",
          });
        } else {
          setScan(parsed);
        }
        return;
      }
      // … the shell's other messages
    },
    [answerScan, scan],
  );

  return (
    <>
      <WebView
        ref={webView}
        source={{ uri: origin }}
        injectedJavaScriptBeforeContentLoaded={`${OTHER_SCRIPTS}\n${SCAN_QR_DESCRIPTOR}`}
        onMessage={onMessage}
      />
      {scan ? (
        <QrScanner
          request={scan}
          onAnswer={(answer) => {
            setScan(null);
            answerScan(scan.id, answer);
          }}
        />
      ) : null}
    </>
  );
}
```

### The permission, in `app.config.js`

The camera needs an iOS usage string, and the Android permission; it needs no
microphone, and expo-camera's plugin adds one on both platforms unless told not
to. The string is what the system prompt shows the moment the user taps Scan,
and App Review reads it against what the app does. It says the camera is used
**only** to scan the pairing code:

```js
plugins: [
  [
    "expo-camera",
    {
      cameraPermission:
        "The camera is used only to scan the pairing code that connects this app to your storage server. No picture is kept.",
      microphonePermission: false, // no NSMicrophoneUsageDescription
      recordAudioAndroid: false, // no RECORD_AUDIO
    },
  ],
],
android: {
  // The camera (the pairing QR code) and nothing else. Play's data-safety
  // form is answered against this list.
  permissions: ["android.permission.CAMERA"],
  blockedPermissions: ["android.permission.RECORD_AUDIO"],
},
```

- **Keep the sentence's meaning** in every app: the camera, only, the pairing
  code, no picture kept. Name no product, server brand or repository in it. An
  app that also scans an invite to a shared space says so ("…to scan a pairing
  code or an invite…") and nothing broader.
- **Translate it** into every language the app ships, through Expo's
  `locales` (`locales: { sv: "./locales/sv.json" }`, each file
  `{ "ios": { "NSCameraUsageDescription": "…" } }` — e.g. Swedish: "Kameran
  används bara för att skanna parkopplingskoden som ansluter appen till din
  lagringsserver. Ingen bild sparas."). Without it the prompt is English on
  every phone.
- Android shows no usage string; its system dialog names the camera, and the
  page explains why before the user taps Scan.
- The permission belongs in the build that ships the scanner and not before:
  advertise `scan-qr` and add the permission in the same release.
