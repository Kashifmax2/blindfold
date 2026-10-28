"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { formatBytes, formatTime } from "@/lib/format";
import { VAULT_MAX_BYTES } from "@/lib/local-vault";
import { usePlayer } from "@/components/player/player-provider";
import { MiniEq } from "@/components/player/visuals";
import { PauseIcon, PlayIcon, TrashIcon, UploadIcon } from "@/components/site/icons";
import { CoverArt, Reveal, SectionLabel } from "@/components/site/ui";

const THEMES = [
  { color: "#35e0ff", name: "Neon Ice" },
  { color: "#a03dff", name: "Ultraviolet" },
  { color: "#ff2fb0", name: "Inferno Pink" },
  { color: "#3dffb8", name: "Toxic Mint" },
  { color: "#ffb02e", name: "Solar Gold" },
  { color: "#ff3b3b", name: "Red Alert" },
  { color: "#3d5cff", name: "Hyperspace" },
];

type Notice = { tone: "ok" | "err"; text: string } | null;

export function Vault() {
  const { localSongs, vaultReady, vaultError, addLocalSong, removeLocalSong, recolorLocalSong, playSong, current, isPlaying } =
    usePlayer();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [accent, setAccent] = useState(THEMES[0].color);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage is not
     available while server-rendering, so the saved defaults are restored once
     the component is mounted in the browser. */
  useEffect(() => {
    const saved = window.localStorage.getItem("blndfld:vaultArtist");
    if (saved) setArtist(saved);
    const theme = window.localStorage.getItem("blndfld:vaultTheme");
    if (theme && /^#[0-9a-f]{6}$/i.test(theme)) setAccent(theme);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const refreshUsage = useCallback(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage, localSongs.length]);

  const accept = (next: File | null) => {
    setNotice(null);
    setFile(null);
    setDuration(0);
    if (!next) return;
    const okType = next.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac|aac|webm|opus)$/i.test(next.name);
    if (!okType) {
      setNotice({ tone: "err", text: "That file isn't audio. Try MP3, WAV, OGG, M4A, FLAC or AAC." });
      return;
    }
    if (next.size > VAULT_MAX_BYTES) {
      setNotice({ tone: "err", text: "Song must be 200MB or smaller." });
      return;
    }
    setFile(next);
    if (!title) setTitle(next.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim());
    const url = URL.createObjectURL(next);
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setDuration(probe.duration);
      URL.revokeObjectURL(url);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setNotice({ tone: "err", text: "Your browser can't decode this file. Try converting it to MP3." });
    };
    probe.src = url;
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files?.[0] ?? null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setNotice({ tone: "err", text: "Choose a song from your computer first." });
      return;
    }
    if (!title.trim()) {
      setNotice({ tone: "err", text: "Give your song a title." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const song = await addLocalSong(file, {
        title: title.trim(),
        artist: artist.trim() || "Me",
        genre: "My Vault",
        mood: THEMES.find((t) => t.color === accent)?.name ?? "Custom",
        accent,
        duration,
      });
      window.localStorage.setItem("blndfld:vaultArtist", artist.trim());
      window.localStorage.setItem("blndfld:vaultTheme", accent);
      setNotice({ tone: "ok", text: `“${song.title}” saved to your computer — playing now.` });
      setFile(null);
      setTitle("");
      setDuration(0);
      if (fileInput.current) fileInput.current.value = "";
      playSong(song);
    } catch (error) {
      setNotice({
        tone: "err",
        text: error instanceof Error ? error.message : "Could not save the song. Your browser storage may be full.",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await removeLocalSong(id);
      setConfirmId(null);
    } catch {
      setNotice({ tone: "err", text: "Could not delete that song." });
    }
  };

  return (
    <section id="vault" className="relative z-10 scroll-mt-28 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-amber-300/25 p-[1px]">
            <div
              className="pointer-events-none absolute inset-0 animate-spin-slow opacity-60"
              style={{
                background:
                  "conic-gradient(from 0deg, #ffb02e, #ff2fb0, #a03dff, #3d5cff, #35e0ff, #3dffb8, #ffb02e)",
                filter: "blur(30px)",
              }}
            />
            <div className="relative grid gap-8 rounded-[2rem] bg-ink-950/92 p-6 backdrop-blur-2xl sm:p-8 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.3em] text-amber-200 uppercase">
                  👑 VIP Vault
                </span>
                <h2 className="mt-5 font-display text-[clamp(1.9rem,4.4vw,3rem)] leading-[1.02] font-bold tracking-tight text-mist-100">
                  Upload your song
                  <span
                    className="block bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(100deg,#ffb02e,#ff2fb0 40%,#a03dff 70%,#35e0ff)" }}
                  >
                    & enjoy more play.
                  </span>
                </h2>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mist-400">
                  Drop any track from your PC. It&apos;s saved privately on <b className="text-mist-200">your own computer</b>{" "}
                  (never uploaded to a server), keeps its title and colour theme, and is waiting for you every time you
                  come back, with the full storm of effects.
                </p>
                <ul className="mt-6 grid gap-2 text-sm text-mist-300">
                  <li>⚡ Live beat tracking: lightning, cracks, shockwaves, tornadoes</li>
                  <li>🎨 Your colour theme lights up the whole room</li>
                  <li>🔒 100% local, private and offline-ready</li>
                </ul>
                {usage && usage.quota > 0 ? (
                  <div className="mt-6 max-w-xs">
                    <div className="flex justify-between text-[10px] tracking-[0.2em] text-mist-500 uppercase">
                      <span>Local storage</span>
                      <span>
                        {formatBytes(usage.used)} / {formatBytes(usage.quota)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (usage.used / usage.quota) * 100).toFixed(1)}%`,
                          background: "linear-gradient(90deg,#ffb02e,#ff2fb0)",
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <form onSubmit={save} className="lg:col-span-7">
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition ${
                    dragging ? "border-amber-300 bg-amber-300/10" : "border-white/15 bg-ink-900/60 hover:border-amber-300/60"
                  }`}
                >
                  <input
                    ref={fileInput}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.webm,.opus"
                    className="hidden"
                    onChange={(e) => accept(e.target.files?.[0] ?? null)}
                  />
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full text-ink-950 transition group-hover:scale-110"
                    style={{ background: `linear-gradient(140deg,#fff7e0,${accent})`, boxShadow: `0 0 34px ${accent}88` }}
                  >
                    <UploadIcon width={22} height={22} />
                  </span>
                  {file ? (
                    <>
                      <span className="max-w-full truncate font-display text-sm font-bold text-mist-100">{file.name}</span>
                      <span className="font-mono text-xs text-amber-200">
                        {formatBytes(file.size)}
                        {duration ? ` · ${formatTime(duration)}` : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-display text-sm font-semibold text-mist-100">Drop your song here or click to browse</span>
                      <span className="text-xs text-mist-500">MP3 · WAV · OGG · M4A · FLAC · AAC up to 200MB</span>
                    </>
                  )}
                </label>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-bold tracking-[0.22em] text-mist-400 uppercase">Song title</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My favourite track" className={inputCls} maxLength={120} />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold tracking-[0.22em] text-mist-400 uppercase">Your name / artist</span>
                    <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Your name" className={inputCls} maxLength={80} />
                  </label>
                </div>

                <div className="mt-5">
                  <span className="text-[10px] font-bold tracking-[0.22em] text-mist-400 uppercase">Colour theme</span>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                    {THEMES.map((t) => (
                      <button
                        key={t.color}
                        type="button"
                        onClick={() => setAccent(t.color)}
                        title={t.name}
                        aria-label={t.name}
                        className={`h-8 w-8 rounded-full transition hover:scale-110 ${
                          accent === t.color ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-ink-950" : "opacity-80"
                        }`}
                        style={{ background: t.color, boxShadow: `0 0 16px ${t.color}90` }}
                      />
                    ))}
                    <label
                      className="relative flex h-8 cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3 text-[11px] text-mist-300 hover:border-white/40"
                      title="Pick any colour"
                    >
                      <span className="h-4 w-4 rounded-full" style={{ background: accent }} />
                      Custom
                      <input
                        type="color"
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || !vaultReady}
                  className="mt-6 w-full rounded-xl px-5 py-4 font-display text-sm font-bold tracking-[0.16em] text-ink-950 uppercase shadow-lg transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                  style={{ background: `linear-gradient(110deg,#fff3d1,${accent} 60%,#ff2fb0 140%)` }}
                >
                  {busy ? "Saving to your computer…" : "Save & play my song"}
                </button>

                {notice || vaultError ? (
                  <p
                    className={`mt-4 rounded-xl border px-4 py-3 text-xs font-medium ${
                      notice?.tone === "ok"
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                        : "border-rose-400/40 bg-rose-400/10 text-rose-200"
                    }`}
                  >
                    {notice?.text ?? vaultError}
                  </p>
                ) : null}
              </form>
            </div>
          </div>
        </Reveal>

        {/* My vault songs */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <SectionLabel>My vault · {localSongs.length}</SectionLabel>
          </div>
          {localSongs.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-white/8 bg-ink-900/50 px-6 py-8 text-center text-sm text-mist-500">
              {vaultReady ? "No songs yet. Upload your first one above and it'll be here every time you visit." : "Opening your vault…"}
            </p>
          ) : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {localSongs.map((song) => {
                const active = current?.id === song.id;
                const playing = active && isPlaying;
                return (
                  <li
                    key={song.id}
                    className="group glass flex items-center gap-3 rounded-2xl p-3 transition hover:-translate-y-0.5"
                    style={active ? { borderColor: `${song.accent}99`, boxShadow: `0 0 30px -12px ${song.accent}` } : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => playSong(song)}
                      aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
                      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl"
                    >
                      <CoverArt title={song.title} accent={song.accent} spinning={playing} rounded="rounded-xl" className="h-14 w-14" />
                      <span className="absolute inset-0 flex items-center justify-center bg-ink-950/55 text-white opacity-0 transition group-hover:opacity-100">
                        {playing ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-display text-sm font-bold text-mist-100">
                        {song.title}
                        {active ? <MiniEq active={playing} className="h-3" /> : null}
                      </p>
                      <p className="truncate text-xs text-mist-400">
                        {song.artist} · {formatTime(song.duration)} · {formatBytes(song.fileSize)}
                      </p>
                    </div>
                    <label className="relative h-7 w-7 shrink-0 cursor-pointer rounded-full ring-1 ring-white/20" style={{ background: song.accent }} title="Change colour theme">
                      <input
                        type="color"
                        value={song.accent}
                        onChange={(e) => void recolorLocalSong(song.id, e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Change colour theme"
                      />
                    </label>
                    {confirmId === song.id ? (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => void remove(song.id)} className="rounded-full bg-rose-500/20 px-2 py-1 text-[10px] font-bold text-rose-300">
                          Delete
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} className="rounded-full px-2 py-1 text-[10px] text-mist-400">
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(song.id)}
                        aria-label="Delete song"
                        className="rounded-full p-2 text-mist-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <TrashIcon width={16} height={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-xl border border-white/15 bg-ink-900/80 px-4 py-3 text-sm text-mist-100 outline-none transition placeholder:text-mist-500 focus:border-amber-300 focus:ring-1 focus:ring-amber-300";
