"use client";

/**
 * Adaptive quality manager.
 *
 * Keeps every animation running, but scales HOW MUCH work each frame does so
 * low-end PCs stay smooth. It measures real FPS from the render loop and
 * downgrades automatically (never upgrades into a stutter), and the visitor can
 * force a level from the UI.
 */

export type QualityChoice = "auto" | "low" | "medium" | "high";
export type Quality = "low" | "medium" | "high";

export type PerfProfile = {
  quality: Quality;
  auto: boolean;
  /** Rolling frames per second. */
  fps: number;
  /** Cap for devicePixelRatio — the single biggest fill-rate saving. */
  dpr: number;
  /** Multiplier applied to particle / spark counts. */
  density: number;
  /** Vertical spacing of the side-rail spectrum bars (bigger = fewer bars). */
  barStep: number;
  /** Radius multiplier for glow blobs (fewer pixels lit per particle). */
  glow: number;
  layers: {
    background: boolean;
    storm: boolean;
    lightning: boolean;
    cracks: boolean;
    shockwaves: boolean;
    tornado: boolean;
    aurora: boolean;
    accretion: boolean;
    glitch: boolean;
    strobe: boolean;
    scanline: boolean;
  };
};

const PROFILES: Record<Quality, Omit<PerfProfile, "quality" | "auto" | "fps">> = {
  high: {
    dpr: 1.75,
    density: 1,
    barStep: 8,
    glow: 1,
    layers: {
      background: true,
      storm: true,
      lightning: true,
      cracks: true,
      shockwaves: true,
      tornado: true,
      aurora: true,
      accretion: true,
      glitch: true,
      strobe: true,
      scanline: true,
    },
  },
  medium: {
    dpr: 1.25,
    density: 0.6,
    barStep: 11,
    glow: 0.7,
    layers: {
      background: true,
      storm: true,
      lightning: true,
      cracks: true,
      shockwaves: true,
      tornado: true,
      aurora: false,
      accretion: true,
      glitch: true,
      strobe: true,
      scanline: true,
    },
  },
  low: {
    dpr: 1,
    density: 0.32,
    barStep: 15,
    glow: 0.45,
    layers: {
      background: false,
      storm: true,
      lightning: true,
      cracks: true,
      shockwaves: true,
      tornado: false,
      aurora: false,
      accretion: false,
      glitch: false,
      strobe: false,
      scanline: false,
    },
  },
};

const STORE_KEY = "blndfld:quality";
const DOWNGRADE_AFTER = 3; // consecutive weak windows
const UPGRADE_AFTER = 14; // strong windows before trying a higher level
const ORDER: Quality[] = ["low", "medium", "high"];

type DeviceHint = "low" | "medium" | "high";

function deviceHint(): DeviceHint {
  if (typeof window === "undefined") return "high";
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "low";
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 2 || mem <= 2) return "low";
  if (cores <= 4 || mem <= 4) return "medium";
  return "high";
}

class PerfManager {
  private choice: QualityChoice = "auto";
  private resolved: Quality = deviceHint();
  private fps = 60;
  private weak = 0;
  private strong = 0;
  private frames = 0;
  private accum = 0;
  private listeners = new Set<(p: PerfProfile) => void>();
  private snapshot: PerfProfile;

  constructor() {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORE_KEY) as QualityChoice | null;
      if (stored === "low" || stored === "medium" || stored === "high" || stored === "auto") {
        this.choice = stored;
      }
    }
    this.resolved = this.choice === "auto" ? deviceHint() : this.choice;
    this.snapshot = this.build();
  }

  private build(): PerfProfile {
    const base = PROFILES[this.resolved];
    return { ...base, quality: this.resolved, auto: this.choice === "auto", fps: Math.round(this.fps) };
  }

  private emit() {
    this.snapshot = this.build();
    this.listeners.forEach((cb) => cb(this.snapshot));
  }

  get profile() {
    return this.snapshot;
  }

  get selected() {
    return this.choice;
  }

  subscribe(cb: (p: PerfProfile) => void) {
    this.listeners.add(cb);
    cb(this.snapshot);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Called once per rendered frame by the stage loop. */
  report(frameMs: number) {
    this.frames += 1;
    this.accum += frameMs;
    if (this.frames < 30) return;
    this.fps = 1000 / (this.accum / this.frames);
    this.frames = 0;
    this.accum = 0;
    if (this.choice !== "auto") {
      if (this.snapshot.fps !== Math.round(this.fps)) this.emit();
      return;
    }
    if (this.fps < 42) {
      this.weak += 1;
      this.strong = 0;
      if (this.weak >= DOWNGRADE_AFTER) {
        this.weak = 0;
        const idx = ORDER.indexOf(this.resolved);
        if (idx > 0) {
          this.resolved = ORDER[idx - 1];
          this.emit();
        }
      }
    } else if (this.fps > 55) {
      this.strong += 1;
      this.weak = 0;
      if (this.strong >= UPGRADE_AFTER) {
        this.strong = 0;
        const idx = ORDER.indexOf(this.resolved);
        const ceiling = ORDER.indexOf(deviceHint());
        if (idx < Math.min(ORDER.length - 1, ceiling < 0 ? ORDER.length - 1 : ceiling)) {
          this.resolved = ORDER[idx + 1];
          this.emit();
        }
      }
    } else {
      this.weak = 0;
      this.strong = Math.max(0, this.strong);
    }
  }

  setChoice(next: QualityChoice) {
    this.choice = next;
    if (typeof window !== "undefined") window.localStorage.setItem(STORE_KEY, next);
    this.resolved = next === "auto" ? deviceHint() : next;
    this.weak = 0;
    this.strong = 0;
    this.emit();
  }
}

let manager: PerfManager | null = null;

export function perf() {
  if (!manager) manager = new PerfManager();
  return manager;
}

/** Convenience: the current profile snapshot. */
export function currentProfile() {
  return perf().profile;
}
