"use client";

import { formatTime } from "@/lib/format";
import { CoverArt } from "@/components/site/ui";
import {
  MuteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
} from "@/components/site/icons";
import { usePlayer } from "./player-provider";
import { MiniEq, SpectrumStage, TierMeter } from "./visuals";

export function NowPlayingDock() {
  const {
    current,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    fxMode,
    cycleFxMode,
    toggle,
    next,
    prev,
    seek,
    changeVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  if (!current) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-2 sm:px-4 sm:pb-4 xl:px-[96px]">
      <div
        className="pointer-events-auto mx-auto flex max-w-6xl flex-col gap-2.5 rounded-2xl border border-veil-400/25 bg-ink-950/95 px-3 py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:gap-3 sm:px-5 sm:py-3.5"
        style={{
          boxShadow: "0 -12px 50px -20px color-mix(in oklab, var(--tier) 55%, transparent), 0 30px 80px -40px #000",
        }}
      >
        <div className="flex items-center justify-between gap-3 sm:gap-5">
          {/* Track Info */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative shrink-0">
              <CoverArt
                title={current.title}
                accent={current.accent}
                spinning={isPlaying}
                rounded="rounded-full"
                className="h-11 w-11 sm:h-13 sm:w-13"
              />
              <span
                className="pointer-events-none absolute inset-0 rounded-full border"
                style={{
                  borderColor: `${current.accent}55`,
                  boxShadow: isPlaying
                    ? `0 0 22px color-mix(in oklab, ${current.accent} 65%, transparent)`
                    : "none",
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold text-mist-100 sm:text-base">
                {current.title}
              </p>
              <p className="truncate text-[11px] text-mist-400 sm:text-xs">
                {current.local ? <span className="mr-1 rounded bg-amber-400/15 px-1 text-[9px] font-bold tracking-wider text-amber-300">MY VAULT</span> : null}
                {current.artist} · <span className="text-veil-400">{current.genre}</span>
              </p>
            </div>
            <MiniEq active={isPlaying} className="ml-1 hidden md:flex" />
          </div>

          {/* Transport Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={toggleShuffle}
              aria-pressed={shuffle}
              aria-label="Shuffle"
              className={`hidden h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 sm:flex ${
                shuffle ? "text-veil-300" : "text-mist-500"
              }`}
            >
              <ShuffleIcon width={16} height={16} />
            </button>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous track"
              className="flex h-8 w-8 items-center justify-center rounded-full text-mist-400 transition hover:scale-110 hover:bg-white/10 hover:text-mist-200"
            >
              <PrevIcon width={17} height={17} />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="group relative flex h-11 w-11 items-center justify-center rounded-full text-ink-950 transition hover:scale-105 active:scale-95 sm:h-12 sm:w-12"
              style={{
                background: `linear-gradient(145deg, #eafbff, ${current.accent})`,
                boxShadow: `0 0 0 1px ${current.accent}55, 0 8px 30px -8px ${current.accent}`,
              }}
            >
              {isPlaying ? <PauseIcon width={19} height={19} /> : <PlayIcon width={19} height={19} />}
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next track"
              className="flex h-8 w-8 items-center justify-center rounded-full text-mist-400 transition hover:scale-110 hover:bg-white/10 hover:text-mist-200"
            >
              <NextIcon width={17} height={17} />
            </button>
            <button
              type="button"
              onClick={toggleRepeat}
              aria-pressed={repeat}
              aria-label="Repeat"
              className={`hidden h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 sm:flex ${
                repeat ? "text-veil-300" : "text-mist-500"
              }`}
            >
              <RepeatIcon width={16} height={16} />
            </button>
          </div>

          {/* Quick FX Mode Button + Volume */}
          <div className="hidden flex-1 items-center justify-end gap-3 lg:flex">
            <button
              type="button"
              onClick={cycleFxMode}
              title="Click to cycle Visualizer FX Mode"
              className="flex items-center gap-1.5 rounded-full border border-veil-400/25 bg-veil-400/10 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-veil-200 transition hover:border-veil-400/60 hover:bg-veil-400/20"
            >
              <span>{fxMode === "CYBER" ? "⚡" : fxMode === "DANGER" ? "⚠️" : fxMode === "COSMIC" ? "🌌" : "🎛️"}</span>
              <span>{fxMode}</span>
            </button>

            <TierMeter compact />

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="text-mist-400 transition hover:text-veil-300"
            >
              {muted || volume === 0 ? <MuteIcon width={17} height={17} /> : <VolumeIcon width={17} height={17} />}
            </button>
            <input
              className="slider w-24"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              style={{ ["--progress" as string]: `${(muted ? 0 : volume) * 100}%` }}
            />
          </div>
        </div>

        {/* Seek Bar */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="w-9 shrink-0 text-right font-mono text-[10px] text-mist-500 sm:text-[11px]">
            {formatTime(currentTime)}
          </span>
          <input
            className="slider h-3 flex-1"
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={Math.min(currentTime, duration || 1)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            style={{ ["--progress" as string]: `${progress}%` }}
          />
          <span className="w-9 shrink-0 font-mono text-[10px] text-mist-500 sm:text-[11px]">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
