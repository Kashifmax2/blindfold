import { isAdmin } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, createUploadTicket, isAudioMime } from "@/lib/storage";

export const dynamic = "force-dynamic";

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|flac|aac|webm|wma|opus)$/i;

/**
 * Hands the admin console a signed Supabase URL so the browser can upload the
 * audio file directly. Vercel/Netlify functions reject request bodies over
 * 4.5 MB, which is smaller than a typical song.
 *
 * Returns `{ driver: "local" }` when no cloud storage is configured - the
 * console then falls back to the classic multipart upload.
 */
export async function POST(request: Request) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    filename?: string;
    mime?: string;
    size?: number;
  };

  const fileName = String(body.filename ?? "");
  const mime = String(body.mime ?? "");
  const size = Number(body.size ?? 0);

  if (!isAudioMime(mime) && !AUDIO_EXT.test(fileName)) {
    return Response.json({ error: "That file is not a supported audio format." }, { status: 415 });
  }
  if (Number.isFinite(size) && size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Audio file must be 50MB or smaller." }, { status: 413 });
  }

  try {
    const ticket = await createUploadTicket(fileName, mime);
    if (!ticket) return Response.json({ driver: "local" });
    return Response.json({ driver: "supabase", ...ticket });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not prepare the upload." },
      { status: 500 },
    );
  }
}
