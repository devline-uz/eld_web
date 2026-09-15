// owner: web-qa-a11y — Playwright half of the axe wiring (web/tz.md §15). The Vitest half is
// tests/setup/axe.ts; both share the same "0 critical, 0 serious" gate.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const BLOCKING = new Set(['critical', 'serious']);

export async function assertNoBlockingA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ''));
  expect(
    blocking,
    blocking.map((v) => `[${v.impact}] ${v.id}: ${v.help}`).join('\n'),
  ).toEqual([]);
}
