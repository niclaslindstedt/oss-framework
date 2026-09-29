// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Playback of one recording, as React state, over an `HTMLAudioElement`.
//
// The element is made once and reused; the source is a `Blob` (an object
// URL is made and revoked around it) or a URL. The position is read on an
// animation frame while playing, because the element's own `timeupdate`
// fires four times a second and a playhead on a waveform stutters at that.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Player = {
  playing: boolean;
  /** Seconds. */
  time: number;
  duration: number;
  ended: boolean;
  /** Whether the element is still finding out how long the file is. */
  loading: boolean;
  error: string | null;
  rate: number;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  seek: (seconds: number) => void;
  /** Move by a number of seconds, either way, clamped to the file. */
  skip: (seconds: number) => void;
  setRate: (rate: number) => void;
};

/** The playback rates offered. */
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function usePlayer(
  source: Blob | string | null,
  options: { rate?: number } = {},
): Player {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRateState] = useState(options.rate ?? 1);
  const raf = useRef(0);

  const element = useCallback((): HTMLAudioElement | null => {
    if (audio.current) return audio.current;
    if (typeof Audio === "undefined") return null;
    const el = new Audio();
    el.preload = "metadata";
    audio.current = el;
    return el;
  }, []);

  useEffect(() => {
    const el = element();
    if (!el) return;
    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setEnded(true);
    };
    const onMeta = () => {
      // A recording the browser wrote itself may report `Infinity` until it
      // has been played through once; leave the duration unknown then.
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      setLoading(false);
    };
    const onDuration = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onTime = () => setTime(el.currentTime);
    const onError = () => {
      setLoading(false);
      setError(el.error?.message || "The recording could not be played.");
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onDuration);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onDuration);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("error", onError);
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [element]);

  // The source: an object URL for a blob, made and revoked here.
  useEffect(() => {
    const el = element();
    if (!el) return;
    setTime(0);
    setDuration(0);
    setEnded(false);
    setError(null);
    setPlaying(false);
    if (!source) {
      el.pause();
      el.removeAttribute("src");
      el.load();
      return;
    }
    const url =
      typeof source === "string" ? source : URL.createObjectURL(source);
    setLoading(true);
    el.src = url;
    el.load();
    return () => {
      el.pause();
      if (typeof source !== "string") URL.revokeObjectURL(url);
    };
  }, [element, source]);

  useEffect(() => {
    const el = element();
    if (el) el.playbackRate = rate;
  }, [element, rate]);

  // Smooth position while playing.
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const el = audio.current;
      if (el) setTime(el.currentTime);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const play = useCallback(async () => {
    const el = element();
    if (!el) return;
    if (el.ended) el.currentTime = 0;
    try {
      await el.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [element]);

  const pause = useCallback(() => element()?.pause(), [element]);

  const toggle = useCallback(async () => {
    const el = element();
    if (!el) return;
    if (el.paused) await play();
    else el.pause();
  }, [element, play]);

  const seek = useCallback(
    (seconds: number) => {
      const el = element();
      if (!el) return;
      const max = Number.isFinite(el.duration) ? el.duration : duration;
      const next = Math.max(0, Math.min(max || seconds, seconds));
      el.currentTime = next;
      setTime(next);
      setEnded(false);
    },
    [element, duration],
  );

  const skip = useCallback(
    (seconds: number) => seek((audio.current?.currentTime ?? 0) + seconds),
    [seek],
  );

  const setRate = useCallback((next: number) => setRateState(next), []);

  return useMemo(
    () => ({
      playing,
      time,
      duration,
      ended,
      loading,
      error,
      rate,
      play,
      pause,
      toggle,
      seek,
      skip,
      setRate,
    }),
    [
      playing,
      time,
      duration,
      ended,
      loading,
      error,
      rate,
      play,
      pause,
      toggle,
      seek,
      skip,
      setRate,
    ],
  );
}
