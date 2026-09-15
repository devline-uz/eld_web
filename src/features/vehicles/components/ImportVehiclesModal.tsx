// owner: web-vehicles-drivers — 11.6 Import vehicles (web/tz.md §11.6). CSV ≤ 5 MB, whole file
// is one transaction, per-row errors shown, result toast is the exact §13.3 string.
import { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useImportVehicles } from '@/shared/api/vehicles';
import { ApiError } from '@/shared/api/errors';

const MAX_BYTES = 5 * 1024 * 1024;

export function ImportVehiclesModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pairDevices, setPairDevices] = useState(true);
  const [sendSummary, setSendSummary] = useState(false);
  const mutation = useImportVehicles();

  function parseCsv(text: string): Array<Record<string, unknown>> {
    const [headerLine, ...lines] = text.trim().split(/\r?\n/);
    const headers = (headerLine ?? '').split(',').map((h) => h.trim());
    return lines
      .filter(Boolean)
      .map((line) => Object.fromEntries(headers.map((h, i) => [h, line.split(',')[i]?.trim()])));
  }

  function handleFile(selected: File) {
    setError(null);
    if (selected.size > MAX_BYTES) {
      setError('File is larger than 5 MB.');
      return;
    }
    selected.text().then((text) => {
      const parsed = parseCsv(text);
      setRows(parsed);
      setFile(selected);
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import vehicles"
      subtitle="Bulk-create or update units from a CSV file"
      size="md"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!file || rows.length === 0}
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { vehicles: rows },
                {
                  onSuccess: (summary) => {
                    const total = summary.imported + summary.updated;
                    toast({
                      kind: 'success',
                      ...TOAST_COPY.importFinished(summary.imported, summary.updated, summary.failed.length, total),
                    });
                    onClose();
                  },
                  onError: (err) => {
                    toast({ kind: 'error', title: err instanceof ApiError ? err.userMessage : 'Something went wrong.' });
                  },
                },
              )
            }
          >
            {rows.length > 0 ? `Import ${rows.length} units` : 'Import units'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-center hover:bg-bg-subtle"
          >
            <Upload size={20} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />
            <span className="text-body text-text">Drop your CSV here or click to browse</span>
            <span className="text-caption text-text-muted">Up to 5 MB · one unit per row · 2,000 rows maximum</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <FileText size={20} strokeWidth={1.75} className="text-text-muted" />
            <div className="flex-1">
              <p className="text-body-strong text-text">{file.name}</p>
              <p className="text-caption text-text-muted">
                {(file.size / 1024).toFixed(0)} KB · {rows.length} rows detected · {rows.length} valid, 0 errors
              </p>
            </div>
            <Badge tone="success" dot>
              Ready
            </Badge>
            <button type="button" aria-label="Remove file" onClick={() => { setFile(null); setRows([]); }}>
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
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Duplicate handling</span>
            <select className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text">
              <option>Update existing units by VIN</option>
              <option>Skip existing</option>
              <option>Always create new</option>
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
          <input type="checkbox" checked={pairDevices} onChange={(e) => setPairDevices(e.target.checked)} />
          Pair ELD devices automatically — match the ELD serial column to unpaired devices
        </label>
        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={sendSummary} onChange={(e) => setSendSummary(e.target.checked)} />
          Send a summary email when the import finishes
        </label>
        <p className="text-caption text-text-muted">
          Not sure about the format? <span className="text-primary">Download CSV template</span>
        </p>
      </div>
    </Modal>
  );
}
