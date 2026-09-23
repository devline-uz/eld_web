// owner: web-vehicles-drivers — 11.7 Import drivers (web/tz.md §11.7). Same mechanics as 11.6;
// SMS is never a channel (Q-2) — invitations always go by email, not the SMS wording in the design.
import { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { useImportDrivers } from '@/shared/api/drivers';
import { ApiError } from '@/shared/api/errors';
import { parseCsv } from '@/shared/lib/csv';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;

export function ImportDriversModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  // Rows carrying at least one warning — the row count the summary line quotes. It used to read
  // `rows.length - warnings.length` valid, which is not a row count at all (a row can raise two
  // warnings), so the "N valid" figure was fabricated.
  const [rowsNeedingAttention, setRowsNeedingAttention] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mutation = useImportDrivers();

  function handleFile(selected: File) {
    setError(null);
    if (selected.size > MAX_BYTES) {
      setError('File is larger than 5 MB.');
      return;
    }
    selected.text().then((text) => {
      const parsed = parseCsv(text);
      if (parsed.length > MAX_ROWS) {
        setError(`File has ${parsed.length} rows — 500 rows maximum.`);
        setFile(null);
        setRows([]);
        setWarnings([]);
        setRowsNeedingAttention(0);
        return;
      }
      const rowWarnings: string[] = [];
      const problemRows = new Set<number>();
      const emailCounts = new Map<string, number>();
      parsed.forEach((row) => {
        const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
        if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
      });
      parsed.forEach((row, index) => {
        const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
        const isDuplicate = email !== '' && (emailCounts.get(email) ?? 0) > 1;
        if (!email || isDuplicate) {
          rowWarnings.push(`Row ${index + 2}  Missing or duplicate email — driver cannot sign in`);
          problemRows.add(index);
        }
        if (!row.cdlState) {
          rowWarnings.push(`Row ${index + 2}  Missing CDL issuing state — driver will be created as incomplete`);
          problemRows.add(index);
        }
      });
      setRows(parsed);
      setWarnings(rowWarnings);
      setRowsNeedingAttention(problemRows.size);
      setFile(selected);
    });
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
            disabled={!file || rows.length === 0}
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { drivers: rows },
                {
                  onSuccess: (summary) => {
                    const total = summary.imported + summary.updated;
                    toast({
                      kind: 'success',
                      title: `${total} drivers imported`,
                      description: `${summary.imported} created · ${summary.updated} updated · ${summary.failed.length} failed.`,
                    });
                    onClose();
                  },
                  onError: (err) => {
                    const message = err instanceof ApiError ? err.userMessage : 'Something went wrong.';
                    setError(message);
                    toast({ kind: 'error', title: message });
                  },
                },
              )
            }
          >
            {rows.length > 0 ? `Import ${rows.length} drivers` : 'Import drivers'}
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
            <span className="text-caption text-text-muted">Up to 5 MB · one driver per row · 500 rows maximum</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <FileText size={20} strokeWidth={1.75} className="text-text-muted" />
            <div className="flex-1">
              <p className="text-body-strong text-text">{file.name}</p>
              <p className="text-caption text-text-muted">
                {(file.size / 1024).toFixed(0)} KB · {rows.length} rows detected · {rows.length - rowsNeedingAttention} valid,{' '}
                {rowsNeedingAttention} need attention
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
                setFile(null);
                setRows([]);
                setWarnings([]);
                setRowsNeedingAttention(0);
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
        {warnings.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-warning-soft p-3 text-body text-warning">
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}
        {/* `POST /drivers/import` takes the parsed rows and nothing else — it has no duplicate
            strategy, default terminal, invitation or exemption option (backend gap reported).
            The controls stay visible so the screen still matches the design, but they are
            disabled with the reason on screen rather than pretending to steer the import. */}
        <fieldset disabled className="flex flex-col gap-4 opacity-60">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-label text-text">Duplicate handling</span>
              <select className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text">
                <option>Skip existing usernames</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label text-text">Default terminal</span>
              <select className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text">
                <option>Columbus, OH</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-body text-text">
            <input type="checkbox" checked readOnly />
            Send app invitations after import — each driver receives an email with a one-time sign-in code
          </label>
          <label className="flex items-center gap-2 text-body text-text">
            <input type="checkbox" checked readOnly />
            Apply default HOS exemptions — personal conveyance and yard move enabled
          </label>
        </fieldset>
        <p className="text-caption text-text-muted">
          Import options are not available yet — the import endpoint applies the carrier defaults to every row.
        </p>
      </div>
    </Modal>
  );
}
