"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Song } from "@/lib/songs";
import { TIERS, heatHex, tierIndexFor, type TierKey } from "@/lib/tiers";
import {
  deleteFromVault,
  listVault,
  saveToVault,
  updateVault,
  vaultToSong,
} from "@/lib/local-vault";

export type FxMode = "CYBER" | "DANGER" | "COSMIC" | "MATRIX";
export type BeatType = "kick" | "snare" | "hat" | "drop";

/** Kept for backwards compatibility with older components. */
export type IntensityTier = TierKey;

export type AudioLevels = {
  freq: Uint8Array;
  wave: Uint8Array;
  bins: number;
  subBass: number;
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  /** 0..1 true loudness from RMS (dBFS mapped). */
  loudness: number;
  /** 0..1 sustained intensity that drives the 9-tier ladder. */
  heat: number;
  tierIndex: number;
  tierKey: TierKey;
  tierColor: string;
  intensity: TierKey;
  isDanger: boolean;
  /** Beat envelope 0..1 that jumps on every hit and decays — drives rail pumping. */
  kick: number;
  /** Beats per second over the last 4 seconds. */
  beatRate: number;
  rawSum: number;
  beat: number;
  beatStrength: number;
  beatType: BeatType;
  beatCount: number;
  playing: boolean;
  accent: string;
  fxMode: FxMode;
};

export type LocalSongMeta = {
  title: string;
  artist: string;
  genre: string;
  mood: string;
  accent: string;
  duration: number;
};

type PlayerValue = {
  queue: Song[];
  serverSongs: Song[];
  localSongs: Song[];
  vaultReady: boolean;
  vaultError: string | null;
  addLocalSong: (file: File, meta: LocalSongMeta) => Promise<Song>;
  removeLocalSong: (id: number) => Promise<void>;
  recolorLocalSong: (id: number, accent: string) => Promise<void>;
  current: Song | null;
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: boolean;
  fxMode: FxMode;
  autoMorph: boolean;
  setFxMode: (mode: FxMode) => void;
  toggleAutoMorph: () => void;
  cycleFxMode: () => void;
  playSong: (song: Song) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  changeVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  levels: AudioLevels;
  onFrame: (cb: (levels: AudioLevels) => void) => () => void;
};

const PlayerContext = createContext<PlayerValue | null>(null);

const BINS = 512;
const FX_MODES: FxMode[] = ["CYBER", "DANGER", "COSMIC", "MATRIX"];

function createLevels(): AudioLevels {
  return {
    freq: new Uint8Array(BINS),
    wave: new Uint8Array(BINS),
    bins: BINS,
    subBass: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    loudness: 0,
    heat: 0,
    tierIndex: 0,
    tierKey: "CALM",
    tierColor: TIERS[0].color,
    intensity: "CALM",
    isDanger: false,
    kick: 0,
    beatRate: 0,
    rawSum: 0,
    beat: 0,
    beatStrength: 0,
    beatType: "kick",
    beatCount: 0,
    playing: false,
    accent: "#35e0ff",
    fxMode: "CYBER",
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function PlayerProvider({
  children,
  initialSongs,
}: {
  children: ReactNode;
  initialSongs: Song[];
}) {
  const [serverSongs, setServerSongs] = useState<Song[]>(initialSongs);
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [vaultReady, setVaultReady] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Song | null>(initialSongs[0] ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialSongs[0]?.duration ?? 0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [fxMode, setFxModeState] = useState<FxMode>("CYBER");
  const [autoMorph, setAutoMorph] = useState(true);

  const queue = useMemo(() => [...localSongs, ...serverSongs], [localSongs, serverSongs]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rawFreq = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(BINS));
  const rawWave = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(BINS * 2));
  const floatWave = useRef<Float32Array<ArrayBuffer>>(new Float32Array(BINS * 2));
  const prevFreq = useRef<Uint8Array>(new Uint8Array(BINS));
  const [levelsObject] = useState<AudioLevels>(createLevels);
  const levelsRef = useRef<AudioLevels>(levelsObject);
  const historyRef = useRef<number[]>([]);
  const beatTimes = useRef<number[]>([]);
  const surge = useRef(0);
  const listeners = useRef(new Set<(levels: AudioLevels) => void>());
  const queueRef = useRef(queue);
  const currentRef = useRef(current);
  const playingRef = useRef(false);
  const countedRef = useRef(new Set<number>());
  const fxModeRef = useRef<FxMode>("CYBER");
  const autoMorphRef = useRef(true);
  const lastMorphTime = useRef(0);
  const objectUrls = useRef(new Map<number, string>());

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentRef.current = current;
    if (current) {
      document.documentElement.style.setProperty("--accent", current.accent);
      levelsRef.current.accent = current.accent;
    }
  }, [current]);

  useEffect(() => {
    playingRef.current = isPlaying;
    levelsRef.current.playing = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    fxModeRef.current = fxMode;
    levelsRef.current.fxMode = fxMode;
  }, [fxMode]);

  useEffect(() => {
    autoMorphRef.current = autoMorph;
  }, [autoMorph]);

  useEffect(() => {
    // Keep the server list in sync when the parent passes a new array (e.g. admin uploads).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setServerSongs(initialSongs);
    setCurrent((prev) => prev ?? initialSongs[0] ?? null);
  }, [initialSongs]);

  // ---- Personal vault (IndexedDB on the visitor's computer) ---------------
  useEffect(() => {
    let cancelled = false;
    const urls = objectUrls.current;
    listVault()
      .then((records) => {
        if (cancelled) return;
        const songs = records.map((r) => {
          const url = URL.createObjectURL(r.blob);
          urls.set(-r.key, url);
          return vaultToSong(r, url);
        });
        setLocalSongs(songs);
        setVaultReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setVaultError(error instanceof Error ? error.message : "Local vault unavailable.");
        setVaultReady(true);
      });
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  const addLocalSong = useCallback(async (file: File, meta: LocalSongMeta) => {
    const record = await saveToVault(file, { ...meta, mime: file.type });
    const url = URL.createObjectURL(record.blob);
    objectUrls.current.set(-record.key, url);
    const song = vaultToSong(record, url);
    setLocalSongs((prev) => [song, ...prev]);
    setVaultError(null);
    return song;
  }, []);

  const removeLocalSong = useCallback(async (id: number) => {
    if (id >= 0) return;
    await deleteFromVault(-id);
    if (currentRef.current?.id === id) {
      audioRef.current?.pause();
      setIsPlaying(false);
      const fallback = queueRef.current.find((s) => s.id !== id) ?? null;
      setCurrent(fallback);
      if (audioRef.current && fallback) audioRef.current.src = fallback.src;
    }
    const url = objectUrls.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrls.current.delete(id);
    }
    setLocalSongs((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const recolorLocalSong = useCallback(async (id: number, accent: string) => {
    if (id >= 0) return;
    await updateVault(-id, { accent });
    setLocalSongs((prev) => prev.map((s) => (s.id === id ? { ...s, accent } : s)));
    setCurrent((prev) => (prev && prev.id === id ? { ...prev, accent } : prev));
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("blndfld:volume");
    // Preferences live in localStorage, which is only readable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setVolume(Math.min(1, Math.max(0, Number(stored))));
    const storedFx = window.localStorage.getItem("blndfld:fxMode") as FxMode | null;
    if (storedFx && FX_MODES.includes(storedFx)) {
      setFxModeState(storedFx);
      fxModeRef.current = storedFx;
    }
    const storedMorph = window.localStorage.getItem("blndfld:autoMorph");
    if (storedMorph === "0") setAutoMorph(false);
  }, []);

  const setFxMode = useCallback((mode: FxMode) => {
    setFxModeState(mode);
    fxModeRef.current = mode;
    window.localStorage.setItem("blndfld:fxMode", mode);
  }, []);

  const toggleAutoMorph = useCallback(() => {
    setAutoMorph((prev) => {
      window.localStorage.setItem("blndfld:autoMorph", prev ? "0" : "1");
      return !prev;
    });
  }, []);

  const cycleFxMode = useCallback(() => {
    const nextIdx = (FX_MODES.indexOf(fxModeRef.current) + 1) % FX_MODES.length;
    setFxMode(FX_MODES[nextIdx]);
  }, [setFxMode]);

  const ensureGraph = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        const ctx = new Ctor();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = BINS * 2;
        analyser.smoothingTimeConstant = 0.6;
        // Wider dB window = headroom so loud masters don't instantly saturate.
        analyser.minDecibels = -95;
        analyser.maxDecibels = -12;
        const source = ctx.createMediaElementSource(el);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
      } catch {
        /* visuals fall back to simulated motion */
      }
    }
    void ctxRef.current?.resume();
  }, []);

  // ---- Shared animation-frame bus + analysis --------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const levels = levelsRef.current;
      const analyser = analyserRef.current;
      const playing = playingRef.current;
      const now = performance.now();
      // Frame-rate independent factor (1 == 60fps).
      const dt = Math.min(3, (now - last) / 16.67);
      last = now;

      if (autoMorphRef.current && playing && now - lastMorphTime.current > 24000) {
        lastMorphTime.current = now;
        const nextIdx = (FX_MODES.indexOf(fxModeRef.current) + 1) % FX_MODES.length;
        fxModeRef.current = FX_MODES[nextIdx];
        levels.fxMode = FX_MODES[nextIdx];
        setFxModeState(FX_MODES[nextIdx]);
      }

      let sum = 0;
      let rms = 0;
      if (analyser) {
        analyser.getByteFrequencyData(rawFreq.current);
        analyser.getByteTimeDomainData(rawWave.current);
        analyser.getFloatTimeDomainData(floatWave.current);
        for (let i = 0; i < BINS; i += 1) {
          levels.freq[i] = rawFreq.current[i];
          levels.wave[i] = rawWave.current[i];
          sum += rawFreq.current[i];
        }
        const fw = floatWave.current;
        let sq = 0;
        for (let i = 0; i < fw.length; i += 1) sq += fw[i] * fw[i];
        rms = Math.sqrt(sq / fw.length);
      }
      levels.rawSum = sum;

      if (sum === 0) {
        // Idle shimmer / analyser-blocked fallback: keep the scene breathing.
        const amp = playing ? 0.6 : 0.2;
        for (let i = 0; i < BINS; i += 1) {
          const n =
            Math.sin(now / 520 + i * 0.16) * 0.5 +
            Math.sin(now / 185 + i * 0.045) * 0.3 +
            Math.sin(now / 92 + i * 0.011) * 0.2;
          const falloff = Math.pow(1 - i / BINS, 1.4);
          levels.freq[i] = Math.max(0, Math.min(255, (n * 0.5 + 0.5) * falloff * amp * 255));
          levels.wave[i] = 128 + Math.sin(now / 150 + i * 0.09) * 44 * amp;
        }
        rms = playing ? 0.05 + Math.abs(Math.sin(now / 470)) * 0.05 : 0;
      }

      const avg = (from: number, to: number) => {
        let total = 0;
        for (let i = from; i < to; i += 1) total += levels.freq[i];
        return total / ((to - from) * 255);
      };

      // ~21.5Hz per bin at 44.1kHz with 1024 FFT
      levels.subBass = avg(1, 5);
      levels.bass = avg(4, 12);
      levels.mid = avg(12, 110);
      levels.treble = avg(110, 380);
      levels.energy = clamp01(
        levels.bass * 0.45 + levels.subBass * 0.2 + levels.mid * 0.25 + levels.treble * 0.1,
      );

      // True loudness: RMS -> dBFS; -42dB => 0, -2dB => 1
      const db = rms > 0 ? 20 * Math.log10(rms) : -100;
      const loudTarget = clamp01((db + 42) / 40);
      levels.loudness += (loudTarget - levels.loudness) * Math.min(1, 0.18 * dt);

      // Per-band spectral flux for onset + classification
      let lowFlux = 0;
      let midFlux = 0;
      let highFlux = 0;
      const prev = prevFreq.current;
      for (let i = 1; i < 300; i += 1) {
        const diff = levels.freq[i] - prev[i];
        if (diff > 0) {
          if (i < 12) lowFlux += diff;
          else if (i < 110) midFlux += diff;
          else highFlux += diff;
        }
        prev[i] = levels.freq[i];
      }
      lowFlux /= 11 * 255;
      midFlux /= 98 * 255;
      highFlux /= 190 * 255;

      const punch = levels.bass * 0.45 + levels.subBass * 0.25 + lowFlux * 1.6 + midFlux * 1.2;
      const history = historyRef.current;
      history.push(punch);
      if (history.length > 50) history.shift();
      let mean = 0;
      for (const v of history) mean += v;
      mean /= history.length;

      if (
        playing &&
        punch > 0.08 &&
        punch > mean * 1.16 &&
        now - levels.beat > 120
      ) {
        levels.beat = now;
        levels.beatCount += 1;
        const strength = clamp01((punch / Math.max(0.05, mean) - 1) * 0.9 + levels.loudness * 0.5);
        levels.beatStrength = strength;
        const lowN = lowFlux * 2.4;
        const midN = midFlux * 3.2;
        const highN = highFlux * 4.5;
        if (levels.subBass > 0.62 && lowN > 0.35 && levels.loudness > 0.6) levels.beatType = "drop";
        else if (lowN >= midN && lowN >= highN) levels.beatType = "kick";
        else if (midN >= highN) levels.beatType = "snare";
        else levels.beatType = "hat";
        levels.kick = Math.max(levels.kick, 0.45 + strength * 0.55);
        beatTimes.current.push(now);
      }

      // Kick envelope decays smoothly every frame
      levels.kick *= Math.pow(0.86, dt);

      const times = beatTimes.current;
      while (times.length && now - times[0] > 4000) times.shift();
      levels.beatRate = times.length / 4;

      // ---- Heat model ------------------------------------------------------
      const density = clamp01(levels.beatRate / 3.2);
      const target = playing
        ? clamp01(
            Math.pow(levels.loudness, 1.8) * 0.5 +
              density * 0.2 +
              levels.energy * 0.2 +
              Math.pow(levels.subBass, 2) * 0.1,
          )
        : 0;
      // Surge only builds while the track stays hot — unlocks the top tiers.
      if (target > 0.62) surge.current = Math.min(1, surge.current + 0.0022 * dt * (target + density));
      else surge.current = Math.max(0, surge.current - 0.006 * dt);
      const heatTarget = clamp01(target * 0.78 + surge.current * 0.3);
      const rate = heatTarget > levels.heat ? 0.06 : 0.025;
      levels.heat += (heatTarget - levels.heat) * Math.min(1, rate * dt);

      const ti = tierIndexFor(levels.heat);
      levels.tierIndex = ti;
      levels.tierKey = TIERS[ti].key;
      levels.intensity = TIERS[ti].key;
      levels.tierColor = heatHex(levels.heat);
      levels.isDanger = ti >= 4;

      const root = document.documentElement.style;
      root.setProperty("--audio-level", levels.energy.toFixed(3));
      root.setProperty("--audio-bass", levels.bass.toFixed(3));
      root.setProperty("--audio-sub", levels.subBass.toFixed(3));
      root.setProperty("--audio-treble", levels.treble.toFixed(3));
      root.setProperty("--audio-kick", levels.kick.toFixed(3));
      root.setProperty("--audio-heat", levels.heat.toFixed(3));
      root.setProperty("--tier", levels.tierColor);

      listeners.current.forEach((cb) => {
        try {
          cb(levels);
        } catch (error) {
          console.error("[visuals] frame listener failed", error);
        }
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onFrame = useCallback((cb: (levels: AudioLevels) => void) => {
    listeners.current.add(cb);
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  const startPlayback = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    ensureGraph();
    const attempt = el.play();
    if (attempt) {
      attempt.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [ensureGraph]);

  const playSong = useCallback(
    (song: Song) => {
      const el = audioRef.current;
      if (!el) return;
      if (currentRef.current?.id === song.id && el.src) {
        if (el.paused) startPlayback();
        else {
          el.pause();
          setIsPlaying(false);
        }
        return;
      }
      setCurrent(song);
      currentRef.current = song;
      setCurrentTime(0);
      setDuration(song.duration || 0);
      setIsReady(false);
      el.src = song.src;
      el.load();
      startPlayback();
    },
    [startPlayback],
  );

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !currentRef.current) return;
    if (el.paused) startPlayback();
    else {
      el.pause();
      setIsPlaying(false);
    }
  }, [startPlayback]);

  const step = useCallback(
    (dir: 1 | -1) => {
      const list = queueRef.current;
      if (!list.length) return;
      const idx = list.findIndex((s) => s.id === currentRef.current?.id);
      let nextIdx: number;
      if (shuffle && list.length > 1) {
        do {
          nextIdx = Math.floor(Math.random() * list.length);
        } while (nextIdx === idx);
      } else {
        nextIdx = (idx + dir + list.length) % list.length;
      }
      playSong(list[nextIdx]);
    },
    [playSong, shuffle],
  );

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => {
    const el = audioRef.current;
    if (el && el.currentTime > 4) {
      el.currentTime = 0;
      return;
    }
    step(-1);
  }, [step]);

  const seek = useCallback((time: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(time)) return;
    el.currentTime = time;
    setCurrentTime(time);
  }, []);

  const changeVolume = useCallback((value: number) => {
    const v = Math.min(1, Math.max(0, value));
    setVolume(v);
    setMuted(v === 0);
    window.localStorage.setItem("blndfld:volume", String(v));
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const toggleRepeat = useCallback(() => setRepeat((r) => !r), []);

  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.volume = muted ? 0 : volume;
      el.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName) || target.isContentEditable)) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggle();
      } else if (event.code === "ArrowRight" && event.shiftKey) {
        next();
      } else if (event.code === "ArrowLeft" && event.shiftKey) {
        prev();
      } else if (event.key.toLowerCase() === "m") {
        toggleMute();
      } else if (event.key.toLowerCase() === "v") {
        cycleFxMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, next, prev, toggleMute, cycleFxMode]);

  const handleEnded = useCallback(() => {
    const el = audioRef.current;
    if (repeat && el) {
      el.currentTime = 0;
      startPlayback();
      return;
    }
    step(1);
  }, [repeat, startPlayback, step]);

  const handlePlaying = useCallback(() => {
    const song = currentRef.current;
    if (!song || song.id < 0 || countedRef.current.has(song.id)) return;
    countedRef.current.add(song.id);
    const el = audioRef.current;
    void fetch(`/api/songs/${song.id}/play`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        duration: el?.duration && Number.isFinite(el.duration) ? el.duration : 0,
      }),
    }).catch(() => undefined);
  }, []);

  const value = useMemo<PlayerValue>(
    () => ({
      queue,
      serverSongs,
      localSongs,
      vaultReady,
      vaultError,
      addLocalSong,
      removeLocalSong,
      recolorLocalSong,
      current,
      isPlaying,
      isReady,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      fxMode,
      autoMorph,
      setFxMode,
      toggleAutoMorph,
      cycleFxMode,
      playSong,
      toggle,
      next,
      prev,
      seek,
      changeVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      levels: levelsObject,
      onFrame,
    }),
    [
      queue,
      serverSongs,
      localSongs,
      vaultReady,
      vaultError,
      addLocalSong,
      removeLocalSong,
      recolorLocalSong,
      current,
      isPlaying,
      isReady,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      fxMode,
      autoMorph,
      setFxMode,
      toggleAutoMorph,
      cycleFxMode,
      playSong,
      toggle,
      next,
      prev,
      seek,
      changeVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      onFrame,
      levelsObject,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={current?.src}
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setIsReady(true);
          if (Number.isFinite(el.duration)) setDuration(el.duration);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlaying={handlePlaying}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onError={() => setIsPlaying(false)}
        className="hidden"
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
