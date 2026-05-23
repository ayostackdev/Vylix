import { rmSync } from 'node:fs';

const pathsToRemove = [
  'node_modules',
  'apps/web/node_modules',
  'apps/web/.next',
  'apps/api/node_modules',
  'apps/api/dist',
  'apps/python-service/node_modules',
];

for (const targetPath of pathsToRemove) {
  rmSync(targetPath, { force: true, recursive: true });
}
