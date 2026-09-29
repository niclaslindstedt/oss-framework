// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A `Capture`, as React state: the buttons' view of a recording.
//
// The hook holds what a screen renders on — the state, the elapsed time at
// a rate a clock is read at, the last error — and hands the frames a meter
// draws straight through (`subscribe`), so the screen renders a few times a
// second while the meter and the spectrum move sixty.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Capture,
  type CaptureFrame,
  type CaptureOptions,
  type CaptureResult,
  type CaptureState,
} from "./capture.ts";
import { METER_REST, type MeterState } from "./levels.ts";

export type RecorderError = "denied" | "unavailable" | "failed";

/** Which of the browser's refusals a failure to open the device was. */
export function classifyRecorderError(err: unknown): RecorderError {
  const name =
    err instanceof DOMException ? err.name : (err as { name?: string })?.name;
  if (
    name === "NotAllowedError" ||
    name === "SecurityError" ||
    name === "PermissionDeniedError"
  ) {
    return "denied";
  }
  if (
    name === "NotFoundError" ||
    name === "NotSupportedError" ||
    name === "OverconstrainedError" ||
    name === "NotReadableError"
  ) {
    return "unavailable";
  }
  return "failed";
}

export type Recorder = {
  state: CaptureState;
  /** Recorded time, ms, updated a few times a second. */
  elapsedMs: number;
  /** The meter as of the last frame the hook looked at — for a summary
   *  line, not for drawing; the components subscribe themselves. */
  meter: MeterState;
  error: RecorderError | null;
  /** Frames, once per animation frame, for the meter and the spectrum. */
  subscribe: (listener: (frame: CaptureFrame) => void) => () => void;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  /** End and hand back the recording. */
  stop: () => Promise<CaptureResult | null>;
  /** End and keep nothing. */
  cancel: () => Promise<void>;
};

/** How often the rendered elapsed time is refreshed. */
const TICK_MS = 100;

export function useRecorder(options: CaptureOptions = {}): Recorder {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const captureRef = useRef<Capture | null>(null);
  const listeners = useRef(new Set<(frame: CaptureFrame) => void>());
  const [state, setState] = useState<CaptureState>("idle");
  const [elapsedMs, setElapsed] = useState(0);
  const [meter, setMeter] = useState<MeterState>(METER_REST);
  const [error, setError] = useState<RecorderError | null>(null);

  // A capture's own subscription is per capture; the hook's outlives them,
  // so a meter mounted before `start` still gets the frames.
  const subscribe = useCallback((listener: (frame: CaptureFrame) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const start = useCallback(async () => {
    if (captureRef.current) return;
    setError(null);
    const capture = new Capture(optionsRef.current);
    captureRef.current = capture;
    setState("starting");
    try {
      await capture.start();
    } catch (err) {
      captureRef.current = null;
      setState("idle");
      setError(classifyRecorderError(err));
      throw err;
    }
    setState(capture.state);
    let lastRender = 0;
    capture.subscribe((frame) => {
      for (const listener of listeners.current) listener(frame);
      const t = frame.elapsedMs;
      if (t - lastRender >= TICK_MS || t < lastRender) {
        lastRender = t;
        setElapsed(t);
        setMeter(frame.meter);
      }
    });
  }, []);

  const pause = useCallback(() => {
    captureRef.current?.pause();
    setState(captureRef.current?.state ?? "idle");
  }, []);

  const resume = useCallback(() => {
    captureRef.current?.resume();
    setState(captureRef.current?.state ?? "idle");
  }, []);

  const stop = useCallback(async () => {
    const capture = captureRef.current;
    if (!capture) return null;
    setState("stopping");
    try {
      const result = await capture.stop();
      setElapsed(result.durationMs);
      return result;
    } finally {
      captureRef.current = null;
      setState("idle");
      setMeter(METER_REST);
    }
  }, []);

  const cancel = useCallback(async () => {
    const capture = captureRef.current;
    captureRef.current = null;
    setState("idle");
    setElapsed(0);
    setMeter(METER_REST);
    await capture?.cancel();
  }, []);

  // Unmounting mid-recording releases the device.
  useEffect(
    () => () => {
      void captureRef.current?.cancel();
      captureRef.current = null;
    },
    [],
  );

  return useMemo(
    () => ({
      state,
      elapsedMs,
      meter,
      error,
      subscribe,
      start,
      pause,
      resume,
      stop,
      cancel,
    }),
    [
      state,
      elapsedMs,
      meter,
      error,
      subscribe,
      start,
      pause,
      resume,
      stop,
      cancel,
    ],
  );
}
