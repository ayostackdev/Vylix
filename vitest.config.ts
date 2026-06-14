import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/api/src/**/*.spec.ts', 'apps/api/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['apps/api/src/**/*.ts'],
      exclude: ['apps/api/src/main.ts', 'apps/api/src/worker.ts'],
    },
  },
  server: {
    deps: {
      inline: ['node-appwrite'],
    },
  },
});
