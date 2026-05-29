import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmedLine.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, equalsIndex).trim();
    let value = trimmedLine.slice(equalsIndex + 1).trim();

    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(resolve(scriptDir, '..', '.env'));
loadEnvFile(resolve(scriptDir, '..', '.env.local'));
loadEnvFile(resolve(scriptDir, '..', '.env.production'));

const prismaArgs = process.argv.slice(2);

if (prismaArgs.length === 0) {
  console.error('Usage: node scripts/prisma-run.mjs <prisma arguments>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required before running Prisma migrations. Create apps/api/.env with DATABASE_URL and DIRECT_URL, or export them in your shell.');
  process.exit(1);
}

if (!process.env.DIRECT_URL) {
  const directUrl = new URL(databaseUrl);
  directUrl.port = directUrl.port === '6543' ? '5432' : directUrl.port || '5432';
  directUrl.searchParams.delete('pgbouncer');
  process.env.DIRECT_URL = directUrl.toString();
}

const result = spawnSync('npx', ['prisma', ...prismaArgs], {
  stdio: 'inherit',
  env: process.env,
  cwd: resolve(scriptDir, '..'),
  shell: true
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);