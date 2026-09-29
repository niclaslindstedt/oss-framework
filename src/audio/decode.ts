// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Decoding a recording back to samples, through the browser's own decoder.
// Whatever container a `MediaRecorder` produced — Opus in WebM, AAC in MP4 —
// the browser that made it can read it, and so can it read a WAV or a FLAC.
//
// `decodeAudioData` needs an `AudioContext`; one is made per call and
// closed after, so nothing is left running. Outside a browser the call
// rejects, which is the one thing a test can check.

import type { Pcm } from "./pcm.ts";

/** An `AudioBuffer`'s channels, copied out as a {@link Pcm}. */
export function pcmFromAudioBuffer(buffer: AudioBuffer): Pcm {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const out = new Float32Array(buffer.length);
    buffer.copyFromChannel(out, c);
    channels.push(out);
  }
  return { sampleRate: buffer.sampleRate, channels };
}

type ContextCtor = typeof AudioContext;

function contextCtor(): ContextCtor | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as {
    AudioContext?: ContextCtor;
    webkitAudioContext?: ContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** Decode a file's bytes (or a `Blob`) to samples. Rejects where the browser
 *  cannot decode the container, and outside a browser. */
export async function decodeAudio(
  input: Blob | Uint8Array | ArrayBuffer,
): Promise<Pcm> {
  const Ctor = contextCtor();
  if (!Ctor) throw new Error("Audio decoding needs a browser.");
  const bytes =
    input instanceof Blob
      ? await input.arrayBuffer()
      : input instanceof ArrayBuffer
        ? input
        : input.buffer.slice(
            input.byteOffset,
            input.byteOffset + input.byteLength,
          );
  const context = new Ctor();
  try {
    const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      // The promise form is not on every WebKit; the callback form is.
      const result = context.decodeAudioData(
        bytes as ArrayBuffer,
        resolve,
        (err) =>
          reject(err ?? new Error("The recording could not be decoded.")),
      );
      if (
        result &&
        typeof (result as Promise<AudioBuffer>).then === "function"
      ) {
        (result as Promise<AudioBuffer>).then(resolve, reject);
      }
    });
    return pcmFromAudioBuffer(buffer);
  } finally {
    void context.close().catch(() => {});
  }
}
