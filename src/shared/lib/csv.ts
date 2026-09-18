// owner: web-vehicles-drivers — WB-106. Shared RFC 4180 CSV parser used by the vehicles (11.6)
// and drivers (11.7) importers. Handles quoted fields with embedded commas/newlines, escaped `""`,
// CRLF/LF/CR line endings, and a leading UTF-8 BOM.

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Tokenizes raw CSV text into rows of raw string fields (no header mapping). */
export function parseCsvRows(text: string): string[][] {
  const input = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = input.length;

  function pushField() {
    row.push(field);
    field = '';
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
  }

  while (i < len) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (char === '\r') {
      if (input[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop blank lines (a row that tokenized to a single empty field).
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Parses CSV text into header-keyed row objects; header and field values are trimmed. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const headerRow = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const headers = headerRow.map((h) => h.trim());
  return dataRows.map((r) => Object.fromEntries(headers.map((h, idx) => [h, (r[idx] ?? '').trim()])));
}
