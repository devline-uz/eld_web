// `npm run dev:mock` entry (vite.mock.config.ts swaps it in for src/main.tsx). The worker must be
// listening before the app's first request, so it starts first and the real entry loads after.
const { worker } = await import('../browser');
await worker.start({ onUnhandledRequest: 'bypass' });
await import('../../main');

export {};
