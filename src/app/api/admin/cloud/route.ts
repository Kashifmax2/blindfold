import { db } from "@/db";
import { songs } from "@/db/schema";
import { isAdmin } from "@/lib/auth";
import { cloudStatus, firebaseConfigured, mirrorSongToCloud } from "@/lib/firebase";
import { readUploadBuffer, storageBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }
  const status = await cloudStatus();
  return Response.json({ ...status, storage: storageBackend() });
}

/** Push every track (files + metadata) to Firebase. */
export async function POST(request: Request) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }
  if (!firebaseConfigured()) {
    return Response.json(
      { error: "Firebase is not configured yet. Add the FIREBASE_* environment variables." },
      { status: 400 },
    );
  }

  const rows = await db.select().from(songs);

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    let data: Buffer | undefined;
    if (row.storageKey) {
      data = (await readUploadBuffer(row.storageKey)) ?? undefined;
    }
    const ok = await mirrorSongToCloud(row, data);
    if (ok) synced += 1;
    else failed += 1;
  }
  return Response.json({ ok: failed === 0, synced, failed, total: rows.length });
}
