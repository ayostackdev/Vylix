/**
 * Migrate all files from Appwrite Storage to Supabase Storage.
 *
 * Usage:
 *   node apps/api/scripts/migrate-to-supabase-storage.mjs
 *
 * Environment variables required:
 *   DATABASE_URL          – Prisma database URL
 *   APPWRITE_ENDPOINT     – e.g. https://fra.cloud.appwrite.io/v1
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY
 *   APPWRITE_STORAGE_BUCKET_ID
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_STORAGE_BUCKET (default: material)
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// ── Env ──────────────────────────────────────────────────────────────
const APPWRITE_ENDPOINT     = process.env.APPWRITE_ENDPOINT?.replace(/\/+$/, '');
const APPWRITE_PROJECT_ID   = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY      = process.env.APPWRITE_API_KEY;
const APPWRITE_BUCKET_ID    = process.env.APPWRITE_STORAGE_BUCKET_ID;
const SUPABASE_URL          = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET       = process.env.SUPABASE_STORAGE_BUCKET || 'material';

const prisma = new PrismaClient();

function appwriteHeaders() {
  return {
    'X-Appwrite-Project': APPWRITE_PROJECT_ID,
    'X-Appwrite-Key': APPWRITE_API_KEY,
  };
}

function supabaseHeaders() {
  return {
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    apikey: SUPABASE_SERVICE_KEY,
  };
}

function extractAppwriteFileId(fileUrl) {
  const match = fileUrl.match(/\/files\/([^/]+)\/view/);
  return match ? match[1] : null;
}

async function downloadFromAppwrite(fileId) {
  const url = `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}/files/${fileId}/download`;
  const res = await fetch(url, { headers: appwriteHeaders() });
  if (!res.ok) throw new Error(`Appwrite download failed (${res.status}) for file ${fileId}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const fileName = res.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] || fileId;
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  return { buffer, fileName, contentType };
}

async function uploadToSupabase(buffer, fileName, contentType) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `colphy/${new Date().getFullYear()}/${randomUUID()}-${safeName}`;

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`;
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      ...supabaseHeaders(),
      'content-type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upload failed (${res.status}): ${text}`);
  }

  const signedUrl = await getSupabaseSignedUrl(path);
  return { path, fileUrl: signedUrl, fileName };
}

async function getSupabaseSignedUrl(path) {
  const defaultUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${SUPABASE_BUCKET}/${path}`,
      {
        method: 'POST',
        headers: { ...supabaseHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ expiresIn: 86400 }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      return data?.signedURL || data?.signedUrl || defaultUrl;
    }
  } catch {}
  return defaultUrl;
}

async function migrate() {
  console.log('🔍 Fetching materials stored in Appwrite...\n');

  const materials = await prisma.material.findMany({
    where: { fileUrl: { contains: 'appwrite.io' } },
  });

  console.log(`Found ${materials.length} material(s) with Appwrite URLs.\n`);

  let migrated = 0;
  let failed = 0;

  for (const material of materials) {
    const fileId = extractAppwriteFileId(material.fileUrl);
    if (!fileId) {
      console.warn(`  ⚠️  Could not extract file ID from URL: ${material.fileUrl}`);
      failed++;
      continue;
    }

    process.stdout.write(`  [${migrated + failed + 1}/${materials.length}] ${material.fileName || material.id} … `);

    try {
      const { buffer, fileName, contentType } = await downloadFromAppwrite(fileId);
      const { path, fileUrl } = await uploadToSupabase(buffer, fileName, contentType);

      await prisma.material.update({
        where: { id: material.id },
        data: { filePath: path, fileUrl },
      });

      console.log('✅');
      migrated++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${migrated} migrated, ${failed} failed.`);

  await prisma.$disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
