// WB-159 — the printable DVIR document: it carries the inspection, and nothing it is handed can
// break out of the markup (the string only ever reaches a fresh iframe document).
import { describe, expect, it } from 'vitest';
import { printableDvirHtml } from './printDvir';

const DVIR = {
  title: 'DVIR #dvir_1',
  subtitle: 'Unit #101 · Pre-trip · Sep 10, 2026 12:00',
  rows: [['Driver', 'John Smith'], ['Odometer', '993,589 mi']] as Array<[string, string]>,
  defects: [{ category: 'Brake pads', severity: 'CRITICAL', description: 'Worn past the wear line' }],
  mechanic: { name: 'J. Alvarez', signedAt: 'Sep 11, 2026 15:41' },
  driverSignature: { name: 'John Smith', signedAt: 'Sep 10, 2026 12:00' },
};

describe('printableDvirHtml', () => {
  it('carries the inspection, its defects and both signatures', () => {
    const html = printableDvirHtml(DVIR);
    expect(html).toContain('DVIR #dvir_1');
    expect(html).toContain('Unit #101 · Pre-trip');
    expect(html).toContain('993,589 mi');
    expect(html).toContain('Brake pads');
    expect(html).toContain('J. Alvarez');
    // Only the inspection — no application chrome, which is the whole point of not using
    // `window.print()` on the live document.
    expect(html).not.toContain('<nav');
  });

  it('prints "None" when the DVIR has no defects', () => {
    expect(printableDvirHtml({ ...DVIR, defects: [] })).toContain('<li>None</li>');
  });

  it('escapes every value it is handed', () => {
    const html = printableDvirHtml({
      ...DVIR,
      defects: [{ category: '<script>x</script>', severity: 'MINOR', description: 'a & b' }],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
  });
});
