<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# audio

Everything an app needs to record a sound, show that it is recording, play
it back and write it to a file — and none of it knows what the sound is
for. `@niclaslindstedt/oss-framework/audio`.

## The pure core

| Module        | What                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `levels.ts`   | A frame of samples → RMS and peak in dBFS and whether it clipped (`readFrame`); the meter's ballistics — instant rise, a slope down, a held peak, a latched clip lamp (`stepMeter`).        |
| `spectrum.ts` | An analyser's bins folded into bars on a log frequency axis (`layoutBands`, `bandLevels`), eased between frames (`smoothBands`), with the 100 / 1k / 10k ticks (`bandTicks`).               |
| `pcm.ts`      | A recording as samples: mono fold, linear resampling with a low-pass on the way down, quantising, interleaving, waveform peaks — and `RunningPeaks`, a thumbnail that never grows past `n`. |
| `wav.ts`      | `encodeWav` (16 / 24-bit PCM, 32-bit float) and `decodeWav`.                                                                                                                                |
| `flac.ts`     | `encodeFlac`: lossless, dependency-free — fixed predictors, Rice residuals, CRC-8 / CRC-16, three search levels. Every decoder reads it; the tests decode it back with one of their own.    |
| `mp3.ts`      | `encodeMp3`, over the optional peer `@breezystack/lamejs`. Its own entry, `…/audio/mp3`, so nothing else resolves the package.                                                              |
| `decode.ts`   | `decodeAudio`: any container the browser can play, back to samples.                                                                                                                         |

## The microphone

`Capture` opens the device, hangs an analyser on it for the spectrum, taps
every sample through an `AudioWorklet` (a `ScriptProcessorNode` where there
is none) for the meter, the clip lamp, the thumbnail and the elapsed time,
and keeps the recording either through a `MediaRecorder` (`encoded`: the
browser's container, a `Blob` back) or as the samples themselves (`pcm`: a
`Pcm` back, for `encodeFlac`). Frames go to `subscribe`rs once per animation
frame, off React's render loop. `useRecorder` is the hook over it —
state, elapsed time and error as React state, the frames passed through.

`usePlayer` plays a `Blob` or a URL through one `HTMLAudioElement`: play,
pause, seek, skip, rate, the position read on an animation frame while
playing.

## The components

| Component      | What                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LevelMeter`   | The bar in the theme's zones (accent → flag → danger), the held peak, the loudest-ever tick, the printed scale and a CLIP lamp that also announces itself. `role="meter"`. |
| `SpectrumBars` | One canvas bar per band with a peak mark that holds and falls; colours read off the theme's variables; the marks left out under reduced motion.                            |
| `Waveform`     | Peaks as mirrored bars in SVG with the playhead; with `onSeek` a keyboard-reachable slider, without one a picture.                                                         |

Both live components draw from a `subscribe` — a capture's, a recorder's, or
anything with the same shape — so a meter moves sixty times a second without
a React render.

## What stays in the app

What a recording is called, where it is filed, what it syncs to and which
formats an export offers are the app's. The framework hands back bytes and
samples and draws what it is handed.
