// owner: web-qa-a11y — global Vitest setup (jsdom matchers, axe, cleanup).
// Loaded once via vitest.config.ts `test.setupFiles`.
import '@testing-library/jest-dom/vitest';
import 'vitest-axe/extend-expect';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// WB-044: the default 1 s `findBy*`/`waitFor` budget flaked under the full coverage run (lazy
// chunks + debounced queries + MSW on a loaded box) while the same tests passed in isolation.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia (prefers-reduced-motion, prefers-color-scheme checks —
// web/tz.md §15) or ResizeObserver (Radix, Recharts, MapLibre containers).
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver ??= MockResizeObserver;

// scrollIntoView is used by table row focus / anchor navigation (§4.6) and is unimplemented
// in jsdom.
Element.prototype.scrollIntoView ??= () => {};

// Pointer capture is unimplemented in jsdom; Radix's swipe-to-dismiss (Toast) and drag
// primitives call it unconditionally on pointerdown.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};

// `maplibre-gl` calls `window.URL.createObjectURL` as a *module-load* side effect (to spin up its
// worker), so any test that lazy-loads FleetMap crashes on import under jsdom, which has no such
// API (WB-016). Real browsers provide it; the stub does not change what FleetMap renders.
window.URL.createObjectURL ??= () => 'blob:mock';

// jsdom 30 represents "focus on the viewport" by the Document once a focused element is removed
// (Node-impl `_removingSteps`, e.g. RTL `cleanup()` unmounting the previous test's focused button).
// The next `element.focus()` then fires `blur` with the Document as the previous target, which its
// target adjustment turns into a `blur` on the *Window* — with `relatedTarget` set to the element
// that is gaining focus inside the page. Browsers never fire window blur for an in-page focus move.
// @radix-ui/react-menu ≥2.1.2x closes on `window` blur, so every DropdownMenu opened after a
// focused node was removed snapped shut the moment its content took focus (row-action menus,
// Topbar account menu — WB-2xx). Swallow only that spurious event; a real window blur (focus
// leaving the page) has `relatedTarget === null` and still reaches listeners.
window.addEventListener(
  'blur',
  (event) => {
    const next = (event as FocusEvent).relatedTarget;
    // At target only: a capturing listener on window also sees every element's own blur.
    if (event.eventPhase === Event.AT_TARGET && next instanceof Node && document.contains(next)) {
      event.stopImmediatePropagation();
    }
  },
  true,
);
