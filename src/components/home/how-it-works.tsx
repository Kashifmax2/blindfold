"use client";

import Link from "next/link";
import { Reveal } from "@/components/site/ui";

const STEPS = [
  {
    icon: "🎵",
    title: "Pick a song",
    body: "Tap any card in the library, or press the big play button. Space bar also plays and pauses.",
  },
  {
    icon: "👑",
    title: "Add your own",
    body: "Use “Upload your song” to pick a track from your PC. It stays on your computer and comes back next time.",
  },
  {
    icon: "⚡",
    title: "Watch it react",
    body: "Lights, lightning and colours follow the beat. Loud parts climb the colour ladder automatically.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative z-10 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="glass rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold tracking-[0.3em] text-veil-300 uppercase">
                  How it works
                </span>
                <h2 className="mt-2 font-display text-[clamp(1.4rem,3.4vw,2rem)] font-bold text-mist-100">
                  Three steps. That&apos;s it.
                </h2>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-mist-400">
                Tip: press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Space</kbd> to
                play/pause, <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">V</kbd> to change the
                effect style, <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">M</kbd> to mute.
              </p>
            </div>

            <ol className="mt-7 grid gap-4 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-2xl border border-white/8 bg-ink-950/60 p-5">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: "linear-gradient(140deg,#eafbff,var(--tier,#35e0ff))" }}
                    >
                      {step.icon}
                    </span>
                    <span className="font-mono text-[11px] text-mist-500">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-mist-100">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist-400">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-white/8 bg-ink-900/50 px-5 py-4">
              <span className="text-[10px] font-bold tracking-[0.22em] text-mist-500 uppercase">
                Colour ladder
              </span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-mist-400">
                {[
                  ["#35e0ff", "Calm"],
                  ["#3dffb8", "Groove"],
                  ["#b8ff3d", "Hype"],
                  ["#ffb02e", "Blaze"],
                  ["#ff3b3b", "Danger"],
                  ["#ff2fb0", "Inferno"],
                  ["#a03dff", "Ultraviolet"],
                  ["#3d5cff", "Hyperspace"],
                  ["#f1ecff", "Singularity"],
                ].map(([color, label]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: color, boxShadow: `0 0 10px ${color}` }}
                    />
                    {label}
                  </span>
                ))}
              </div>
              <Link
                href="#vault"
                className="ml-auto rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-[11px] font-bold tracking-[0.16em] text-amber-200 uppercase transition hover:bg-amber-300/20"
              >
                Upload a song →
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
