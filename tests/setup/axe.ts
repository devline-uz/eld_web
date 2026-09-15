// owner: web-qa-a11y — one axe-core wrapper for both Vitest (component/screen tests) and
// Playwright (`tests/e2e/support/axe.ts` re-exports the same rule config). web/tz.md §15:
// 0 `critical`, 0 `serious` violations on every screen.
import { configureAxe } from 'vitest-axe';
import type { AxeResults, Result } from 'axe-core';

export const axe = configureAxe({
  rules: {
    // Colour contrast is asserted against the design tokens directly in shared/ui tests;
    // jsdom cannot compute real rendered contrast, so it stays off here and lives in the
    // Playwright pass instead (real browser, real computed styles).
    'color-contrast': { enabled: false },
  },
});

const BLOCKING = new Set(['critical', 'serious']);

/** web/tz.md §15 gate: fail on any `critical`/`serious` violation, report the rest. */
export function blockingViolations(results: AxeResults): Result[] {
  return results.violations.filter((v) => BLOCKING.has(v.impact ?? ''));
}

/** Run axe on a rendered container and assert the §15 gate (0 critical / 0 serious). */
export async function expectNoBlockingA11yViolations(container: Element): Promise<void> {
  const results = await axe(container);
  const blocking = blockingViolations(results);
  if (blocking.length > 0) {
    const detail = blocking
      .map((v) => `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
      .join('\n');
    throw new Error(`axe found ${blocking.length} blocking violation(s):\n${detail}`);
  }
}
