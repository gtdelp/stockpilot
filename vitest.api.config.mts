import { defineConfig } from 'vitest/config';

/** Tests de la API serverless contra PostgreSQL en memoria (PGlite). */
export default defineConfig({
  test: {
    include: ['tests/api/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 30_000,
    coverage: { provider: 'v8', include: ['api/**/*.ts'], reportsDirectory: 'coverage/api' },
  },
});
