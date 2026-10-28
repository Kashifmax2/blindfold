"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "@/components/player/player-provider";
import { FxControlBar, SpectrumStage } from "@/components/player/visuals";
import { BoltIcon, WaveIcon } from "@/components/site/icons";
import { Reveal, SectionLabel } from "@/components/site/ui";

const BANDS = [
  { key: "subBass", label: "Sub 20-80Hz" },
  { key: "bass", label: "Punch 80-250Hz" },
  { key: "mid", label: "Mids 250-2.5kHz" },
  { key: "treble", label: "Air 2.5-16kHz" },
] as const;

function LevelMeters() {
  const { onFrame } = usePlayer();
  const fills = useRef<Record<string, HTMLSpanElement | null>>({});
  const vals = useRef<Record<string, HTMLSpanElement | null>>({});
  const beatDot = useRef<HTMLSpanElement | null>(null);
  const lastBeat = useRef(0);

  useEffect(
    () =>
      onFrame((levels) => {
        BANDS.forEach((band) => {
          const el = fills.current[band.key];
          const valEl = vals.current[band.key];
          const val = levels[band.key as keyof typeof levels] as number;
          if (el) el.style.width = `${Math.min(100, val * 125).toFixed(1)}%`;
          if (valEl) valEl.innerText = `${Math.round(val * 100)}%`;
        });

        if (levels.beat !== lastBeat.current) {
          lastBeat.current = levels.beat;
          const dot = beatDot.current;
          if (dot) {
            dot.style.transform = "scale(2)";
            dot.style.opacity = "1";
            window.setTimeout(() => {
              dot.style.transform = "scale(1)";
              dot.style.opacity = "0.35";
            }, 120);
          }
        }
      }),
    [onFrame],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {BANDS.map((band) => (
        <div key={band.key} className="rounded-2xl border border-white/10 bg-ink-950/70 p-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.22em] text-mist-400 uppercase">
              {band.label}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                ref={(el) => {
                  vals.current[band.key] = el;
                }}
                className="font-mono text-[10px] text-veil-300"
              >
                0%
              </span>
              {band.key === "bass" ? (
                <span
                  ref={beatDot}
                  className="h-2 w-2 rounded-full opacity-35 transition-all duration-150"
                  style={{
                    background: "var(--accent)",
                    boxShadow: "0 0 16px var(--accent)",
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
            <span
              ref={(el) => {
                fills.current[band.key] = el;
              }}
              className="block h-full w-0 rounded-full"
              style={{
                background:
                  band.key === "subBass"
                    ? "linear-gradient(90deg, #ff4f78, #ffb547)"
                    : band.key === "bass"
                      ? "linear-gradient(90deg, var(--accent), #7c5cff)"
                      : "linear-gradient(90deg, #4dffc3, var(--accent))",
                transition: "width 80ms linear",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Stage() {
  const { current, isPlaying } = usePlayer();

  return (
    <section id="stage" className="relative z-10 scroll-mt-28 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <SectionLabel>Live Visualizer Stage</SectionLabel>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,4.4vw,2.9rem)] leading-tight font-bold tracking-tight text-mist-100">
            Every beat paints the entire room.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mist-400">
            Upload any song — loud bass, synthwave, ambient or acoustic. The live Web Audio engine
            analyses real-time transients, kicks and drops, adapting the visualizer intensity in
            real-time.
          </p>
        </Reveal>

        {/* Visualizer Mode Switcher */}
        <Reveal delay={80} className="mt-8">
          <FxControlBar />
        </Reveal>

        <Reveal delay={120} className="mt-6">
          <div className="glass-strong border border-veil-400/25 bg-ink-950/90 relative overflow-hidden rounded-3xl p-4 shadow-2xl backdrop-blur-2xl sm:p-6">
            <div
              className="pointer-events-none absolute inset-x-0 -top-24 h-48 blur-3xl"
              style={{
                background: "radial-gradient(60% 100% at 50% 100%, color-mix(in oklab, var(--tier) 40%, transparent), transparent)",
                opacity: "calc(0.3 + var(--audio-level) * 0.7)",
              }}
            />

            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-950 shadow-md"
                  style={{ background: "linear-gradient(140deg, #eafbff, var(--tier))" }}
                >
                  <WaveIcon width={17} height={17} />
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-mist-100">
                    {current ? current.title : "No Signal"}
                  </p>
                  <p className="text-[10px] font-bold tracking-[0.2em] text-mist-500 uppercase">
                    {isPlaying ? "Real-time FFT · 9-tier heat engine" : "Standby shimmer"}
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.24em] text-mist-400 uppercase">
                <BoltIcon width={13} height={13} className="text-veil-300" />
                Live Audio Reactive · 60fps
              </span>
            </div>

            <SpectrumStage className="relative mt-5 h-[200px] w-full sm:h-[260px]" />

            <div className="relative mt-5">
              <LevelMeters />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
