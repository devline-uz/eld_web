import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// owner: web-qa-a11y — every endpoint the app calls, validated against backend/docs/openapi.json.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/contract/**/*.{test,spec}.ts'],
    setupFiles: ['tests/contract/setup.ts'],
  },
});
