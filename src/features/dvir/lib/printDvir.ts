// owner: web-dvir-safety — 11.15 `Print`. `window.print()` printed the whole application
// (sidebar, topbar, the table behind the drawer) because there is no print stylesheet. This
// renders the inspection on its own into a hidden same-origin iframe and prints that, so what
// comes out of the printer is the DVIR and nothing else.

export interface PrintableDvir {
  title: string;
  subtitle: string;
  rows: Array<[string, string]>;
  defects: Array<{ category: string; severity: string; description: string }>;
  mechanic: { name: string; signedAt: string };
  driverSignature: { name: string; signedAt: string };
}

function escapeHtml(value: string | null | undefined): string {
  // A real `/dvir/:id` row can omit a defect's category or description; an undefined here used to
  // throw inside the click handler and no document was produced at all.
  return String(value ?? '—').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

/** Builds the standalone print document. Exported for the test — no `dangerouslySetInnerHTML`
 * anywhere in the app tree; this string only ever reaches a fresh iframe document. */
export function printableDvirHtml(dvir: PrintableDvir): string {
  const rows = dvir.rows
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('');
  const defects = dvir.defects.length
    ? dvir.defects
        .map(
          (d) =>
            `<li><strong>${escapeHtml(d.category)}</strong> — ${escapeHtml(d.severity)}<br />${escapeHtml(d.description)}</li>`,
        )
        .join('')
    : '<li>None</li>';
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(dvir.title)}</title>
<style>
body { font: 12pt/1.4 system-ui, sans-serif; margin: 2em; }
h1 { font-size: 16pt; margin: 0 0 0.3em; }
p.sub { margin: 0 0 1.2em; }
table { border-collapse: collapse; width: 100%; margin-bottom: 1.2em; }
th, td { text-align: left; padding: 0.3em 0.6em; border-bottom: thin solid; vertical-align: top; }
th { width: 30%; font-weight: 600; }
ul { padding-left: 1.5em; }
li { margin-bottom: 0.5em; }
</style></head><body>
<h1>${escapeHtml(dvir.title)}</h1>
<p class="sub">${escapeHtml(dvir.subtitle)}</p>
<table>${rows}</table>
<h2>Defects</h2>
<ul>${defects}</ul>
<table>
<tr><th>Driver signature</th><td>${escapeHtml(dvir.driverSignature.name)} · ${escapeHtml(dvir.driverSignature.signedAt)}</td></tr>
<tr><th>Mechanic signature</th><td>${escapeHtml(dvir.mechanic.name)} · ${escapeHtml(dvir.mechanic.signedAt)}</td></tr>
</table>
</body></html>`;
}

/** Prints one DVIR through an off-screen iframe and removes it afterwards. */
export function printDvir(dvir: PrintableDvir): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(printableDvirHtml(dvir));
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  // Safari finishes the print dialogue asynchronously; removing the frame on this tick cancels it.
  setTimeout(() => frame.remove(), 1000);
}
