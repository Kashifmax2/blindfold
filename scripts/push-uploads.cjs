/**
 * Copy every locally stored upload into Supabase Storage.
 *
 *   node scripts/push-uploads.cjs
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY (and DATABASE_URL) in .env.local.
 * Safe to re-run: files are uploaded with upsert, existing ones are skipped.
 */
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const BUCKET = (process.env.SUPABASE_STORAGE_BUCKET || "blndfld-audio").trim();
const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

function projectBase() {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL.trim().replace(/\/+$/, "");
  const url = process.env.DATABASE_URL || "";
  const direct = /db\.([a-z0-9]{10,})\.supabase\.co/i.exec(url);
  if (direct) return `https://${direct[1]}.supabase.co`;
  const pooler = /\/\/postgres\.([a-z0-9]{10,}):/i.exec(url);
  if (pooler) return `https://${pooler[1]}.supabase.co`;
  return null;
}

const BASE = projectBase();
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();

if (!BASE) {
  console.error("Could not work out SUPABASE_URL. Set it in .env.local.");
  process.exit(1);
}
if (!KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is missing in .env.local.");
  process.exit(1);
}

const auth = { authorization: `Bearer ${KEY}`, apikey: KEY };

async function ensureBucket() {
  const head = await fetch(`${BASE}/storage/v1/bucket/${BUCKET}`, { headers: auth });
  if (head.ok) {
    console.log(`bucket "${BUCKET}" exists`);
    return;
  }
  const res = await fetch(`${BASE}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, fileSizeLimit: 52428800 }),
  });
  const body = await res.text();
  if (!res.ok && res.status !== 409) {
    console.error(`could not create bucket (${res.status}): ${body.slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`bucket "${BUCKET}" created (public read)`);
}

async function exists(name) {
  const res = await fetch(`${BASE}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(name)}`, {
    method: "HEAD",
  });
  return res.ok;
}

(async () => {
  await ensureBucket();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    "select id, title, storage_key, mime_type from songs where storage_key is not null order by id",
  );
  await client.end();

  if (rows.length === 0) {
    console.log("no uploaded tracks in the database - nothing to copy");
    return;
  }

  let uploaded = 0;
  let skipped = 0;
  let missing = 0;

  for (const row of rows) {
    const localPath = path.join(UPLOAD_DIR, path.basename(row.storage_key));
    const hasLocal = fs.existsSync(localPath);

    if (await exists(row.storage_key)) {
      console.log(`  = #${row.id} ${row.title} (already in storage)`);
      skipped += 1;
      continue;
    }

    if (!hasLocal) {
      console.log(`  ! #${row.id} ${row.title} (file missing locally: ${row.storage_key})`);
      missing += 1;
      continue;
    }

    const data = fs.readFileSync(localPath);
    const res = await fetch(
      `${BASE}/storage/v1/object/${BUCKET}/${encodeURIComponent(row.storage_key)}`,
      {
        method: "POST",
        headers: {
          ...auth,
          "content-type": row.mime_type || "audio/mpeg",
          "cache-control": "public, max-age=31536000",
          "x-upsert": "true",
        },
        body: data,
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.log(`  x #${row.id} ${row.title} upload failed (${res.status}) ${detail.slice(0, 200)}`);
      missing += 1;
      continue;
    }

    console.log(`  + #${row.id} ${row.title} (${(data.length / 1048576).toFixed(2)} MB)`);
    uploaded += 1;
  }

  console.log(`\n${uploaded} uploaded, ${skipped} skipped, ${missing} missing`);
  console.log(`bucket: ${BASE}/storage/v1/object/public/${BUCKET}/`);
})().catch((error) => {
  console.error("FAILED:", error.message);
  process.exit(1);
});
