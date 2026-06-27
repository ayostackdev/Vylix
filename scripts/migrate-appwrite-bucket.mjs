import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { Client, Storage } = require('node-appwrite');
const { PrismaClient } = require('@prisma/client');

const SOURCE_BUCKET = 'materials';
const TARGET_BUCKET = 'vault-documents';

async function main() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    console.error('Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY');
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const storage = new Storage(client);
  const prisma = new PrismaClient();

  const materials = await prisma.material.findMany({
    where: { filePath: { not: null } },
    select: { id: true, filePath: true, fileName: true },
  });

  console.log(`Found ${materials.length} materials with filePath`);

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const mat of materials) {
    const fileId = mat.filePath;
    if (!fileId) { skipped++; continue; }

    try {
      // Check if already exists in target bucket
      try {
        await storage.getFile({ bucketId: TARGET_BUCKET, fileId });
        console.log(`  [SKIP] ${fileId} — already in ${TARGET_BUCKET}`);
        skipped++;
        continue;
      } catch {
        // Doesn't exist, proceed with copy
      }

      // Download from source
      const fileBytes = await storage.getFileDownload({ bucketId: SOURCE_BUCKET, fileId });
      const buffer = Buffer.from(fileBytes);

      // Upload to target with same fileId
      const { InputFile } = require('node-appwrite/file');
      const inputFile = InputFile.fromBuffer(buffer, mat.fileName);

      await storage.createFile({ bucketId: TARGET_BUCKET, fileId, file: inputFile });
      console.log(`  [OK]   ${fileId} — copied to ${TARGET_BUCKET}`);
      copied++;
    } catch (err) {
      console.error(`  [FAIL] ${fileId} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${copied} copied, ${skipped} skipped, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
