import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath, URL } from 'node:url';

// web/tz.md §2.3 (dev server) and §16.1 (bundle budget).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({ filename: 'stats.html', gzipSize: true, brotliSize: false }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  esbuild: {
    // §17 — console.log is dropped from production builds.
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Chunking rule (§16.1): a `manualChunks` bucket is only lazy if *nothing* in the
        // eager graph imports it. A single catch-all `vendor` bucket therefore pulled
        // `@firebase/auth`, recharts' own deps (lodash, decimal.js-light, react-smooth) and the
        // form/table libraries — all dynamic-import-only — back into the initial payload.
        // Everything a signed-in user does not need on first paint gets its own named bucket.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const pkg = id.split('node_modules/').pop() ?? '';
          // Lazy, map screens only.
          if (pkg.startsWith('maplibre-gl')) return 'maplibre';
          // Lazy — loaded by the dynamic import inside shared/auth/firebase.ts.
          if (pkg.startsWith('firebase/') || pkg.startsWith('@firebase/')) return 'firebase';
          // Lazy — reached only through `import('./sentrySdk')` when VITE_SENTRY_DSN is set. No named
          // bucket: a named manual chunk absorbed the facade and was hoisted into the entry
          // (+28 KB initial). Left to Rollup, it lands in the dynamic sentrySdk chunk (WD-057).
          if (pkg.startsWith('@sentry/') || pkg.startsWith('@sentry-internal/')) return undefined;
          // Lazy — recharts and every transitive dep it alone pulls in.
          if (
            /^(recharts|victory-vendor|d3-|lodash|decimal\.js-light|react-smooth|fast-equals|eventemitter3)/.test(
              pkg,
            )
          )
            return 'recharts';
          // Lazy — forms and tables only exist inside route-level feature chunks.
          if (/^(zod|react-hook-form|@hookform)/.test(pkg)) return 'vendor-forms';
          if (/^@tanstack\/(table-core|react-table|react-virtual|virtual-core)/.test(pkg))
            return 'vendor-table';
          // Eager: React itself and the router the shell mounts.
          if (/^(react|react-dom|react-router|scheduler)[/@]/.test(pkg) || /^(react|react-dom|react-router|scheduler)$/.test(pkg))
            return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
});
