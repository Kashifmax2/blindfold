import { after } from "next/server";
import { db } from "@/db";
import { mirrorSongToCloud } from "@/lib/firebase";
import { songs } from "@/db/schema";
import { isAdmin, isValidPassword, isValidToken } from "@/lib/auth";
import { listSongs, toSong } from "@/lib/songs";
import { MAX_UPLOAD_BYTES, isAudioMime, isStorageKey, saveUpload, uploadExists } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await listSongs();
  return Response.json({ songs: data });
}

/**
 * Completes a direct-to-Supabase upload: the browser already PUT the audio
 * file, so this only validates it and stores the catalogue row.
 */
async function completeCloudUpload(request: Request) {
  const body = (await request.json().catch(() => null)) as null | {
    title?: string;
    artist?: string;
    genre?: string;
    mood?: string;
    accent?: string;
    duration?: number;
    featured?: boolean;
    storageKey?: string;
    fileSize?: number;
    mimeType?: string;
    adminToken?: string;
    token?: string;
    password?: string;
  };

  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });

  const tokenField = body.adminToken || body.token || body.password || "";
  const authed =
    (await isAdmin(request)) || isValidToken(tokenField) || isValidPassword(tokenField);
  if (!authed) {
    return Response.json(
      { error: "Admin access required. Please unlock the console first." },
      { status: 401 },
    );
  }

  const title = String(body.title ?? "").trim();
  if (!title) return Response.json({ error: "Track title is required." }, { status: 400 });

  const storageKey = String(body.storageKey ?? "");
  if (!isStorageKey(storageKey)) {
    return Response.json({ error: "Invalid upload reference." }, { status: 400 });
  }
  if (!(await uploadExists(storageKey))) {
    return Response.json(
      { error: "The audio file did not finish uploading. Please try again." },
      { status: 400 },
    );
  }

  const duration = Number(body.duration ?? 0);
  const accent = String(body.accent ?? "#35e0ff").trim();
  const fileSize = Number(body.fileSize ?? 0);

  const [row] = await db
    .insert(songs)
    .values({
      title,
      artist: String(body.artist ?? "").trim() || "Unknown Artist",
      genre: String(body.genre ?? "").trim() || "Electronic",
      mood: String(body.mood ?? "").trim() || "Night",
      accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#35e0ff",
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      audioUrl: `upload:${storageKey}`,
      storageKey,
      mimeType: String(body.mimeType ?? "audio/mpeg") || "audio/mpeg",
      fileSize: Number.isFinite(fileSize) && fileSize > 0 ? Math.round(fileSize) : 0,
      featured: Boolean(body.featured),
    })
    .returning();

  after(async () => {
    await mirrorSongToCloud(row);
  });

  return Response.json({ song: toSong(row) }, { status: 201 });
}

export async function POST(request: Request) {
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    return completeCloudUpload(request);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  // Check auth via headers/cookies OR form field fallback
  const formToken = String(form.get("adminToken") ?? form.get("token") ?? form.get("password") ?? "");
  const authed = (await isAdmin(request)) || isValidToken(formToken) || isValidPassword(formToken);

  if (!authed) {
    return Response.json(
      { error: "Admin access required. Please unlock the console first." },
      { status: 401 },
    );
  }

  const title = String(form.get("title") ?? "").trim();
  const artist = String(form.get("artist") ?? "").trim() || "Unknown Artist";
  const genre = String(form.get("genre") ?? "").trim() || "Electronic";
  const mood = String(form.get("mood") ?? "").trim() || "Night";
  const accent = String(form.get("accent") ?? "#35e0ff").trim();
  const duration = Number(form.get("duration") ?? 0);
  const remoteUrl = String(form.get("audioUrl") ?? "").trim();
  const featured = String(form.get("featured") ?? "") === "true";
  const file = form.get("file");

  if (!title) {
    return Response.json({ error: "Track title is required." }, { status: 400 });
  }

  let storageKey: string | null = null;
  let audioUrl = remoteUrl;
  let mimeType = "audio/mpeg";
  let fileSize = 0;
  let fileBuffer: Buffer | undefined;

  if (file instanceof File && file.size > 0) {
    if (!isAudioMime(file.type) && !/\.(mp3|wav|ogg|m4a|flac|aac|webm|wma|opus)$/i.test(file.name)) {
      return Response.json({ error: "That file is not a supported audio format." }, { status: 415 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: "Audio file must be 50MB or smaller." }, { status: 413 });
    }
    const saved = await saveUpload(file);
    storageKey = saved.key;
    fileSize = saved.size;
    fileBuffer = saved.buffer;
    mimeType = file.type || "audio/mpeg";
    audioUrl = `upload:${saved.key}`;
  } else if (!/^https?:\/\//i.test(audioUrl)) {
    return Response.json(
      { error: "Upload an audio file or paste a direct https:// audio link." },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(songs)
    .values({
      title,
      artist,
      genre,
      mood,
      accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#35e0ff",
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      audioUrl,
      storageKey,
      mimeType,
      fileSize,
      featured,
    })
    .returning();

  // Mirror to Firebase (Storage + Firestore) after the response is sent.
  after(async () => {
    await mirrorSongToCloud(row, fileBuffer);
  });

  return Response.json({ song: toSong(row) }, { status: 201 });
}
