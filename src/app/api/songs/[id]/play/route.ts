import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { songs } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return Response.json({ error: "Bad id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { duration?: number };
  const patch: Record<string, unknown> = { plays: sql`${songs.plays} + 1` };
  if (typeof body.duration === "number" && body.duration > 0) {
    patch.duration = body.duration;
  }

  const [row] = await db
    .update(songs)
    .set(patch)
    .where(eq(songs.id, id))
    .returning({ plays: songs.plays });

  if (!row) return Response.json({ error: "Track not found." }, { status: 404 });
  return Response.json({ plays: row.plays });
}
