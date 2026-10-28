"use client";

import { useEffect, useRef, useState, type ReactElement, type SVGProps } from "react";
import { TIERS, heatRgb, type TierKey } from "@/lib/tiers";
import { perf, type QualityChoice } from "@/lib/perf";
import {
  AlertIcon,
  BoltIcon,
  CometIcon,
  FlameIcon,
  GalaxyIcon,
  GridIcon,
  HeadphonesIcon,
  MoonIcon,
  RefreshIcon,
  SparkleIcon,
  TornadoIcon,
  VoidIcon,
} from "@/components/site/icons";
import { hexToRgb, useCanvas, useFrame } from "./canvas-hooks";
import { usePlayer, type FxMode } from "./player-provider";

/* ------------------------------------------------------------------ */
/* Full-screen beat flash (cheap CSS animation, no canvas)             */
/* ------------------------------------------------------------------ */
export function BeatFlash() {
  const flashRef = useRef<HTMLDivElement | null>(null);
  const lastBeat = useRef(0);

  useFrame((levels) => {
    if (levels.beat === lastBeat.current) return;
    lastBeat.current = levels.beat;
    const el = flashRef.current;
    if (!el) return;
    el.removeAttribute("data-beat");
    void el.offsetWidth;
    el.style.setProperty("--beat-strength", String(levels.beatStrength));
    el.setAttribute("data-beat", "on");
  });

  return <div ref={flashRef} className="beat-flash" aria-hidden />;
}

/* ------------------------------------------------------------------ */
/* Frosted rail panels (static CSS — no blur, no per-frame cost)       */
/* ------------------------------------------------------------------ */
export function RailPanels() {
  return (
    <>
      {([-1, 1] as const).map((side) => (
        <div
          key={side}
          aria-hidden
          className={`pointer-events-none fixed inset-y-0 z-[17] w-[28px] sm:w-[44px] lg:w-[60px] xl:w-[84px] ${
            side === -1 ? "left-0 border-r" : "right-0 border-l"
          }`}
          style={{
            transformOrigin: side === -1 ? "left center" : "right center",
            transform: "scaleX(calc(1 + var(--audio-kick, 0) * 0.4))",
            borderColor: "color-mix(in oklab, var(--tier, var(--accent)) 35%, transparent)",
            background:
              side === -1
                ? "linear-gradient(90deg, rgba(5,9,13,0.92), rgba(5,9,13,0.3))"
                : "linear-gradient(270deg, rgba(5,9,13,0.92), rgba(5,9,13,0.3))",
            boxShadow:
              side === -1
                ? "inset -18px 0 36px -26px var(--tier, var(--accent))"
                : "inset 18px 0 36px -26px var(--tier, var(--accent))",
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Radial spectrum around the hero logo                                */
/* ------------------------------------------------------------------ */
export function CircularVisualizer({ className = "" }: { className?: string }) {
  const rotation = useRef(0);
  const rings = useRef<Array<{ t: number; strength: number; c: RGB }>>([]);
  const lastBeat = useRef(0);
  type RGB = [number, number, number];

  const canvasRef = useCanvas((ctx, levels, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const base = Math.min(w, h) * 0.3 * (1 + levels.kick * 0.04);
    const [r, g, b] = heatRgb(levels.heat);
    const { r: ar, g: ag, b: ab } = hexToRgb(levels.accent);
    rotation.current += 0.002 + levels.energy * 0.014 + levels.heat * 0.01;

    if (levels.beat !== lastBeat.current) {
      lastBeat.current = levels.beat;
      if (rings.current.length < 6) rings.current.push({ t: 0, strength: levels.beatStrength, c: [r, g, b] });
    }
    rings.current = rings.current.filter((ring) => ring.t < 1);
    for (const ring of rings.current) {
      ring.t += 0.024;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${ring.c[0]},${ring.c[1]},${ring.c[2]},${((1 - ring.t) * 0.6 * ring.strength).toFixed(3)})`;
      ctx.lineWidth = 3 * (1 - ring.t) + 0.5;
      ctx.arc(cx, cy, base * (1.06 + ring.t * 1.05), 0, Math.PI * 2);
      ctx.stroke();
    }

    // One flat stroke colour instead of 128 gradients per frame.
    const bars = 96;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation.current);
    ctx.lineCap = "round";
    for (let i = 0; i < bars; i += 1) {
      const idx = Math.round(Math.pow(i / bars, 1.35) * 230) + 2;
      const v = levels.freq[idx] / 255;
      const angle = (i / bars) * Math.PI * 2;
      const len = 6 + v * Math.min(w, h) * (0.16 + levels.heat * 0.14) * (1 + levels.kick * 0.4);
      const x1 = Math.cos(angle) * (base + 6);
      const y1 = Math.sin(angle) * (base + 6);
      const x2 = Math.cos(angle) * (base + 6 + len);
      const y2 = Math.sin(angle) * (base + 6 + len);
      ctx.strokeStyle = `rgba(${r},${g},${b},${(0.35 + v * 0.65).toFixed(3)})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    const halo = ctx.createRadialGradient(cx, cy, base * 0.6, cx, cy, base * (1.6 + levels.bass + levels.kick * 0.5));
    halo.addColorStop(0, `rgba(${r},${g},${b},${(0.16 + levels.energy * 0.22).toFixed(3)})`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
  });

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}

/* ------------------------------------------------------------------ */
/* Mirrored spectrum + oscilloscope (one gradient per frame)           */
/* ------------------------------------------------------------------ */
export function SpectrumStage({ className = "" }: { className?: string }) {
  const canvasRef = useCanvas((ctx, levels, w, h) => {
    const [r, g, b] = heatRgb(levels.heat);
    const { r: ar, g: ag, b: ab } = hexToRgb(levels.accent);
    const bars = Math.max(28, Math.floor(w / 14));
    const gap = 3;
    const bw = (w - gap * (bars - 1)) / bars;
    const mid = h * 0.62;

    const grad = ctx.createLinearGradient(0, 0, 0, mid);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.6, `rgba(${ar},${ag},${ab},0.6)`);
    grad.addColorStop(1, "rgba(124,92,255,0.3)");

    for (let i = 0; i < bars; i += 1) {
      const idx = Math.round(Math.pow(i / bars, 1.3) * 250) + 1;
      const v = levels.freq[idx] / 255;
      const bh = Math.max(2, v * mid * 0.98);
      const x = i * (bw + gap);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, mid - bh, bw, bh, bw / 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = grad;
    for (let i = 0; i < bars; i += 1) {
      const idx = Math.round(Math.pow(i / bars, 1.3) * 250) + 1;
      const v = levels.freq[idx] / 255;
      const bh = Math.max(2, v * mid * 0.4);
      ctx.beginPath();
      ctx.roundRect(i * (bw + gap), mid + 3, bw, bh, bw / 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = `rgba(${r},${g},${b},0.7)`;
    const stepWave = Math.max(1, Math.floor(levels.bins / 220));
    for (let i = 0; i < levels.bins; i += stepWave) {
      const x = (i / (levels.bins - 1)) * w;
      const y = mid - ((levels.wave[i] - 128) / 128) * (h * 0.18);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}

/* ------------------------------------------------------------------ */
/* Live 9-tier intensity ladder                                        */
/* ------------------------------------------------------------------ */
const TIER_ICONS: Record<TierKey, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  CALM: MoonIcon,
  GROOVE: HeadphonesIcon,
  HYPE: BoltIcon,
  BLAZE: FlameIcon,
  DANGER: AlertIcon,
  INFERNO: CometIcon,
  ULTRA: SparkleIcon,
  HYPERSPACE: GalaxyIcon,
  SINGULARITY: VoidIcon,
};

export function TierMeter({ compact = false }: { compact?: boolean }) {
  const segRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const pctRef = useRef<HTMLSpanElement | null>(null);
  const lastTier = useRef(-1);
  const [tier, setTier] = useState<TierKey>(TIERS[0].key);

  useFrame((levels) => {
    const heatPos = levels.heat * TIERS.length;
    for (let i = 0; i < TIERS.length; i += 1) {
      const el = segRefs.current[i];
      if (!el) continue;
      const fill = Math.max(0, Math.min(1, heatPos - i));
      el.style.opacity = String(0.18 + fill * 0.82);
      el.style.transform = `scaleY(${(0.45 + fill * 0.55 + (i === levels.tierIndex ? levels.kick * 0.4 : 0)).toFixed(2)})`;
      el.style.boxShadow = fill > 0.5 ? `0 0 ${8 + fill * 10}px ${TIERS[i].color}` : "none";
    }
    if (pctRef.current) pctRef.current.textContent = `${Math.round(levels.heat * 100)}%`;
    if (lastTier.current !== levels.tierIndex) {
      lastTier.current = levels.tierIndex;
      const t = TIERS[levels.tierIndex];
      if (labelRef.current) {
        labelRef.current.textContent = t.label;
        labelRef.current.style.color = t.color;
        labelRef.current.style.textShadow = `0 0 14px ${t.color}`;
      }
      setTier(t.key);
    }
  });

  const TierIcon = TIER_ICONS[tier];

  return (
    <div className="flex items-center gap-2.5" title="Intensity: the louder & denser the song, the higher the colour climbs">
      <div className="flex h-5 items-end gap-[3px]">
        {TIERS.map((t, i) => (
          <span
            key={t.key}
            ref={(el) => {
              segRefs.current[i] = el;
            }}
            className={`block origin-bottom rounded-sm ${compact ? "h-4 w-1.5" : "h-5 w-2"}`}
            style={{ background: t.color, opacity: 0.18, transition: "transform 80ms linear, opacity 120ms linear" }}
          />
        ))}
      </div>
      <span
        className="inline-flex items-center gap-1.5"
        style={{ color: TIERS.find((t) => t.key === tier)?.color }}
      >
        <TierIcon width={compact ? 13 : 14} height={compact ? 13 : 14} />
        <span
          ref={labelRef}
          className={`font-display text-[11px] font-bold tracking-[0.14em] uppercase ${compact ? "hidden sm:inline" : ""}`}
          style={{ color: TIERS[0].color, minWidth: compact ? undefined : 82 }}
        >
          {TIERS[0].label}
        </span>
      </span>
      {!compact ? (
        <span ref={pctRef} className="w-9 font-mono text-[11px] text-mist-400">
          0%
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quality control — Auto keeps animations, just lighter on weak PCs   */
/* ------------------------------------------------------------------ */
export function QualityControl() {
  const [choice, setChoice] = useState<QualityChoice>("auto");
  const [fps, setFps] = useState(60);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial value lives outside React
    setChoice(perf().selected);
    return perf().subscribe((p) => {
      setChoice(p.auto ? "auto" : p.quality);
      setFps(p.fps);
    });
  }, []);

  const options: Array<{ key: QualityChoice; label: string }> = [
    { key: "auto", label: "Auto" },
    { key: "high", label: "High" },
    { key: "medium", label: "Balanced" },
    { key: "low", label: "Smooth" },
  ];

  return (
    <div className="flex items-center gap-2" title="Same animations — Auto makes them lighter automatically if your PC struggles">
      <span className="hidden text-[10px] font-bold tracking-[0.2em] text-mist-500 uppercase lg:inline">Performance</span>
      <div className="flex overflow-hidden rounded-full border border-white/10">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => perf().setChoice(o.key)}
            aria-pressed={choice === o.key}
            className={`px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition ${
              choice === o.key ? "bg-veil-400/25 text-veil-200" : "text-mist-500 hover:text-mist-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="hidden font-mono text-[10px] text-mist-500 sm:inline">{fps}fps</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FX mode selector                                                    */
/* ------------------------------------------------------------------ */
export function FxControlBar() {
  const { fxMode, autoMorph, setFxMode, toggleAutoMorph } = usePlayer();

  const modes: Array<{ key: FxMode; label: string; icon: (props: SVGProps<SVGSVGElement>) => ReactElement }> = [
    { key: "CYBER", label: "Cyber Laser", icon: BoltIcon },
    { key: "DANGER", label: "Danger Storm", icon: AlertIcon },
    { key: "COSMIC", label: "Cosmic Tornado", icon: TornadoIcon },
    { key: "MATRIX", label: "Matrix Glitch", icon: GridIcon },
  ];

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="mr-1 text-[10px] font-bold tracking-[0.24em] text-mist-500 uppercase">Effects</span>
        {modes.map((m) => {
          const active = fxMode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setFxMode(m.key)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wider transition ${
                active
                  ? "border border-veil-400/80 bg-veil-400/20 text-veil-200 shadow-[0_0_18px_rgba(53,224,255,0.4)]"
                  : "border border-white/8 bg-white/4 text-mist-400 hover:border-white/20 hover:text-mist-200"
              }`}
            >
              <m.icon width={14} height={14} className="shrink-0" />
              <span className="hidden sm:inline">{m.label}</span>
              <span className="sm:hidden">{m.key}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={toggleAutoMorph}
          aria-pressed={autoMorph}
          title="Changes the effect style on its own every 24 seconds"
          className={`ml-1 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] tracking-widest uppercase transition ${
            autoMorph
              ? "border border-pulse-500/60 bg-pulse-500/20 text-pulse-500"
              : "border border-white/8 text-mist-500 hover:text-mist-300"
          }`}
        >
          <RefreshIcon width={12} height={12} />
          <span className="hidden md:inline">Auto {autoMorph ? "on" : "off"}</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TierMeter />
        <QualityControl />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini 4-bar equaliser badge                                          */
/* ------------------------------------------------------------------ */
export function MiniEq({ active, className = "" }: { active: boolean; className?: string }) {
  const refs = useRef<Array<HTMLSpanElement | null>>([]);
  useFrame((levels) => {
    if (!active) return;
    for (let i = 0; i < 4; i += 1) {
      const v = levels.freq[4 + i * 22] / 255;
      const el = refs.current[i];
      if (el) el.style.transform = `scaleY(${(0.18 + v * 0.95).toFixed(2)})`;
    }
  });

  return (
    <span className={`flex h-4 items-end gap-[2px] ${className}`} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="block h-4 w-[3px] origin-bottom rounded-full"
          style={{
            background: "var(--tier, var(--accent))",
            boxShadow: "0 0 10px var(--tier, var(--accent))",
            transform: "scaleY(0.2)",
            transition: "transform 90ms linear",
          }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Pointer spotlight + neon scroll progress (CSS-only, cheap)          */
/* ------------------------------------------------------------------ */
export function AmbientLayer() {
  const glowRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: 0.5, y: 0.35 });
  const pos = useRef({ x: 0.5, y: 0.35 });
  const dirty = useRef(false);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      target.current = { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight };
      dirty.current = true;
    };
    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${ratio.toFixed(4)})`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Spotlight follows the pointer at 10fps — visually identical, ~85% cheaper.
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = glowRef.current;
      if (!el || !dirty.current) return;
      dirty.current = false;
      pos.current.x += (target.current.x - pos.current.x) * 0.5;
      pos.current.y += (target.current.y - pos.current.y) * 0.5;
      el.style.background = `radial-gradient(34vmax 26vmax at ${(pos.current.x * 100).toFixed(1)}% ${(pos.current.y * 100).toFixed(1)}%, color-mix(in oklab, var(--tier, var(--accent)) 12%, transparent), transparent 70%)`;
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <div ref={glowRef} aria-hidden className="pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px]">
        <div
          ref={barRef}
          className="h-full w-full origin-left scale-x-0"
          style={{
            background: "linear-gradient(90deg, var(--tier, var(--accent)), #7c5cff 60%, transparent)",
            boxShadow: "0 0 14px var(--tier, var(--accent))",
          }}
        />
      </div>
    </>
  );
}
