"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import type { Song } from "@/lib/songs";
import { formatBytes, formatPlays, formatTime } from "@/lib/format";
import { NowPlayingDock } from "@/components/player/now-playing-dock";
import { StageCanvas } from "@/components/player/stage-canvas";
import { PlayerProvider, usePlayer } from "@/components/player/player-provider";
import {
  AmbientLayer,
  BeatFlash,
  FxControlBar,
  MiniEq,
  RailPanels,
} from "@/components/player/visuals";
import { SiteHeader } from "@/components/site/site-header";
import {
  BoltIcon,
  PauseIcon,
  PlayIcon,
  ShieldIcon,
  StarIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/site/icons";
import { CoverArt, Reveal, SectionLabel } from "@/components/site/ui";
import { guessGenre } from "@/lib/genre";
import { parseBlob } from "music-metadata";

const ACCENTS = ["#35e0ff", "#7c5cff", "#ff4fd8", "#4dffc3", "#ffb547", "#ff4f78"];

type Toast = { tone: "ok" | "err"; message: string } | null;

const STORAGE_KEY = "blndfld_admin_token";

export function AdminApp({
  initialSongs,
  authed,
}: {
  initialSongs: Song[];
  authed: boolean;
}) {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [isAuthed, setIsAuthed] = useState(authed);
  const [adminToken, setAdminToken] = useState<string>("");

  useEffect(() => {
    // Restore the session from localStorage (readable only after mount).
    // The token is verified against the server before the console opens, so a
    // stale or revoked token can never unlock the page.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- server-provided initial state
      if (authed) setIsAuthed(true);
      return;
    }
    let alive = true;
    fetch("/api/admin/login", {
      headers: { Authorization: `Bearer ${stored}`, "x-admin-token": stored },
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data: { ok?: boolean }) => {
        if (!alive) return;
        if (data?.ok) {
          setAdminToken(stored);
          setIsAuthed(true);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [authed]);

  const handleAuthed = useCallback((token: string) => {
    setAdminToken(token);
    setIsAuthed(true);
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    }
  }, []);

  const lock = useCallback(async () => {
    window.localStorage.removeItem(STORAGE_KEY);
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => undefined);
    setAdminToken("");
    setIsAuthed(false);
  }, []);

  return (
    <PlayerProvider initialSongs={songs}>
      <AmbientLayer />
      <BeatFlash />
      <RailPanels />
      <StageCanvas />
      <SiteHeader admin />
      <main className="relative z-10 pt-32 pb-44 sm:pt-36 xl:px-[96px]">
        {isAuthed ? (
          <Console
            songs={songs}
            setSongs={setSongs}
            onLock={lock}
            adminToken={adminToken}
          />
        ) : (
          <Gate onAuthed={handleAuthed} />
        )}
      </main>
      {isAuthed ? <NowPlayingDock /> : null}
    </PlayerProvider>
  );
}

/* ------------------------------------------------------------------ */
function Gate({ onAuthed }: { onAuthed: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        token?: string;
        error?: string;
      };

      if (res.ok && data.ok) {
        const token = data.token || "master_authed";
        setPassword("");
        onAuthed(token);
      } else {
        setError(data.error ?? "Incorrect access key.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-5">
      <Reveal>
        <form onSubmit={submit} className="glass-strong border border-veil-400/25 bg-ink-950/90 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-ink-950 shadow-lg"
            style={{ background: "linear-gradient(140deg,#eafbff,var(--accent))" }}
          >
            <ShieldIcon width={22} height={22} />
          </span>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-mist-100">
            Console Access
          </h1>
          <p className="mt-2 text-sm text-mist-400">
            Enter the admin access key to upload tracks and control the rotation.
          </p>

          <label className="mt-7 block text-[11px] font-bold tracking-[0.24em] text-mist-400 uppercase">
            Access Key / Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your access key"
            autoFocus
            className="mt-2 w-full rounded-xl border border-white/15 bg-ink-900/80 px-4 py-3.5 text-sm text-mist-100 transition outline-none placeholder:text-mist-500 focus:border-veil-400 focus:ring-1 focus:ring-veil-400"
          />
          {error ? <p className="mt-3 text-xs font-semibold text-ember-500">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-xl px-5 py-3.5 font-display text-sm font-bold tracking-[0.16em] text-ink-950 uppercase transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 shadow-lg"
            style={{ background: "linear-gradient(120deg,#eafbff,var(--accent) 70%,#7c5cff 150%)" }}
          >
            {busy ? "Authenticating…" : "Unlock Console"}
          </button>

          <p className="mt-5 text-center text-[11px] tracking-[0.18em] text-mist-500 uppercase">
            Authorised personnel only
          </p>
        </form>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Console({
  songs,
  setSongs,
  onLock,
  adminToken,
}: {
  songs: Song[];
  setSongs: (updater: (prev: Song[]) => Song[]) => void;
  onLock: () => void;
  adminToken: string;
}) {
  const { current, isPlaying, playSong } = usePlayer();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileDuration, setFileDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState("Electronic");
  const [mood, setMood] = useState("Night");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [imported, setImported] = useState<{
    key: string;
    fileSize: number;
    mimeType: string;
  } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const stats = useMemo(() => {
    const storage = songs.reduce((sum, s) => sum + s.fileSize, 0);
    return {
      tracks: songs.length,
      plays: songs.reduce((sum, s) => sum + s.plays, 0),
      featured: songs.filter((s) => s.featured).length,
      storage,
    };
  }, [songs]);

  const acceptFile = useCallback(
    (next: File | null) => {
      setFile(next);
      setFileDuration(0);
      setImported(null);
      if (!next) return;
      if (!title) {
        setTitle(next.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
      }
      const url = URL.createObjectURL(next);
      const probe = new Audio();
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        if (Number.isFinite(probe.duration)) setFileDuration(probe.duration);
        URL.revokeObjectURL(url);
      };
      probe.onerror = () => URL.revokeObjectURL(url);
      probe.src = url;

      // Read the file's own tags so nothing has to be typed by hand.
      void parseBlob(next, { duration: true })
        .then((meta) => {
          const artist = meta.common.artist || (meta.common.artists ?? []).join(", ");
          if (meta.common.title) setTitle(meta.common.title);
          if (artist) setArtist(artist);
          const suggestion = guessGenre(
            meta.common.genre ?? [],
            meta.common.title,
            artist,
          );
          if (suggestion) setGenre(suggestion);
          if (meta.format.duration) setFileDuration(Math.round(meta.format.duration));
        })
        .catch(() => undefined);
    },
    [title],
  );

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  /** Pull title/artist/genre (and the audio, when the link is a real file). */
  const fetchFromLink = async () => {
    const link = remoteUrl.trim();
    if (!link) {
      setToast({ tone: "err", message: "Paste a link first." });
      return;
    }

    setFetching(true);
    setToast(null);
    setImported(null);

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (adminToken) {
      headers.Authorization = `Bearer ${adminToken}`;
      headers["x-admin-token"] = adminToken;
    }

    try {
      const res = await fetch("/api/admin/import-url", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: link }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        kind?: "audio" | "metadata";
        key?: string;
        fileSize?: number;
        mimeType?: string;
        title?: string | null;
        artist?: string | null;
        genre?: string | null;
        duration?: number | null;
        note?: string;
        error?: string;
      };

      if (!res.ok) {
        setToast({ tone: "err", message: data.error ?? "That link could not be read." });
        return;
      }

      if (data.title) setTitle(data.title);
      if (data.artist) setArtist(data.artist);
      if (data.genre) setGenre(data.genre);
      if (data.duration) setFileDuration(data.duration);

      if (data.kind === "audio" && data.key) {
        setImported({
          key: data.key,
          fileSize: data.fileSize ?? 0,
          mimeType: data.mimeType ?? "audio/mpeg",
        });
        setToast({
          tone: "ok",
          message: data.note ?? "Imported. Colour choose karo aur Publish dabao.",
        });
      } else {
        setToast({
          tone: "err",
          message: data.note ?? "Sirf details mili — audio file choose karo.",
        });
      }
    } catch {
      setToast({ tone: "err", message: "Network error while reading that link." });
    } finally {
      setFetching(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setToast({ tone: "err", message: "Please enter a track title." });
      return;
    }
    if (!file && !imported && !remoteUrl.trim()) {
      setToast({ tone: "err", message: "Choose an audio file or paste an audio link." });
      return;
    }
    setBusy(true);
    setToast(null);

    const metadata = {
      title: title.trim(),
      artist: artist.trim(),
      genre: genre.trim() || "Electronic",
      mood: mood.trim() || "Night",
      accent,
      featured: Boolean(featured),
      duration: fileDuration || 0,
      adminToken,
    };

    try {
      const headers: Record<string, string> = {};
      if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
        headers["x-admin-token"] = adminToken;
      }

      let res: Response;

      // Ask the server whether the file can go straight to cloud storage.
      // Vercel/Netlify reject request bodies over 4.5 MB, so big songs must
      // bypass the function entirely.
      const ticket: { driver?: string; key?: string; uploadUrl?: string } | null = file
        ? await fetch("/api/admin/upload-url", {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size }),
          })
            .then((r) => r.json())
            .catch(() => null)
        : null;

      if (imported) {
        res = await fetch("/api/songs", {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({
            ...metadata,
            storageKey: imported.key,
            fileSize: imported.fileSize,
            mimeType: imported.mimeType,
          }),
        });
      } else if (file && ticket?.driver === "supabase" && ticket.uploadUrl && ticket.key) {
        const put = await fetch(ticket.uploadUrl, {
          method: "PUT",
          headers: {
            "content-type": file.type || "audio/mpeg",
            "x-upsert": "true",
          },
          body: file,
        });

        if (!put.ok) {
          setToast({ tone: "err", message: `Upload failed (${put.status}). Try again.` });
          return;
        }

        res = await fetch("/api/songs", {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({
            ...metadata,
            storageKey: ticket.key,
            fileSize: file.size,
            mimeType: file.type || "audio/mpeg",
          }),
        });
      } else {
        const body = new FormData();
        body.set("title", metadata.title);
        body.set("artist", metadata.artist);
        body.set("genre", metadata.genre);
        body.set("mood", metadata.mood);
        body.set("accent", metadata.accent);
        body.set("featured", String(metadata.featured));
        body.set("duration", String(metadata.duration));
        body.set("adminToken", adminToken);

        if (file) body.set("file", file);
        else body.set("audioUrl", remoteUrl.trim());

        res = await fetch("/api/songs", {
          method: "POST",
          headers,
          body,
        });
      }

      const data = (await res.json().catch(() => ({}))) as { song?: Song; error?: string };

      if (!res.ok || !data.song) {
        setToast({ tone: "err", message: data.error ?? "Upload failed. Try again." });
        return;
      }

      const newSong = data.song as Song;
      setSongs((prev) => [newSong, ...prev]);
      setToast({ tone: "ok", message: `“${newSong.title}” successfully published! Playing now…` });
      playSong(newSong);

      // Reset form
      setFile(null);
      setFileDuration(0);
      setTitle("");
      setArtist("");
      setRemoteUrl("");
      setImported(null);
      setFeatured(false);
      if (fileInput.current) fileInput.current.value = "";
    } catch {
      setToast({ tone: "err", message: "Network error during upload." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (song: Song) => {
    const headers: Record<string, string> = {};
    if (adminToken) {
      headers.Authorization = `Bearer ${adminToken}`;
      headers["x-admin-token"] = adminToken;
    }
    const res = await fetch(`/api/songs/${song.id}`, { method: "DELETE", headers });
    if (res.ok) {
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      setToast({ tone: "ok", message: `Deleted “${song.title}”.` });
    } else {
      setToast({ tone: "err", message: "Could not delete this track." });
    }
  };

  const toggleFeatured = async (song: Song) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (adminToken) {
      headers.Authorization = `Bearer ${adminToken}`;
      headers["x-admin-token"] = adminToken;
    }
    const res = await fetch(`/api/songs/${song.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ featured: !song.featured }),
    });
    if (res.ok) {
      setSongs((prev) =>
        prev.map((s) => (s.id === song.id ? { ...s, featured: !song.featured } : s)),
      );
    }
  };

  const figures = [
    { label: "Tracks Live", value: String(stats.tracks) },
    { label: "Total Plays", value: formatPlays(stats.plays) },
    { label: "Featured", value: String(stats.featured) },
    { label: "Storage", value: formatBytes(stats.storage) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>Admin Console</SectionLabel>
          <button
            type="button"
            onClick={onLock}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-bold tracking-[0.24em] text-mist-400 uppercase transition hover:border-ember-500/50 hover:bg-ember-500/10 hover:text-ember-500"
          >
            <ShieldIcon width={13} height={13} /> Lock Console
          </button>
        </div>
        <h1 className="mt-4 font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.02] font-bold tracking-tight text-mist-100 uppercase">
          Feed The Rotation
        </h1>
        <p className="mt-2.5 max-w-xl text-[15px] text-mist-400">
          Upload any audio file (.mp3, .wav, .ogg, .m4a, .flac). Artist name is optional — leave
          it blank if you prefer.
        </p>
      </Reveal>

      <Reveal delay={40} className="mt-6">
        <CloudPanel adminToken={adminToken} />
      </Reveal>

      {/* Visualizer FX Switcher Bar inside Admin */}
      <Reveal delay={60} className="mt-6">
        <FxControlBar />
      </Reveal>

      <Reveal delay={90}>
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-4">
          {figures.map((f) => (
            <div key={f.label} className="bg-ink-950/80 px-5 py-4">
              <dt className="font-display text-2xl font-bold text-mist-100">{f.value}</dt>
              <dd className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-mist-500 uppercase">
                {f.label}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Upload Panel */}
        <Reveal delay={120} className="lg:col-span-5">
          <form
            onSubmit={submit}
            className="glass-strong border border-veil-400/20 bg-ink-950/90 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl"
          >
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
              <UploadIcon width={19} height={19} className="text-veil-300" /> Upload Music
            </h2>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`mt-5 flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${
                dragging
                  ? "border-veil-400 bg-veil-400/15"
                  : "border-white/15 bg-ink-900/60 hover:border-veil-400/60 hover:bg-white/5"
              }`}
            >
              <input
                ref={fileInput}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.webm,.opus,.wma"
                className="hidden"
                onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
              />
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-ink-950 shadow-md"
                style={{ background: `linear-gradient(140deg,#eafbff,${accent})` }}
              >
                <UploadIcon width={20} height={20} />
              </span>
              {file ? (
                <>
                  <span className="font-display text-sm font-bold text-mist-100">{file.name}</span>
                  <span className="text-xs text-veil-300 font-mono">
                    {formatBytes(file.size)}
                    {fileDuration ? ` · ${formatTime(fileDuration)}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-display text-sm font-semibold text-mist-200">
                    Drop any song or click to browse
                  </span>
                  <span className="text-xs text-mist-500">MP3 · WAV · OGG · M4A · FLAC · AAC (up to 50MB)</span>
                </>
              )}
            </label>

            <div className="mt-5 grid gap-4">
              <Field label="Track Title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midnight Beats"
                  className={inputClass}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Artist (optional)">
                  <input
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Who performs this track?"
                    className={inputClass}
                  />
                </Field>
                <Field label="Genre">
                  <input
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Electronic / Lo-Fi"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mood">
                  <input
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    placeholder="Hypnotic / High Bass"
                    className={inputClass}
                  />
                </Field>

                <Field label="Glow Accent Color">
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    {ACCENTS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setAccent(color)}
                        aria-label={`Accent ${color}`}
                        className={`h-7 w-7 rounded-full transition hover:scale-110 ${
                          accent === color ? "ring-2 ring-white ring-offset-2 ring-offset-ink-950 scale-110" : "opacity-80"
                        }`}
                        style={{ background: color, boxShadow: `0 0 14px ${color}90` }}
                      />
                    ))}
                  </div>
                </Field>
              </div>

              {!file ? (
                <Field label="Or Paste a Link (audio file / Spotify / YouTube)">
                  <div className="flex gap-2">
                    <input
                      value={remoteUrl}
                      onChange={(e) => {
                        setRemoteUrl(e.target.value);
                        setImported(null);
                      }}
                      placeholder="https://… mp3 link, Spotify ya YouTube"
                      className={`${inputClass} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={fetchFromLink}
                      disabled={fetching || !remoteUrl.trim()}
                      className="shrink-0 rounded-xl border border-veil-400/40 bg-veil-400/15 px-4 text-[11px] font-bold tracking-[0.14em] text-veil-200 uppercase transition hover:bg-veil-400/25 disabled:opacity-50"
                    >
                      {fetching ? "…" : "Fetch"}
                    </button>
                  </div>
                  {imported ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-veil-200">
                      Audio cloud par upload ho gaya — bas colour choose karo, phir Publish.
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] leading-relaxed text-mist-500">
                      Direct mp3/wav link = poora gaana import. Spotify/YouTube = sirf
                      title/artist (audio DRM-protected).
                    </p>
                  )}
                </Field>
              ) : null}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="h-4 w-4 accent-veil-400"
                />
                <span className="text-xs font-semibold text-mist-300">Pin to Featured Songs</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-xl px-5 py-3.5 font-display text-sm font-bold tracking-[0.16em] text-ink-950 uppercase transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 shadow-lg"
              style={{ background: `linear-gradient(120deg,#eafbff,${accent} 70%,#7c5cff 150%)` }}
            >
              {busy ? "Uploading Track…" : "Publish Song"}
            </button>

            {toast ? (
              <p
                className={`mt-4 rounded-xl border px-4 py-3 text-xs font-medium ${
                  toast.tone === "ok"
                    ? "border-veil-400/40 bg-veil-400/15 text-veil-200"
                    : "border-ember-500/40 bg-ember-500/15 text-ember-400"
                }`}
              >
                {toast.message}
              </p>
            ) : null}
          </form>
        </Reveal>

        {/* Track List */}
        <Reveal delay={180} className="lg:col-span-7">
          <div className="glass-strong border border-veil-400/20 bg-ink-950/90 overflow-hidden rounded-3xl shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <h2 className="font-display text-lg font-bold text-mist-100">Live Track Rotation</h2>
              <span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.24em] text-mist-400 uppercase">
                <BoltIcon width={13} height={13} className="text-veil-300" /> {songs.length} Tracks
              </span>
            </div>

            <ul className="divide-y divide-white/6">
              {songs.map((song) => {
                const active = current?.id === song.id;
                const playing = active && isPlaying;
                return (
                  <li
                    key={song.id}
                    className="group flex items-center gap-4 px-4 py-3.5 transition hover:bg-white/5 sm:px-6"
                    style={active ? { background: `${song.accent}18` } : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => playSong(song)}
                      aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
                      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow"
                    >
                      <CoverArt
                        title={song.title}
                        accent={song.accent}
                        spinning={playing}
                        rounded="rounded-xl"
                        className="h-12 w-12"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-ink-950/60 text-mist-100 opacity-0 transition group-hover:opacity-100">
                        {playing ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-display text-sm font-bold text-mist-100">
                        {song.title}
                        {active ? <MiniEq active={playing} className="h-3" /> : null}
                      </p>
                      <p className="truncate text-xs text-mist-400">
                        {song.artist} · <span className="text-veil-400">{song.genre}</span> · {song.uploaded ? "upload" : "linked"}
                      </p>
                    </div>

                    <div className="hidden text-right text-[11px] text-mist-400 sm:block">
                      <p className="font-mono font-medium">{formatTime(song.duration)}</p>
                      <p className="text-[10px]">{formatPlays(song.plays)} spins</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFeatured(song)}
                      aria-label="Toggle featured"
                      className={`rounded-full p-2 transition hover:bg-white/10 ${
                        song.featured ? "text-amber-400" : "text-mist-500"
                      }`}
                    >
                      <StarIcon width={17} height={17} />
                    </button>

                    <button
                      type="button"
                      onClick={() => remove(song)}
                      aria-label="Delete track"
                      className="rounded-full p-2 text-mist-500 transition hover:bg-ember-500/20 hover:text-ember-400"
                    >
                      <TrashIcon width={17} height={17} />
                    </button>
                  </li>
                );
              })}

              {songs.length === 0 ? (
                <li className="px-6 py-14 text-center text-sm text-mist-400">
                  No tracks in the rotation. Upload the first song above!
                </li>
              ) : null}
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
type CloudState = {
  configured: boolean;
  connected: boolean;
  projectId: string | null;
  bucket: string | null;
  storage?: "supabase" | "local";
  error: string | null;
};

function CloudPanel({ adminToken }: { adminToken: string }) {
  const [state, setState] = useState<CloudState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (adminToken) {
      h.Authorization = `Bearer ${adminToken}`;
      h["x-admin-token"] = adminToken;
    }
    return h;
  }, [adminToken]);

  const load = useCallback(() => {
    fetch("/api/admin/cloud", { headers, cache: "no-store" })
      .then((r) => r.json())
      .then((d: CloudState) => setState(d))
      .catch(() => setState({ configured: false, connected: false, projectId: null, bucket: null, error: "Status unavailable" }));
  }, [headers]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/cloud", { method: "POST", headers });
      const d = (await r.json()) as { synced?: number; failed?: number; total?: number; error?: string };
      setMsg(d.error ?? `Synced ${d.synced ?? 0}/${d.total ?? 0} tracks to Firebase${d.failed ? ` (${d.failed} failed)` : ""}.`);
      load();
    } catch {
      setMsg("Sync failed. Network error.");
    } finally {
      setSyncing(false);
    }
  };

  const tone = !state ? "border-white/10" : state.connected ? "border-emerald-400/40" : state.configured ? "border-rose-400/40" : "border-amber-300/40";

  return (
    <div className={`glass flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${tone}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>🔥</span>
        <div>
          <p className="font-display text-sm font-bold text-mist-100">
            Firebase cloud ·{" "}
            {!state ? (
              <span className="text-mist-400">checking…</span>
            ) : state.connected ? (
              <span className="text-emerald-300">Connected</span>
            ) : state.configured ? (
              <span className="text-rose-300">Error</span>
            ) : (
              <span className="text-amber-200">Not configured</span>
            )}
          </p>
          <p className="mt-1 text-xs text-mist-400">
            {state?.connected
              ? `Admin uploads are mirrored to project “${state.projectId}”${state.bucket ? ` (Storage: ${state.bucket})` : state.storage === "supabase" ? " — audio in Supabase Storage, catalogue in Firestore" : " — Firestore only, audio files stay on this server"} in the background.`
              : state?.configured
                ? state.error
                : "Add FIREBASE_SERVICE_ACCOUNT (or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) + FIREBASE_STORAGE_BUCKET to your environment. Until then songs are saved on this server."}
          </p>
          {msg ? <p className="mt-1 text-xs text-veil-200">{msg}</p> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={sync}
        disabled={syncing || !state?.connected}
        className="shrink-0 rounded-full border border-veil-400/40 bg-veil-400/10 px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-veil-200 uppercase transition hover:bg-veil-400/20 disabled:opacity-40"
      >
        {syncing ? "Syncing…" : "Sync all to Firebase"}
      </button>
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/15 bg-ink-900/80 px-4 py-3 text-sm text-mist-100 outline-none transition placeholder:text-mist-500 focus:border-veil-400 focus:ring-1 focus:ring-veil-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold tracking-[0.22em] text-mist-400 uppercase">{label}</span>
      {children}
    </label>
  );
}
