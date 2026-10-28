import type { SongRow } from "@/db/schema";
import { storageBackend } from "@/lib/storage";

/**
 * Firebase cloud mirror (server-side, Admin SDK).
 *
 * Configure ONE of:
 *   FIREBASE_SERVICE_ACCOUNT   = full service-account JSON (single line)
 * or
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * plus (recommended)
 *   FIREBASE_STORAGE_BUCKET    = your-project.appspot.com / your-project.firebasestorage.app
 *
 * When nothing is configured every function here is a safe no-op, so the app
 * keeps working on local Postgres + disk.
 */

type Credentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function readCredentials(): Credentials | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    try {
      const json = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (json.project_id && json.client_email && json.private_key) {
        return {
          projectId: json.project_id,
          clientEmail: json.client_email,
          privateKey: json.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      console.error("[firebase] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n").replace(/^"|"$/g, ""),
    };
  }
  return null;
}

export function firebaseConfigured() {
  return readCredentials() !== null;
}

/**
 * Cloud Storage is optional. When FIREBASE_STORAGE_BUCKET is not set the
 * project has no bucket (e.g. no Blaze plan), so only Firestore is used and
 * the audio files stay on this server's disk.
 */
function bucketName() {
  const configured = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  return configured ? configured : null;
}

/**
 * Firestore database id. Standard projects use "(default)"; projects where a
 * named database was created instead must point at it (e.g. "default").
 */
function firestoreDatabaseId() {
  return process.env.FIREBASE_FIRESTORE_DATABASE?.trim() || "(default)";
}

type Handles = {
  projectId: string;
  bucketName: string | null;
  firestore: import("firebase-admin/firestore").Firestore;
  bucket: ReturnType<import("firebase-admin/storage").Storage["bucket"]> | null;
};

let handlesPromise: Promise<Handles | null> | null = null;

async function getHandles(): Promise<Handles | null> {
  const creds = readCredentials();
  if (!creds) return null;
  if (!handlesPromise) {
    handlesPromise = (async () => {
      const { initializeApp, getApps, cert } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");
      const { getStorage } = await import("firebase-admin/storage");
      const name = "blndfld-cloud";
      const existing = getApps().find((a) => a.name === name);
      const bucket = bucketName();
      const app =
        existing ??
        initializeApp(
          {
            credential: cert({
              projectId: creds.projectId,
              clientEmail: creds.clientEmail,
              privateKey: creds.privateKey,
            }),
            ...(bucket ? { storageBucket: bucket } : {}),
          },
          name,
        );
      return {
        projectId: creds.projectId,
        bucketName: bucket,
        firestore: getFirestore(app, firestoreDatabaseId()),
        bucket: bucket ? getStorage(app).bucket(bucket) : null,
      };
    })().catch((error) => {
      console.error("[firebase] init failed:", error);
      handlesPromise = null;
      return null;
    });
  }
  return handlesPromise;
}

function songDoc(row: SongRow, storagePath: string | null) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    genre: row.genre,
    mood: row.mood,
    accent: row.accent,
    duration: row.duration,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    featured: row.featured,
    plays: row.plays,
    storagePath,
    storage: row.storageKey
      ? storagePath
        ? "firebase-storage"
        : storageBackend() === "supabase"
          ? "supabase-storage"
          : "server-disk"
      : "link",
    remoteUrl: row.storageKey ? null : row.audioUrl,
    createdAt: row.createdAt.toISOString(),
    syncedAt: new Date().toISOString(),
  };
}

/** Upload the audio file (if any) and metadata. Safe to call in the background. */
export async function mirrorSongToCloud(row: SongRow, data?: Buffer) {
  const h = await getHandles();
  if (!h) return false;

  // Storage is optional: without a bucket the file stays on this server's disk
  // and only the catalogue entry is mirrored.
  let storagePath: string | null = null;
  if (h.bucket && row.storageKey && data) {
    try {
      await h.bucket.file(`songs/${row.storageKey}`).save(data, {
        resumable: false,
        contentType: row.mimeType || "audio/mpeg",
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      storagePath = `songs/${row.storageKey}`;
    } catch (error) {
      console.warn(
        "[firebase] storage upload skipped:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  try {
    await h.firestore
      .collection("songs")
      .doc(String(row.id))
      .set(songDoc(row, storagePath), { merge: true });
    return true;
  } catch (error) {
    console.error("[firebase] mirror failed:", error);
    return false;
  }
}

export async function patchSongInCloud(row: SongRow) {
  const h = await getHandles();
  if (!h) return false;
  try {
    const storagePath = h.bucket && row.storageKey ? `songs/${row.storageKey}` : null;
    await h.firestore
      .collection("songs")
      .doc(String(row.id))
      .set(songDoc(row, storagePath), { merge: true });
    return true;
  } catch (error) {
    console.error("[firebase] patch failed:", error);
    return false;
  }
}

export async function deleteSongFromCloud(row: SongRow) {
  const h = await getHandles();
  if (!h) return false;
  try {
    await h.firestore.collection("songs").doc(String(row.id)).delete();
    if (h.bucket && row.storageKey) {
      try {
        await h.bucket.file(`songs/${row.storageKey}`).delete({ ignoreNotFound: true });
      } catch (error) {
        console.warn(
          "[firebase] storage delete skipped:",
          error instanceof Error ? error.message : error,
        );
      }
    }
    return true;
  } catch (error) {
    console.error("[firebase] delete failed:", error);
    return false;
  }
}

/** Used when the local disk copy is gone: pull the file back from Storage. */
export async function downloadFromCloud(storageKey: string): Promise<Buffer | null> {
  const h = await getHandles();
  if (!h || !h.bucket) return null;
  try {
    const [buf] = await h.bucket.file(`songs/${storageKey}`).download();
    return buf;
  } catch {
    return null;
  }
}

export async function cloudStatus() {
  const creds = readCredentials();
  if (!creds) {
    return { configured: false, connected: false, projectId: null, bucket: null, error: null as string | null };
  }
  const h = await getHandles();
  if (!h) {
    return {
      configured: true,
      connected: false,
      projectId: creds.projectId,
      bucket: bucketName(),
      error: "Could not initialise Firebase — check the service-account values.",
    };
  }
  try {
    await h.firestore.collection("songs").limit(1).get();
    return { configured: true, connected: true, projectId: h.projectId, bucket: h.bucketName, error: null };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      projectId: h.projectId,
      bucket: h.bucketName,
      error: error instanceof Error ? error.message : "Firestore unreachable",
    };
  }
}
