"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPlays } from "@/lib/format";
import { usePlayer } from "@/components/player/player-provider";
import { CircularVisualizer, MiniEq } from "@/components/player/visuals";
import { ArrowIcon, CrownIcon, PauseIcon, PlayIcon, SparkleIcon } from "@/components/site/icons";
import { Reveal, SectionLabel } from "@/components/site/ui";

type Stats = { tracks: number; plays: number; minutes: number; artists: number };

export function Hero({ stats }: { stats: Stats }) {
  const { queue, current, isPlaying, playSong, toggle } = usePlayer();
  const hero = current ?? queue[0] ?? null;

  const onPlay = () => {
    if (!hero) return;
    if (current && current.id === hero.id) toggle();
    else playSong(hero);
  };

  const figures = [
    { value: `${stats.tracks}`, label: "Tracks live" },
    { value: formatPlays(stats.plays), label: "Total spins" },
    { value: `${Math.max(1, Math.round(stats.minutes))}`, label: "Minutes" },
    { value: `${stats.artists}`, label: "Artists" },
  ];

  return (
    <section className="relative z-10 pt-28 pb-10 sm:pt-32 lg:pt-40">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-6">
          <Reveal>
            <SectionLabel>Audio reactive player</SectionLabel>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mt-6 font-display text-[clamp(2.6rem,7.2vw,4.6rem)] leading-[0.95] font-bold tracking-[-0.03em] text-mist-200 uppercase">
              Feel the sound
              <span className="mt-1 block">
                <span
                  className="neon-text bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(100deg, var(--accent) 0%, #c9f6ff 45%, #7c5cff 100%)",
                  }}
                >
                  eyes closed
                </span>
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-mist-400">
              A blindfolded listening room. Every beat bends the light: rails pump, lightning
              cracks, tornadoes spin up, and the colour climbs from calm cyan through red,
              ultraviolet and hyperspace to white-hot singularity. Upload your own song and let
              the room react.
            </p>
          </Reveal>

          <Reveal delay={230}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onPlay}
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full px-6 py-3.5 font-display text-sm font-semibold tracking-[0.14em] text-ink-950 uppercase transition hover:scale-[1.03] active:scale-95"
                style={{
                  background: "linear-gradient(120deg, #eafbff, var(--accent) 65%, #7c5cff 140%)",
                  boxShadow: "0 16px 45px -18px color-mix(in oklab, var(--accent) 90%, transparent)",
                }}
              >
                <span className="relative z-10 flex items-center gap-3">
                  {isPlaying ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
                  {isPlaying ? "Pause the mix" : "Play the mix"}
                </span>
                <span className="absolute inset-0 -translate-x-full bg-white/40 transition-transform duration-700 group-hover:translate-x-full" />
              </button>

              <Link
                href="#vault"
                className="group inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-300/10 px-6 py-3.5 font-display text-sm font-semibold tracking-[0.14em] text-amber-200 uppercase transition hover:border-amber-300 hover:bg-amber-300/20"
              >
                <CrownIcon width={16} height={16} className="transition group-hover:scale-110" />
                Upload your song
              </Link>

              <Link
                href="#library"
                className="group inline-flex items-center gap-2 rounded-full border border-white/12 px-6 py-3.5 font-display text-sm font-semibold tracking-[0.14em] text-mist-300 uppercase transition hover:border-veil-400/60 hover:bg-white/5 hover:text-veil-200"
              >
                Browse library
                <ArrowIcon
                  width={16}
                  height={16}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <dl className="mt-11 grid max-w-lg grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5 sm:grid-cols-4">
              {figures.map((f) => (
                <div key={f.label} className="bg-ink-900/70 px-4 py-4 backdrop-blur-sm">
                  <dt className="font-display text-2xl font-bold text-mist-200">{f.value}</dt>
                  <dd className="mt-1 text-[10px] tracking-[0.22em] text-mist-500 uppercase">
                    {f.label}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        {/* Reactive logo disc */}
        <div className="lg:col-span-6">
          <Reveal delay={140} className="relative mx-auto w-full max-w-[540px]">
            <div className="relative aspect-square w-full">
              <CircularVisualizer className="absolute inset-0 h-full w-full" />

              {/* orbit rings */}
              <div className="absolute inset-[14%] animate-spin-slow rounded-full border border-dashed border-veil-400/20" />
              <div className="absolute inset-[7%] animate-spin-reverse rounded-full border border-veil-400/10">
                <span
                  className="absolute top-1/2 -left-1 h-2 w-2 rounded-full bg-veil-300"
                  style={{ boxShadow: "0 0 16px var(--color-veil-300)" }}
                />
                <span
                  className="absolute top-1/2 -right-1 h-1.5 w-1.5 rounded-full bg-pulse-500"
                  style={{ boxShadow: "0 0 14px var(--color-pulse-500)" }}
                />
              </div>

              {/* pulse rings */}
              <span className="pointer-events-none absolute inset-[28%] animate-ring rounded-full border border-veil-400/35" />
              <span
                className="pointer-events-none absolute inset-[28%] animate-ring rounded-full border border-veil-400/25"
                style={{ animationDelay: "1.1s" }}
              />

              {/* the mark */}
              <button
                type="button"
                onClick={onPlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="group absolute inset-[26%] cursor-pointer rounded-full"
              >
                <span
                  className="absolute -inset-6 rounded-full blur-2xl transition duration-500"
                  style={{
                    background: "var(--accent)",
                    opacity: "calc(0.18 + var(--audio-bass) * 0.7)",
                  }}
                />
                <span
                  className="absolute inset-0 block rounded-full"
                  style={{
                    transform: "scale(calc(1 + var(--audio-bass) * 0.06))",
                    transition: "transform 110ms linear",
                  }}
                >
                  <Image
                    src="/brand/logo.png"
                    alt="Blindfolded listener mark"
                    fill
                    priority
                    sizes="(max-width: 1024px) 60vw, 320px"
                    className={`rounded-full object-cover ring-1 ring-veil-400/35 transition duration-700 group-hover:ring-veil-400/80 ${
                      isPlaying ? "animate-spin-slow" : ""
                    }`}
                  />
                </span>
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink-950/55 opacity-0 backdrop-blur-[2px] transition duration-300 group-hover:opacity-100">
                  <span
                    className="flex h-16 w-16 items-center justify-center rounded-full text-ink-950"
                    style={{
                      background: "linear-gradient(140deg, #eafbff, var(--accent))",
                      boxShadow: "0 0 40px color-mix(in oklab, var(--accent) 70%, transparent)",
                    }}
                  >
                    {isPlaying ? <PauseIcon width={22} height={22} /> : <PlayIcon width={22} height={22} />}
                  </span>
                </span>
              </button>

              {/* floating now-playing chip */}
              {hero ? (
                <div className="glass absolute bottom-[4%] left-1/2 flex w-[min(300px,86%)] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 animate-float">
                  <MiniEq active={isPlaying} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-mist-200">
                      {hero.title}
                    </p>
                    <p className="truncate text-[11px] tracking-[0.14em] text-mist-500 uppercase">
                      {isPlaying ? "Now playing" : "Ready"} · {hero.artist}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Marquee() {
  const { queue } = usePlayer();
  const items = queue.length
    ? queue.map((s) => `${s.title} — ${s.artist}`)
    : ["Upload your first track"];
  const loop = [...items, ...items, ...items, ...items].slice(0, 24);

  return (
    <div className="relative z-10 my-6 overflow-hidden border-y border-white/8 bg-ink-900/50 py-3 backdrop-blur-sm">
      <div className="flex w-max animate-marquee gap-10 pr-10">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0 items-center gap-10">
            {loop.map((label, i) => (
              <span
                key={`${dup}-${i}`}
                className="flex items-center gap-10 font-display text-xs tracking-[0.34em] whitespace-nowrap text-mist-500 uppercase"
              >
                {label}
                <SparkleIcon width={11} height={11} className="text-veil-400/70" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
