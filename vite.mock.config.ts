// `npm run dev:mock` — the panel with no backend. Dev server only: every piece below is a
// `serve`-only plugin, the app source is untouched, and `vite build` never reads this file.
//
//   • index.html boots `src/mocks/dev/entry.ts`, which starts the MSW worker and then imports
//     the real `src/main.tsx`.
//   • `/mockServiceWorker.js` is served straight from node_modules — nothing lands in public/,
//     so nothing can leak into dist/.
//   • `socket.io-client` resolves to an in-memory fake that reports "connected", so the
//     offline banner stays down without a socket server.
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import baseConfig from './vite.config';

const MOCK_ENTRY = '/src/mocks/dev/entry.ts';
const FAKE_SOCKET = fileURLToPath(new URL('./src/mocks/dev/fakeSocket.ts', import.meta.url));
const WORKER_FILE = fileURLToPath(
  new URL('./node_modules/msw/lib/mockServiceWorker.js', import.meta.url),
);

function devMockApi(): Plugin {
  return {
    name: 'onebook:dev-mock-api',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Service-Worker-Allowed', '/');
        res.end(readFileSync(WORKER_FILE, 'utf8'));
      });
    },
    transformIndexHtml(html) {
      return html.replace('/src/main.tsx', MOCK_ENTRY);
    },
    resolveId(source) {
      return source === 'socket.io-client' ? FAKE_SOCKET : null;
    },
  };
}

export default defineConfig(({ command }) => {
  if (command !== 'serve') {
    throw new Error('vite.mock.config.ts is for the dev server only — use vite.config.ts to build.');
  }
  return mergeConfig(baseConfig, {
    plugins: [devMockApi()],
    // A separate pre-bundle cache, so switching between `dev` and `dev:mock` never thrashes it.
    cacheDir: 'node_modules/.vite-mock',
    optimizeDeps: { exclude: ['socket.io-client'] },
  });
});
