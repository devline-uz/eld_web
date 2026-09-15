// owner: web-qa-a11y (edited by web-reports-transfer for web/bugs.md WB-048) — jsdom, with Node's own
// AbortController/AbortSignal kept.
//
// Vitest's jsdom environment copies jsdom's `AbortController`/`AbortSignal` onto the global but keeps
// Node's `fetch`/`Request` (undici). undici's `new Request(url, { signal })` rejects a jsdom signal:
//   TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal.
// MSW's fetch interceptor builds exactly that `Request`, so every query that passed TanStack's
// `signal` surfaced as `NetworkError` in tests, and the hooks dropped `signal` (client.ts rule 9)
// instead. Restoring the native pair after jsdom populates the global fixes the realm mismatch at
// its source: the signal TanStack creates is the one undici accepts. No runtime dependency hands a
// signal to jsdom's `addEventListener` (checked: @radix-ui, @tanstack, react-dom, @testing-library).
import type { Environment } from 'vitest/environments';
import { builtinEnvironments } from 'vitest/environments';

const jsdom = builtinEnvironments.jsdom;

export default {
  name: 'jsdom-native-abort',
  transformMode: 'web',
  async setup(global: typeof globalThis, options: Record<string, unknown>) {
    const NativeAbortController = global.AbortController;
    const NativeAbortSignal = global.AbortSignal;
    const env = await jsdom.setup(global, options);
    global.AbortController = NativeAbortController;
    global.AbortSignal = NativeAbortSignal;
    return env;
  },
} satisfies Environment;
