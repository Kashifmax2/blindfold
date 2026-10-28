import { eq } from "drizzle-orm";
import { after } from "next/server";
import { deleteSongFromCloud, patchSongInCloud } from "@/lib/firebase";
import { db } from "@/db";
import { songs } from "@/db/schema";
import { isAdmin, isValidPassword, isValidToken } from "@/lib/auth";
import { getSongRow, toSong } from "@/lib/songs";
import { deleteUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const body = (await request.json().catch(() => ({}))) as Partial<{
    title: string;
    artist: string;
    genre: string;
    mood: string;
    accent: string;
    featured: boolean;
    duration: number;
    token: string;
    password: string;
  }>;

  const tokenField = body.token || body.password;
  const authed = (await isAdmin(request)) || isValidToken(tokenField) || isValidPassword(tokenField);

  if (!authed) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isFinite(id)) return Response.json({ error: "Bad id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.artist === "string" && body.artist.trim()) patch.artist = body.artist.trim();
  if (typeof body.genre === "string" && body.genre.trim()) patch.genre = body.genre.trim();
  if (typeof body.mood === "string" && body.mood.trim()) patch.mood = body.mood.trim();
  if (typeof body.accent === "string" && /^#[0-9a-f]{6}$/i.test(body.accent)) patch.accent = body.accent;
  if (typeof body.featured === "boolean") patch.featured = body.featured;
  if (typeof body.duration === "number" && body.duration > 0) patch.duration = body.duration;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  const [row] = await db.update(songs).set(patch).where(eq(songs.id, id)).returning();
  if (!row) return Response.json({ error: "Track not found." }, { status: 404 });
  after(async () => {
    await patchSongInCloud(row);
  });
  return Response.json({ song: toSong(row) });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const authed = await isAdmin(request);
  if (!authed) {
    return Response.json({ error: "Admin access required." }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isFinite(id)) return Response.json({ error: "Bad id" }, { status: 400 });

  const row = await getSongRow(id);
  if (!row) return Response.json({ error: "Track not found." }, { status: 404 });

  await db.delete(songs).where(eq(songs.id, id));
  await deleteUpload(row.storageKey);
  after(async () => {
    await deleteSongFromCloud(row);
  });
  return Response.json({ ok: true });
}
