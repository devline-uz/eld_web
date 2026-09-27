// owner: web-vehicles-drivers — 11.7 Import drivers (web/tz.md §11.7). Same mechanics as 11.6;
// SMS is never a channel (Q-2) — invitations always go by email, not the SMS wording in the design.
import { useMemo, useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { useImportDrivers, type ImportDriversOptions } from '@/shared/api/drivers';
import { ApiError } from '@/shared/api/errors';
import { parseCsv } from '@/shared/lib/csv';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;

/** `CreateDriverDto` columns every row must carry — the backend refuses the whole batch otherwise. */
const REQUIRED_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['username', 'username'],
  ['firstName', 'first name'],
  ['lastName', 'last name'],
  ['cdlNumber', 'licence number'],
];
const BOOLEAN_COLUMNS = new Set([
  'allowPersonalConveyance',
  'allowYardMove',
  'adverseDrivingEnabled',
  'shortHaulException',
  'splitSleeperEnabled',
  'eldExempt',
]);
const TEMPLATE_HEADER =
  'username,firstName,lastName,email,phone,cdlNumber,cdlState,homeTerminalName,homeTerminalTimezone';

type CsvRow = Record<string, unknown>;

/**
 * A CSV cell is always a string: `""` for a blank optional column failed `z.string().email()` /
 * `min(1)` server-side, and `"true"` never matched `z.boolean()`. Blank cells are dropped and the
 * HOS flag columns become booleans, so a row reaches `POST /drivers/import` in the DTO's shape.
 */
function toDriverRow(raw: CsvRow): CsvRow {
  const row: CsvRow = {};
  for (const [key, value] of Object.entries(raw)) {
    const text = typeof value === 'string' ? value.trim() : value;
    if (text === '' || text === undefined || text === null) continue;
    if (BOOLEAN_COLUMNS.has(key) && typeof text === 'string') {
      row[key] = /^(true|yes|y|1)$/i.test(text);
      continue;
    }
    row[key] = text;
  }
  return row;
}

interface ImportPlan {
  /** Rows that go to the server (blank cells dropped, default terminal applied). */
  payload: CsvRow[];
  /** CSV row index (0-based, header excluded) of each payload entry — maps `failed[].index` back. */
  sourceIndex: number[];
  warnings: string[];
  rowsNeedingAttention: number;
}

/**
 * Per-row checks. A row the backend would refuse (missing required column, missing CDL state, a
 * username already used earlier in the file) is **skipped** — one bad row used to sink the whole
 * batch with a bare 422. The design's "created as incomplete" wording is not what the API does.
 */
function planImport(parsed: CsvRow[], defaultTerminal: string): ImportPlan {
  const plan: ImportPlan = { payload: [], sourceIndex: [], warnings: [], rowsNeedingAttention: 0 };
  const emailCounts = new Map<string, number>();
  const seenUsernames = new Set<string>();
  const rows = parsed.map(toDriverRow);
  rows.forEach((row) => {
    const email = typeof row.email === 'string' ? row.email.toLowerCase() : '';
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  });
  rows.forEach((row, index) => {
    const line = index + 2;
    let attention = false;
    let skip = false;
    const email = typeof row.email === 'string' ? row.email.toLowerCase() : '';
    if (!email || (emailCounts.get(email) ?? 0) > 1) {
      plan.warnings.push(`Row ${line}  Missing or duplicate email — driver cannot sign in`);
      attention = true;
    }
    const missing = REQUIRED_COLUMNS.filter(([key]) => !row[key]).map(([, label]) => label);
    if (!row.homeTerminalName && !defaultTerminal) missing.push('home terminal');
    if (missing.length > 0) {
      plan.warnings.push(`Row ${line}  Missing ${missing.join(', ')} — will be skipped`);
      attention = true;
      skip = true;
    }
    if (!row.cdlState) {
      plan.warnings.push(`Row ${line}  Missing CDL issuing state — will be skipped`);
      attention = true;
      skip = true;
    }
    const username = typeof row.username === 'string' ? row.username.toLowerCase() : '';
    if (username && seenUsernames.has(username)) {
      plan.warnings.push(`Row ${line}  Duplicate username "${username}" — will be skipped`);
      attention = true;
      skip = true;
    }
    if (username) seenUsernames.add(username);
    if (attention) plan.rowsNeedingAttention += 1;
    if (skip) return;
    plan.payload.push(row.homeTerminalName ? row : { ...row, homeTerminalName: defaultTerminal });
    plan.sourceIndex.push(index);
  });
  return plan;
}

function downloadTemplate() {
  const blob = new Blob([`${TEMPLATE_HEADER}\n`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drivers-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportDriversModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Rows the server refused (`failed[]` of a 200, or the issues of a 422), as `Row N  reason`. */
  const [serverProblems, setServerProblems] = useState<string[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<NonNullable<ImportDriversOptions['duplicateStrategy']>>('SKIP');
  const [defaultHomeTerminalName, setDefaultHomeTerminalName] = useState('');
  const [sendInvitations, setSendInvitations] = useState(true);
  const [applyDefaultExemptions, setApplyDefaultExemptions] = useState(true);
  const mutation = useImportDrivers();
  // Row counts are rows, not warnings (a row can raise two), and follow the default terminal.
  const plan = useMemo(
    () => planImport(rows, defaultHomeTerminalName.trim()),
    [rows, defaultHomeTerminalName],
  );
  const { warnings, rowsNeedingAttention } = plan;

  function clearFile() {
    setFile(null);
    setRows([]);
    setServerProblems([]);
  }

  function handleFile(selected: File) {
    setError(null);
    setServerProblems([]);
    if (selected.size > MAX_BYTES) {
      setError('File is larger than 5 MB.');
      return;
    }
    selected.text().then((text) => {
      const parsed = parseCsv(text);
      if (parsed.length > MAX_ROWS) {
        setError(`File has ${parsed.length} rows — 500 rows maximum.`);
        clearFile();
        return;
      }
      setRows(parsed);
      setFile(selected);
    });
  }

  /** `drivers.3.cdlState` → `Row 5  cdlState: …` (CSV line = payload index → source row + 2). */
  function rowLabel(payloadIndex: number): string {
    return `Row ${(plan.sourceIndex[payloadIndex] ?? payloadIndex) + 2}`;
  }

  function submit() {
    setError(null);
    setServerProblems([]);
    mutation.mutate(
      {
        drivers: plan.payload,
        options: {
          duplicateStrategy,
          // Optional and typed — no Terminal table to pick from yet (backend D-090).
          defaultHomeTerminalName: defaultHomeTerminalName.trim() || undefined,
          sendInvitations,
          applyDefaultExemptions,
        },
      },
      {
        onSuccess: (summary) => {
          const total = summary.imported + summary.updated;
          toast({
            kind: summary.failed.length > 0 ? 'warning' : 'success',
            title: `${total} ${total === 1 ? 'driver' : 'drivers'} imported`,
            // `skipped` (existing usernames under "Skip existing") was never mentioned.
            description: `${summary.imported} created · ${summary.updated} updated · ${summary.skipped ?? 0} skipped · ${summary.failed.length} failed.`,
          });
          if (summary.failed.length === 0) {
            onClose();
            return;
          }
          // Keep the modal open on partial failure — the toast alone never said which rows.
          setServerProblems(summary.failed.map((f) => `${rowLabel(f.index)}  ${f.error}`));
        },
        onError: (err) => {
          const message = err instanceof ApiError ? err.userMessage : 'Something went wrong.';
          if (err instanceof ApiError) {
            const problems = Object.entries(err.fieldErrors).flatMap(([path, text]) => {
              const match = /^drivers\.(\d+)\.(.+)$/.exec(path);
              return match ? [`${rowLabel(Number(match[1]))}  ${match[2]}: ${text}`] : [];
            });
            setServerProblems(problems);
          }
          setError(message);
          toast({ kind: 'error', title: message });
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import drivers"
      subtitle="Bulk-create driver accounts from a CSV file"
      size="md"
      isDirty={Boolean(file)}
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="primary"
            size="lg"
            disabled={!file || plan.payload.length === 0}
            loading={mutation.isPending}
            onClick={submit}
          >
            {plan.payload.length > 0 ? `Import ${plan.payload.length} drivers` : 'Import drivers'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!file ? (
          // WB-192 — the zone said "Drop your CSV here" and handled no drop event at all.
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) handleFile(dropped);
            }}
            className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-center hover:bg-bg-subtle"
          >
            <Upload size={20} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />
            <span className="text-body text-text">Drop your CSV here or click to browse</span>
            <span className="text-caption text-text-muted">
              Up to 5 MB · one driver per row · 500 rows maximum
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <FileText size={20} strokeWidth={1.75} className="text-text-muted" />
            <div className="flex-1">
              <p className="text-body-strong text-text">{file.name}</p>
              <p className="text-caption text-text-muted">
                {(file.size / 1024).toFixed(0)} KB · {rows.length} rows detected ·{' '}
                {rows.length - rowsNeedingAttention} valid, {rowsNeedingAttention} need attention
              </p>
            </div>
            {warnings.length > 0 ? (
              <Badge tone="warning" dot>
                {warnings.length} warnings
              </Badge>
            ) : (
              <Badge tone="success" dot>
                Ready
              </Badge>
            )}
            <button
              type="button"
              aria-label="Remove file"
              onClick={() => {
                clearFile();
                // WB-193 — without this the same file re-selected fires no `change` event and the
                // modal stays empty.
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              <X size={16} strokeWidth={1.75} className="text-text-muted" />
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) handleFile(selected);
          }}
        />
        {error && <p className="text-body text-danger">{error}</p>}
        {serverProblems.length > 0 && (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-md bg-danger-soft p-3 text-body text-danger"
          >
            {serverProblems.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-warning-soft p-3 text-body text-warning">
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}
        {/* B-69 shipped — `ImportDriversOptionsDto` rides alongside the parsed rows. */}
        <fieldset className="flex flex-col gap-4" disabled={mutation.isPending}>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-label text-text">Duplicate handling</span>
              <select
                value={duplicateStrategy}
                onChange={(e) => setDuplicateStrategy(e.target.value as typeof duplicateStrategy)}
                className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
              >
                <option value="SKIP">Skip existing usernames</option>
                <option value="UPDATE">Update existing drivers</option>
                <option value="CREATE">Always create new</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label text-text">Default terminal</span>
              <input
                value={defaultHomeTerminalName}
                onChange={(e) => setDefaultHomeTerminalName(e.target.value)}
                placeholder="Optional"
                className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={sendInvitations}
              onChange={(e) => setSendInvitations(e.target.checked)}
            />
            Send app invitations after import — each driver receives an email with a one-time
            sign-in code
          </label>
          <label className="flex items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={applyDefaultExemptions}
              onChange={(e) => setApplyDefaultExemptions(e.target.checked)}
            />
            Apply default HOS exemptions — personal conveyance and yard move enabled
          </label>
        </fieldset>
        <div className="flex items-center justify-between rounded-md bg-info-soft px-3 py-2.5 text-body text-text-secondary">
          <span>Not sure about the format?</span>
          <Button variant="link" onClick={downloadTemplate}>
            Download CSV template
          </Button>
        </div>
      </div>
    </Modal>
  );
}
