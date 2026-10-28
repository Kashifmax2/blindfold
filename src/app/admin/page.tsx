import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { listSongs } from "@/lib/songs";
import { AdminApp } from "./admin-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Console — BLINDFOLD",
  description: "Upload and curate the Blindfold rotation.",
};

export default async function AdminPage() {
  const [authed, songs] = await Promise.all([isAdmin(), listSongs()]);
  return (
    <AdminApp initialSongs={songs} authed={authed} />
  );
}
