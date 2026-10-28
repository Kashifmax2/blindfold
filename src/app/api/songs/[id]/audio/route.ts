import { getSongRow } from "@/lib/songs";
import { downloadFromCloud } from "@/lib/firebase";
import { cacheUpload, readUpload, uploadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /bytes=(\d*)-(\d*)/.exec(header);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) return null;
  return { start, end };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": "Range, Content-Type, Accept",
      "access-control-expose-headers": "Content-Range, Content-Length, Accept-Ranges",
    },
  });
}

export async function GET(request: Request, { params }: Ctx) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return new Response("Bad id", { status: 400 });

  const row = await getSongRow(id);
  if (!row) return new Response("Not found", { status: 404 });

  const corsHeaders: Record<string, string> = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "Range, Content-Type, Accept",
    "access-control-expose-headers": "Content-Range, Content-Length, Accept-Ranges",
  };

  // Remote link: proxy it so the stream stays same-origin for the analyser.
  if (!row.storageKey) {
    if (!/^https?:\/\//i.test(row.audioUrl)) {
      return Response.redirect(new URL(row.audioUrl, request.url), 302);
    }
    const upstream = await fetch(row.audioUrl, {
      headers: request.headers.get("range") ? { range: request.headers.get("range")! } : undefined,
      cache: "no-store",
    }).catch(() => null);
    if (!upstream || !upstream.ok || !upstream.body) {
      return new Response("Upstream audio unavailable", { status: 502, headers: corsHeaders });
    }
    const headers = new Headers(corsHeaders);
    headers.set("content-type", upstream.headers.get("content-type") ?? row.mimeType);
    headers.set("accept-ranges", "bytes");
    const len = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (len) headers.set("content-length", len);
    if (contentRange) headers.set("content-range", contentRange);
    headers.set("cache-control", "public, max-age=3600");
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  // Cloud storage first: redirect straight to Supabase so the audio never
  // passes through the serverless function (Vercel caps response bodies at
  // 4.5 MB and most songs are bigger). Supabase serves Range requests and
  // sends `access-control-allow-origin: *`, so the visualiser keeps working.
  const direct = uploadUrl(row.storageKey);
  if (direct) {
    return Response.redirect(direct, 302);
  }

  let file: Awaited<ReturnType<typeof readUpload>>;
  try {
    file = await readUpload(row.storageKey);
  } catch {
    // Local copy gone (fresh server / wiped disk): restore from Firebase Storage.
    const restored = await downloadFromCloud(row.storageKey);
    if (!restored) {
      return new Response("Audio file missing", { status: 404, headers: corsHeaders });
    }
    await cacheUpload(row.storageKey, restored);
    try {
      file = await readUpload(row.storageKey);
    } catch {
      return new Response("Audio file missing", { status: 404, headers: corsHeaders });
    }
  }

  const range = parseRange(request.headers.get("range"), file.size);
  const baseHeaders: Record<string, string> = {
    ...corsHeaders,
    "content-type": row.mimeType || "audio/mpeg",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=31536000, immutable",
    etag: `"${file.etag}"`,
  };

  if (!range) {
    return new Response(new Uint8Array(file.data), {
      status: 200,
      headers: { ...baseHeaders, "content-length": String(file.size) },
    });
  }

  const chunk = file.data.subarray(range.start, range.end + 1);
  return new Response(new Uint8Array(chunk), {
    status: 206,
    headers: {
      ...baseHeaders,
      "content-length": String(chunk.byteLength),
      "content-range": `bytes ${range.start}-${range.end}/${file.size}`,
    },
  });
}
