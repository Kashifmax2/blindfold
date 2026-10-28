import { parseBuffer } from "music-metadata";
import { guessGenre } from "@/lib/genre";

export type AudioMeta = {
  title: string | null;
  artist: string | null;
  genre: string | null;
  duration: number | null;
};

const EMPTY: AudioMeta = { title: null, artist: null, genre: null, duration: null };

/**
 * Read title/artist/genre/duration out of the audio file itself (ID3v2, MP4,
 * FLAC, OGG…). Never throws: a file without tags just gives nulls.
 */
export async function readAudioMeta(buffer: Buffer, mime?: string): Promise<AudioMeta> {
  try {
    const parsed = await parseBuffer(new Uint8Array(buffer), mime || undefined, {
      duration: true,
    });
    const common = parsed.common;
    const artist = common.artist || (common.artists ?? []).join(", ");
    const title = (common.title ?? "").trim() || null;
    const resolvedArtist = (artist ?? "").trim() || null;

    return {
      title,
      artist: resolvedArtist,
      genre: guessGenre(common.genre ?? [], title, resolvedArtist),
      duration: parsed.format.duration ? Math.round(parsed.format.duration) : null,
    };
  } catch {
    return EMPTY;
  }
}

/** Turn "Artist - Song (Official Video)" into its two useful halves. */
export function splitArtistTitle(raw: string): { artist: string | null; title: string } {
  const cleaned = raw
    .replace(/\((?:official|lyric|audio|video|music video|visualizer)[^)]*\)/gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const dash = cleaned.split(/\s+[-–—]\s+/);
  if (dash.length >= 2 && dash[0].length <= 40) {
    return { artist: dash[0].trim(), title: dash.slice(1).join(" - ").trim() };
  }
  return { artist: null, title: cleaned };
}
