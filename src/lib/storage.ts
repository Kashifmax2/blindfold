import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "application/ogg": "ogg",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/x-aac": "aac",
  "audio/opus": "opus",
  "audio/wma": "wma",
  "audio/x-ms-wma": "wma",
  "audio/3gpp": "3gp",
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

/** Supabase Storage bucket that holds uploaded audio. Created on first upload. */
export const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "blndfld-audio";

export function isAudioMime(mime: string) {
  if (!mime) return false;
  return (
    mime.startsWith("audio/") ||
    mime === "application/ogg" ||
    mime === "application/octet-stream"
  );
}

/* ------------------------------------------------------------------ *
 * Storage backend selection
 *
 * Serverless hosts (Vercel / Netlify) have a read-only filesystem, so
 * uploads cannot live on disk there. When Supabase credentials are
 * present the files go to Supabase Storage instead; otherwise the app
 * keeps using the local `.data/uploads` folder (handy for development).
 * ------------------------------------------------------------------ */

type SupabaseCreds = { base: string; key: string };

/** Project URL, either explicit or derived from the Postgres connection string. */
function projectBase(): string | null {
  const explicit = process.env.SUPABASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  // Direct host: db.<ref>.supabase.co
  const direct = /db\.([a-z0-9]{10,})\.supabase\.co/i.exec(url);
  if (direct) return `https://${direct[1]}.supabase.co`;

  // Pooler user: postgres.<ref>  (aws-0-eu-west-1.pooler.supabase.com)
  const pooler = /\/\/postgres\.([a-z0-9]{10,}):/i.exec(url);
  if (pooler) return `https://${pooler[1]}.supabase.co`;

  return null;
}

function supabaseCreds(): SupabaseCreds | null {
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    ""
  ).trim();
  const base = projectBase();
  if (!key || !base) return null;
  return { base, key };
}

export type StorageBackend = "supabase" | "local";

/** `supabase` when a service-role key is configured, else `local` disk. */
export function storageBackend(): StorageBackend {
  const forced = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (forced === "supabase") return "supabase";
  if (forced === "local") return "local";
  return supabaseCreds() ? "supabase" : "local";
}

function authHeaders(creds: SupabaseCreds): Record<string, string> {
  return {
    authorization: `Bearer ${creds.key}`,
    apikey: creds.key,
  };
}

let bucketReady = false;

/** Create the bucket once (public read, service-role write). */
async function ensureBucket(creds: SupabaseCreds) {
  if (bucketReady) return;

  const existing = await fetch(`${creds.base}/storage/v1/bucket/${SUPABASE_BUCKET}`, {
    headers: authHeaders(creds),
  });
  if (existing.ok) {
    bucketReady = true;
    return;
  }

  const created = await fetch(`${creds.base}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders(creds), "content-type": "application/json" },
    body: JSON.stringify({
      id: SUPABASE_BUCKET,
      name: SUPABASE_BUCKET,
      public: true,
      fileSizeLimit: MAX_UPLOAD_BYTES,
    }),
  });

  if (!created.ok && created.status !== 409) {
    const detail = await created.text().catch(() => "");
    throw new Error(
      /row-level security/i.test(detail)
        ? `Supabase refused to create the "${SUPABASE_BUCKET}" bucket: the SUPABASE_SERVICE_ROLE_KEY looks like a publishable/anon key. Use the service_role (secret) key instead.`
        : `Could not create the "${SUPABASE_BUCKET}" storage bucket (${created.status}). ${detail.slice(0, 200)}`,
    );
  }

  bucketReady = true;
}

/** Public object URL (used to stream audio back to the browser). */
export function uploadUrl(key: string): string | null {
  const creds = supabaseCreds();
  if (!creds || storageBackend() !== "supabase") return null;
  return `${creds.base}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodeURIComponent(key)}`;
}

/** `${uuid}.${ext}` - the same shape as saveUpload() produces. */
export function storageKeyFor(fileName: string, mime: string) {
  const fallbackExt = path.extname(fileName).replace(".", "").toLowerCase();
  const ext = EXT_BY_MIME[mime] ?? (fallbackExt || "mp3");
  return `${randomUUID()}.${ext}`;
}

/** Guards against a client handing us an arbitrary object name. */
export function isStorageKey(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/i.test(
    value,
  );
}

export async function uploadExists(key: string) {
  const url = uploadUrl(key);
  if (url) {
    const res = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (res?.ok) return true;
  }
  try {
    await stat(path.join(UPLOAD_DIR, path.basename(key)));
    return true;
  } catch {
    return false;
  }
}

export type UploadTicket = { key: string; uploadUrl: string };

/**
 * Signed URL so the browser can PUT the audio straight into Supabase Storage.
 * Needed on serverless hosts: Vercel functions reject request bodies over
 * 4.5 MB, and most songs are bigger than that.
 */
export async function createUploadTicket(
  fileName: string,
  mime: string,
): Promise<UploadTicket | null> {
  const creds = supabaseCreds();
  if (storageBackend() !== "supabase" || !creds) return null;

  await ensureBucket(creds);
  const key = storageKeyFor(fileName, mime);

  const res = await fetch(
    `${creds.base}/storage/v1/object/upload/sign/${SUPABASE_BUCKET}/${encodeURIComponent(key)}`,
    { method: "POST", headers: authHeaders(creds) },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Could not create an upload URL (${res.status}). ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Supabase did not return an upload URL.");

  return { key, uploadUrl: `${creds.base}/storage/v1${data.url}` };
}

export async function saveUpload(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await saveBuffer(buffer, file.name, file.type || "audio/mpeg");
  return { ...saved, buffer };
}

/** Store audio that was fetched from a URL (or any other in-memory buffer). */
export async function saveBuffer(buffer: Buffer, fileName: string, mime: string) {
  const key = storageKeyFor(fileName, mime);
  const contentType = mime || "audio/mpeg";

  const creds = supabaseCreds();
  if (storageBackend() === "supabase" && creds) {
    await ensureBucket(creds);
    const res = await fetch(
      `${creds.base}/storage/v1/object/${SUPABASE_BUCKET}/${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: {
          ...authHeaders(creds),
          "content-type": contentType,
          "cache-control": "public, max-age=31536000",
          "x-upsert": "true",
        },
        body: new Uint8Array(buffer),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Cloud upload failed (${res.status}). ${detail.slice(0, 200)}`,
      );
    }

    return { key, size: buffer.byteLength, backend: "supabase" as const };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, key), buffer);
  return { key, size: buffer.byteLength, backend: "local" as const };
}

/** Re-hydrate a file pulled back from cloud storage into the local disk cache. */
export async function cacheUpload(key: string, data: Buffer) {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, path.basename(key)), data);
  } catch {
    /* cache is best-effort (read-only filesystem on serverless hosts) */
  }
}

export async function readUpload(key: string) {
  const safe = path.basename(key);
  const filePath = path.join(UPLOAD_DIR, safe);
  const info = await stat(filePath);
  const data = await readFile(filePath);
  return { data, size: info.size, etag: createHash("md5").update(safe).digest("hex") };
}

/** Read an upload from wherever it lives (cloud first, then local disk). */
export async function readUploadBuffer(key: string): Promise<Buffer | null> {
  const url = uploadUrl(key);
  if (url) {
    const res = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (res?.ok) return Buffer.from(await res.arrayBuffer());
  }
  try {
    return (await readUpload(key)).data;
  } catch {
    return null;
  }
}

export async function deleteUpload(key: string | null) {
  if (!key) return;

  const creds = supabaseCreds();
  if (storageBackend() === "supabase" && creds) {
    try {
      await fetch(
        `${creds.base}/storage/v1/object/${SUPABASE_BUCKET}/${encodeURIComponent(key)}`,
        { method: "DELETE", headers: authHeaders(creds) },
      );
    } catch {
      /* object already gone — nothing to clean up */
    }
  }

  try {
    await unlink(path.join(UPLOAD_DIR, path.basename(key)));
  } catch {
    /* file already gone — nothing to clean up */
  }
}
