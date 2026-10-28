import { lookup } from "node:dns/promises";
import { isAdmin } from "@/lib/auth";
import { readAudioMeta, splitArtistTitle } from "@/lib/audio-meta";
import { guessGenre } from "@/lib/genre";
import { MAX_UPLOAD_BYTES, saveBuffer } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|flac|aac|webm|wma|opus)(?:$|\?)/i;

/** Streaming pages: we can read their metadata, but never their audio. */
const PAGE_PROVIDERS: Array<{ re: RegExp; name: string }> = [
  { re: /open\.spotify\.com|spotify\.link/i, name: "Spotify" },
  { re: /(?:youtube\.com|youtu\.be)/i, name: "YouTube" },
  { re: /music\.apple\.com/i, name: "Apple Music" },
  { re: /soundcloud\.com/i, name: "SoundCloud" },
];

function isPrivateAddress(ip: string) {
  if (ip === "::1" || /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip)) return true;
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Refuse to fetch our own network / metadata endpoints. */
async function assertPublicHost(url: URL) {
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http and https links work.");
  const host = url.hostname;
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw new Error("That host is not allowed.");
  }
  const addresses = await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new Error("Could not reach that host.");
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("That host is not allowed.");
  }
}

function metaFromHtml(html: string) {
  const pick = (re: RegExp) => {
    const match = html.match(re);
    return match ? match[1].trim() : null;
  };
  const title =
    pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ??
    pick(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["']/i) ??
    pick(/<title[^>]*>([^<]*)<\/title>/i);
  const description =
    pick(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ??
    pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  return { title, description };
}

type DownloadResult =
  | { kind: "audio"; buffer: Buffer; mime: string }
  | { kind: "page"; html: string };

async function download(target: string): Promise<DownloadResult> {
  const res = await fetch(target, {
    headers: { "user-agent": UA, accept: "audio/*,application/ogg,*/*;q=0.8" },
    redirect: "follow",
  });

  if (!res.ok) throw new Error(`The link answered ${res.status}.`);

  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

  if (mime.startsWith("text/html") || mime === "application/xhtml+xml") {
    return { kind: "page", html: await res.text() };
  }

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) throw new Error("That file is larger than 50MB.");

  if (!res.body) throw new Error("The link returned no data.");

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_UPLOAD_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("That file is larger than 50MB.");
    }
    chunks.push(value);
  }

  return {
    kind: "audio",
    buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
    mime:
      mime && mime !== "application/octet-stream"
        ? mime
        : AUDIO_EXT.test(target)
          ? `audio/${(AUDIO_EXT.exec(target)?.[1] ?? "mp3").toLowerCase()}`
          : "audio/mpeg",
  };
}

/** Title/artist from an oEmbed endpoint (Spotify, YouTube). */
async function oEmbed(endpoint: string) {
  const res = await fetch(endpoint, { headers: { "user-agent": UA } }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json().catch(() => null)) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  } | null;
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const raw = String(body.url ?? "").trim();
  if (!raw) return Response.json({ error: "Paste a link first." }, { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return Response.json({ error: "That does not look like a link." }, { status: 400 });
  }

  try {
    await assertPublicHost(url);

    const provider = PAGE_PROVIDERS.find((entry) => entry.re.test(url.href));

    // Streaming services: metadata only, the audio itself is DRM-protected.
    if (provider) {
      if (provider.name === "Spotify") {
        const data = await oEmbed(`https://open.spotify.com/oembed?url=${encodeURIComponent(url.href)}`);
        return Response.json({
          kind: "metadata",
          provider: provider.name,
          title: data?.title ?? null,
          artist: null,
          genre: guessGenre([], data?.title),
          note: "Spotify audio DRM-protected hai — sirf details mili. Gaana download karke file choose karo.",
        });
      }
      if (provider.name === "YouTube") {
        const data = await oEmbed(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url.href)}&format=json`,
        );
        const split = splitArtistTitle(data?.title ?? "");
        return Response.json({
          kind: "metadata",
          provider: provider.name,
          title: split.title || null,
          artist: split.artist ?? data?.author_name ?? null,
          genre: guessGenre([], split.title, split.artist ?? data?.author_name),
          note: "YouTube se audio nahi liya ja sakta — details bhar di hain, ab file choose karo.",
        });
      }
    }

    const result = await download(url.href);

    if (result.kind === "page") {
      const meta = metaFromHtml(result.html);
      const split = splitArtistTitle(meta.title ?? "");
      return Response.json({
        kind: "metadata",
        provider: provider?.name ?? "Link",
        title: split.title || null,
        artist: split.artist,
        genre: guessGenre([], split.title, split.artist, meta.description),
        note: "Is page par seedha audio nahi mila — details bhar di hain, ab file choose karo.",
      });
    }

    const meta = await readAudioMeta(result.buffer, result.mime);
    const fallbackName = decodeURIComponent(url.pathname.split("/").pop() ?? "")
      .replace(AUDIO_EXT, "")
      .replace(/[-_]+/g, " ")
      .trim();

    const split = splitArtistTitle(meta.title ?? fallbackName);
    const title = split.title || fallbackName || "Untitled";
    const artist = meta.artist ?? split.artist;

    const saved = await saveBuffer(result.buffer, `import.${result.mime.split("/")[1] || "mp3"}`, result.mime);

    return Response.json({
      kind: "audio",
      key: saved.key,
      fileSize: saved.size,
      mimeType: result.mime,
      title,
      artist,
      genre: meta.genre ?? guessGenre([], title, artist),
      duration: meta.duration,
      note: "Link se download karke upload kar diya — colour choose kar ke Publish dabao.",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not import that link." },
      { status: 400 },
    );
  }
}
