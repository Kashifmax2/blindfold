"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPlays, formatTime } from "@/lib/format";
import { usePlayer } from "@/components/player/player-provider";
import { MiniEq } from "@/components/player/visuals";
import { PauseIcon, PlayIcon, SearchIcon, StarIcon, UploadIcon } from "@/components/site/icons";
import { CoverArt, Reveal, SectionLabel } from "@/components/site/ui";

export function Library() {
  const { serverSongs: queue, current, isPlaying, playSong } = usePlayer();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const genres = useMemo(
    () => ["All", ...Array.from(new Set(queue.map((s) => s.genre)))],
    [queue],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return queue.filter((song) => {
      const matchesGenre = filter === "All" || song.genre === filter;
      const matchesQuery =
        !q ||
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        song.mood.toLowerCase().includes(q);
      return matchesGenre && matchesQuery;
    });
  }, [queue, filter, query]);

  return (
    <section id="library" className="relative z-10 scroll-mt-28 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <SectionLabel>The library</SectionLabel>
            <h2 className="mt-4 font-display text-[clamp(1.9rem,4.4vw,2.9rem)] leading-tight font-bold tracking-[-0.02em] text-mist-200">
              The cloud library.
              <span className="text-mist-500"> Pick a frequency, the room follows.</span>
            </h2>
          </Reveal>

          <Reveal delay={80} className="flex w-full max-w-sm items-center gap-2 md:w-auto">
            <label className="glass flex flex-1 items-center gap-2 rounded-full px-4 py-2.5 transition focus-within:border-veil-400/60">
              <SearchIcon width={16} height={16} className="text-mist-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tracks, artists, moods"
                className="w-full bg-transparent text-sm text-mist-200 placeholder:text-mist-500 focus:outline-none"
              />
            </label>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="mt-7 flex flex-wrap gap-2">
            {genres.map((genre) => {
              const active = genre === filter;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setFilter(genre)}
                  className={`rounded-full border px-4 py-2 text-xs tracking-[0.16em] uppercase transition ${
                    active
                      ? "border-veil-400/70 bg-veil-400/15 text-veil-200"
                      : "border-white/10 text-mist-500 hover:border-veil-400/40 hover:text-mist-300"
                  }`}
                  style={active ? { boxShadow: "0 0 26px -10px var(--accent)" } : undefined}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((song, index) => {
            const active = current?.id === song.id;
            const playing = active && isPlaying;
            return (
              <Reveal as="article" key={song.id} delay={index * 60} className="min-w-0">
                <div
                  className="group glass relative h-full overflow-hidden rounded-3xl p-3 transition duration-500 hover:-translate-y-1.5"
                  style={{
                    borderColor: active ? `${song.accent}80` : undefined,
                    boxShadow: active
                      ? `0 0 0 1px ${song.accent}55, 0 26px 60px -34px ${song.accent}`
                      : undefined,
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(120% 90% at 50% 0%, ${song.accent}26, transparent 62%)`,
                    }}
                  />

                  <div className="relative">
                    <CoverArt
                      title={song.title}
                      accent={song.accent}
                      spinning={playing}
                      className="aspect-square w-full"
                    />
                    <button
                      type="button"
                      onClick={() => playSong(song)}
                      aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
                      className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink-950/40 opacity-0 backdrop-blur-[1px] transition duration-300 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <span
                        className="flex h-14 w-14 scale-75 items-center justify-center rounded-full text-ink-950 transition duration-300 group-hover:scale-100"
                        style={{
                          background: `linear-gradient(140deg, #eafbff, ${song.accent})`,
                          boxShadow: `0 0 38px ${song.accent}99`,
                        }}
                      >
                        {playing ? <PauseIcon width={20} height={20} /> : <PlayIcon width={20} height={20} />}
                      </span>
                    </button>

                    {song.featured ? (
                      <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-ink-950/70 px-2.5 py-1 text-[10px] tracking-[0.2em] text-veil-200 uppercase backdrop-blur">
                        <StarIcon width={11} height={11} /> Featured
                      </span>
                    ) : null}

                    <span className="absolute right-3 bottom-3 rounded-full bg-ink-950/75 px-2.5 py-1 font-mono text-[11px] text-mist-300 backdrop-blur">
                      {formatTime(song.duration)}
                    </span>
                  </div>

                  <div className="relative flex items-start justify-between gap-3 px-2 pt-4 pb-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-semibold text-mist-200 transition group-hover:text-white">
                        {song.title}
                      </h3>
                      <p className="mt-1 truncate text-xs text-mist-500">
                        {song.artist} · {song.mood}
                      </p>
                      <p className="mt-2.5 text-[10px] tracking-[0.2em] text-mist-500 uppercase">
                        {formatPlays(song.plays)} spins
                      </p>
                    </div>
                    {active ? (
                      <MiniEq active={playing} className="mt-1" />
                    ) : (
                      <span
                        className="mt-1 h-2 w-2 rounded-full bg-white/15 transition group-hover:bg-veil-400"
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}

          {visible.length === 0 ? (
            <div className="glass col-span-full flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
              <UploadIcon width={28} height={28} className="text-veil-300" />
              <p className="font-display text-lg text-mist-200">Nothing matches that search.</p>
              <p className="max-w-sm text-sm text-mist-500">
                Clear the filters, or head to the admin console and drop a new track into the
                rotation.
              </p>
              <Link
                href="/admin"
                className="rounded-full border border-veil-400/40 px-5 py-2.5 text-xs tracking-[0.2em] text-veil-200 uppercase transition hover:bg-veil-400/15"
              >
                Open console
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
