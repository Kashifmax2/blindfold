/**
 * Nine-level intensity ladder. Quiet songs live in the cool tiers; the hotter
 * the track (loudness × beat density × sustained energy) the further it climbs —
 * past red into magenta, ultraviolet, hyperspace blue and finally white-hot
 * "Singularity", which needs sustained, dense, very loud music to reach.
 */
export type TierKey =
  | "CALM"
  | "GROOVE"
  | "HYPE"
  | "BLAZE"
  | "DANGER"
  | "INFERNO"
  | "ULTRA"
  | "HYPERSPACE"
  | "SINGULARITY";

export type Tier = { key: TierKey; label: string; color: string; icon: string };

export const TIERS: Tier[] = [
  { key: "CALM", label: "Calm", color: "#35e0ff", icon: "🌙" },
  { key: "GROOVE", label: "Groove", color: "#3dffb8", icon: "🎧" },
  { key: "HYPE", label: "Hype", color: "#b8ff3d", icon: "⚡" },
  { key: "BLAZE", label: "Blaze", color: "#ffb02e", icon: "🔥" },
  { key: "DANGER", label: "Danger", color: "#ff3b3b", icon: "⚠️" },
  { key: "INFERNO", label: "Inferno", color: "#ff2fb0", icon: "☄️" },
  { key: "ULTRA", label: "Ultraviolet", color: "#a03dff", icon: "🔮" },
  { key: "HYPERSPACE", label: "Hyperspace", color: "#3d5cff", icon: "🌌" },
  { key: "SINGULARITY", label: "Singularity", color: "#f1ecff", icon: "🕳️" },
];

function hexToRgbTuple(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const RGB = TIERS.map((t) => hexToRgbTuple(t.color));

export function tierIndexFor(heat: number) {
  return Math.max(0, Math.min(TIERS.length - 1, Math.floor(heat * TIERS.length)));
}

/** Smoothly interpolated colour for a 0..1 heat value. */
export function heatRgb(heat: number): [number, number, number] {
  const pos = Math.max(0, Math.min(0.9999, heat)) * (TIERS.length - 1);
  const i = Math.floor(pos);
  const f = pos - i;
  const a = RGB[i];
  const b = RGB[Math.min(RGB.length - 1, i + 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export function heatHex(heat: number) {
  const [r, g, b] = heatRgb(heat);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
