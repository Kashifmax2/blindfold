"use client";

import type { Song } from "@/lib/songs";

/**
 * Personal vault: songs a visitor uploads are kept on THEIR computer inside the
 * browser's IndexedDB (never sent to the server). They survive reloads/restarts.
 */

const DB_NAME = "blndfld-vault";
const STORE = "tracks";
const VERSION = 1;

export type VaultRecord = {
  key: number;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  accent: string;
  duration: number;
  size: number;
  mime: string;
  createdAt: string;
  blob: Blob;
};

export const VAULT_MAX_BYTES = 200 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support local song storage."));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open local vault."));
    req.onblocked = () => reject(new Error("Close other tabs of this site and try again."));
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        let result: T;
        req.onsuccess = () => {
          result = req.result;
        };
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? req.error ?? new Error("Vault transaction failed."));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error("Vault storage is full or blocked."));
        };
      }),
  );
}

export async function listVault(): Promise<VaultRecord[]> {
  const rows = await run<VaultRecord[]>("readonly", (s) => s.getAll() as IDBRequest<VaultRecord[]>);
  return (rows ?? []).sort((a, b) => b.key - a.key);
}

export async function saveToVault(
  file: Blob,
  meta: { title: string; artist: string; genre: string; mood: string; accent: string; duration: number; mime: string },
): Promise<VaultRecord> {
  if (file.size > VAULT_MAX_BYTES) throw new Error("Song must be 200MB or smaller.");
  // Ask the browser to keep this data even under storage pressure.
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* optional */
  }
  const record: VaultRecord = {
    key: Date.now() * 10 + Math.floor(Math.random() * 10),
    title: meta.title,
    artist: meta.artist,
    genre: meta.genre,
    mood: meta.mood,
    accent: meta.accent,
    duration: meta.duration,
    size: file.size,
    mime: meta.mime || file.type || "audio/mpeg",
    createdAt: new Date().toISOString(),
    blob: file,
  };
  await run("readwrite", (s) => s.put(record));
  return record;
}

export async function updateVault(key: number, patch: Partial<Pick<VaultRecord, "title" | "artist" | "accent" | "duration">>) {
  const rows = await listVault();
  const row = rows.find((r) => r.key === key);
  if (!row) return;
  await run("readwrite", (s) => s.put({ ...row, ...patch }));
}

export async function deleteFromVault(key: number) {
  await run("readwrite", (s) => s.delete(key));
}

/** Local songs use negative ids so they never collide with server ids. */
export function vaultToSong(record: VaultRecord, url: string): Song {
  return {
    id: -record.key,
    title: record.title,
    artist: record.artist,
    genre: record.genre,
    mood: record.mood,
    accent: record.accent,
    duration: record.duration,
    src: url,
    plays: 0,
    featured: false,
    fileSize: record.size,
    mimeType: record.mime,
    uploaded: true,
    createdAt: record.createdAt,
    local: true,
  };
}
