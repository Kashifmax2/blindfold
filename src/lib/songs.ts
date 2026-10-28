import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { songs, type SongRow } from "@/db/schema";

export type Song = {
  id: number;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  accent: string;
  duration: number;
  src: string;
  plays: number;
  featured: boolean;
  fileSize: number;
  mimeType: string;
  uploaded: boolean;
  createdAt: string;
  /** True for tracks stored only in the visitor's own browser (IndexedDB). */
  local?: boolean;
};

/** Everything is served same-origin so the Web Audio analyser never gets tainted. */
export function toSong(row: SongRow): Song {
  const isLocalAsset = !row.storageKey && row.audioUrl.startsWith("/");
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    genre: row.genre,
    mood: row.mood,
    accent: row.accent,
    duration: row.duration,
    src: isLocalAsset ? row.audioUrl : `/api/songs/${row.id}/audio`,
    plays: row.plays,
    featured: row.featured,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    uploaded: Boolean(row.storageKey),
    createdAt: row.createdAt.toISOString(),
  };
}

const SEED: Array<typeof songs.$inferInsert> = [
  {
    title: "Neon Veil",
    artist: "BLNDFLD",
    genre: "Lo-Fi",
    mood: "Midnight",
    accent: "#35e0ff",
    duration: 22.9,
    audioUrl: "/tracks/neon-veil.wav",
    mimeType: "audio/wav",
    fileSize: 1462900,
    plays: 18420,
    featured: true,
  },
  {
    title: "Blindfold Protocol",
    artist: "BLNDFLD",
    genre: "Synthwave",
    mood: "Hypnotic",
    accent: "#7c5cff",
    duration: 20,
    audioUrl: "/tracks/blindfold-protocol.wav",
    mimeType: "audio/wav",
    fileSize: 1280044,
    plays: 12980,
    featured: true,
  },
  {
    title: "Midnight Drive",
    artist: "Veilrunner",
    genre: "Retro Drive",
    mood: "Euphoric",
    accent: "#ff4fd8",
    duration: 23.2,
    audioUrl: "/tracks/midnight-drive.wav",
    mimeType: "audio/wav",
    fileSize: 1486494,
    plays: 24110,
    featured: true,
  },
  {
    title: "Echo Chamber",
    artist: "Shirogane",
    genre: "Ambient",
    mood: "Weightless",
    accent: "#4dffc3",
    duration: 21.2,
    audioUrl: "/tracks/echo-chamber.wav",
    mimeType: "audio/wav",
    fileSize: 1355338,
    plays: 8740,
  },
  {
    title: "Static Bloom",
    artist: "Veilrunner",
    genre: "Hard Drive",
    mood: "Restless",
    accent: "#ffb547",
    duration: 21.4,
    audioUrl: "/tracks/static-bloom.wav",
    mimeType: "audio/wav",
    fileSize: 1371472,
    plays: 15320,
  },
];

let seedPromise: Promise<void> | null = null;

async function seedOnce() {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(songs);
  if ((row?.count ?? 0) > 0) return;
  await db.insert(songs).values(SEED).onConflictDoNothing();
}

export async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seedOnce().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

export async function listSongs(): Promise<Song[]> {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(songs)
    .orderBy(desc(songs.featured), desc(songs.createdAt), asc(songs.id));
  return rows.map(toSong);
}

export async function getSongRow(id: number): Promise<SongRow | undefined> {
  const [row] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  return row;
}

export async function libraryStats() {
  await ensureSeeded();
  const [row] = await db
    .select({
      tracks: sql<number>`count(*)::int`,
      plays: sql<number>`coalesce(sum(${songs.plays}), 0)::int`,
      minutes: sql<number>`coalesce(sum(${songs.duration}), 0)::float / 60`,
      artists: sql<number>`count(distinct ${songs.artist})::int`,
    })
    .from(songs);
  return {
    tracks: row?.tracks ?? 0,
    plays: row?.plays ?? 0,
    minutes: row?.minutes ?? 0,
    artists: row?.artists ?? 0,
  };
}
