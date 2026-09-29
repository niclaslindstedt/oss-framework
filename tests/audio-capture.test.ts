// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  Capture,
  RECORDING_MIMES,
  classifyRecorderError,
  extensionForMime,
  pickRecordingMime,
} from "../src/audio/index.ts";
import { encodeMp3, nearestMp3SampleRate } from "../src/audio/mp3.ts";
import { resample, type Pcm } from "../src/audio/pcm.ts";

describe("pickRecordingMime", () => {
  it("takes the first container the encoder supports", () => {
    expect(
      pickRecordingMime(RECORDING_MIMES, (m) => m.startsWith("audio/mp4")),
    ).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(pickRecordingMime(RECORDING_MIMES, () => true)).toBe(
      "audio/webm;codecs=opus",
    );
  });

  it("falls back to the encoder's default when nothing is supported", () => {
    expect(pickRecordingMime(RECORDING_MIMES, () => false)).toBe("");
    expect(
      pickRecordingMime(RECORDING_MIMES, () => {
        throw new Error("no MediaRecorder");
      }),
    ).toBe("");
  });
});

describe("extensionForMime", () => {
  it("names the file for its container", () => {
    expect(extensionForMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(extensionForMime("audio/mpeg")).toBe("mp3");
    expect(extensionForMime("audio/flac")).toBe("flac");
    expect(extensionForMime("audio/wav")).toBe("wav");
    expect(extensionForMime("")).toBe("bin");
  });
});

describe("classifyRecorderError", () => {
  it("tells a refusal from a missing device from anything else", () => {
    expect(
      classifyRecorderError(new DOMException("no", "NotAllowedError")),
    ).toBe("denied");
    expect(classifyRecorderError(new DOMException("no", "NotFoundError"))).toBe(
      "unavailable",
    );
    expect(
      classifyRecorderError(new DOMException("no", "NotSupportedError")),
    ).toBe("unavailable");
    expect(classifyRecorderError(new Error("boom"))).toBe("failed");
    expect(classifyRecorderError({ name: "NotReadableError" })).toBe(
      "unavailable",
    );
  });
});

describe("Capture", () => {
  it("refuses to start where there is no microphone API, and stays idle", async () => {
    const capture = new Capture();
    expect(capture.state).toBe("idle");
    await expect(capture.start()).rejects.toMatchObject({
      name: "NotSupportedError",
    });
    expect(capture.state).toBe("idle");
    expect(capture.elapsedMs).toBe(0);
  });

  it("hands frames to subscribers and lets them go", () => {
    const capture = new Capture({ bands: 8 });
    const off = capture.subscribe(() => {});
    off();
    expect(capture.mode).toBe("encoded");
  });
});

describe("encodeMp3", () => {
  const tone = (): Float32Array => {
    const n = 44100 / 2;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++)
      out[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 44100);
    return out;
  };

  it("writes MPEG frames the header sync identifies", () => {
    const pcm: Pcm = { sampleRate: 44100, channels: [tone()] };
    const bytes = encodeMp3(pcm, 128);
    expect(bytes.length).toBeGreaterThan(4000);
    // The first frame header: 11 sync bits set.
    expect(bytes[0]).toBe(0xff);
    expect((bytes[1] ?? 0) & 0xe0).toBe(0xe0);
    // Half a second at 128 kbit/s is about 8 kB.
    expect(bytes.length).toBeLessThan(12000);
  });

  it("encodes stereo, and a resampled rate", () => {
    const pcm: Pcm = { sampleRate: 48000, channels: [tone(), tone()] };
    const at = nearestMp3SampleRate(47000);
    expect(at).toBe(48000);
    const bytes = encodeMp3(resample(pcm, 32000), 64);
    expect(bytes[0]).toBe(0xff);
  });
});
