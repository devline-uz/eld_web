// owner: web-vehicles-drivers — 11.6 Import vehicles (web/tz.md §11.6). CSV ≤ 5 MB, whole file
// is one transaction, per-row errors shown, result toast is the exact §13.3 string.
import { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useImportVehicles, type ImportVehiclesOptions } from '@/shared/api/vehicles';
import { ApiError } from '@/shared/api/errors';
import { parseCsv, toCsv } from '@/shared/lib/csv';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;
const optionClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

/** The columns `POST /vehicles/import` reads — also the template's header row. */
const TEMPLATE_COLUMNS = ['unitNumber', 'vin', 'make', 'model', 'year', 'licensePlate', 'plateState', 'fuelType', 'odometerMi', 'notes'];

const IMPORT_TERMINALS = ['Columbus, OH', 'Raleigh, NC'];

export function ImportVehiclesModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<NonNullable<ImportVehiclesOptions['duplicateStrategy']>>('UPDATE_BY_VIN');
  const [defaultTerminal, setDefaultTerminal] = useState(IMPORT_TERMINALS[0]);
  const [pairDevices, setPairDevices] = useState(true);
  const [emailSummary, setEmailSummary] = useState(true);
  const mutation = useImportVehicles();

  function downloadTemplate() {
    // Built in the browser from the columns the endpoint reads — no `/vehicles/template` endpoint
    // exists, and inventing one would be worse than generating the two lines here.
    const blob = new Blob([toCsv([TEMPLATE_COLUMNS, ['201', '1FUJGLDR8LLLL0001', 'Freightliner', 'Cascadia', '2023', '', '', 'DIESEL', '', '']])], {
      type: 'text/csv',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'vehicles-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function handleFile(selected: File) {
    setError(null);
    if (selected.size > MAX_BYTES) {
      setError('File is larger than 5 MB.');
      return;
    }
    selected.text().then((text) => {
      const parsed = parseCsv(text);
      if (parsed.length > MAX_ROWS) {
        setError(`File has ${parsed.length} rows — 2,000 rows maximum.`);
        setFile(null);
        setRows([]);
        return;
      }
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
      // A staged file is a real edit — closing confirms first, from Cancel as from Esc / X.
      isDirty={file !== null}
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
                { vehicles: rows, options: { duplicateStrategy, defaultTerminal, pairDevices, emailSummary } },
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
            // WB — the drop copy was inert: dropping a file on the zone let the browser navigate
            // away to it. The zone now accepts the drop it advertises.
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) handleFile(dropped);
            }}
            className={`flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center hover:bg-bg-subtle ${
              dragOver ? 'border-primary bg-primary-soft' : 'border-border-strong'
            }`}
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
                {/* No client-side validation runs on these rows, so no "N valid, 0 errors"
                    claim is made here — the server answers with the per-row result. */}
                {(file.size / 1024).toFixed(0)} KB · {rows.length} rows detected
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
        {/* B-69 shipped — `ImportVehiclesOptionsDto` rides alongside the parsed rows. */}
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Duplicate handling</span>
            <select
              value={duplicateStrategy}
              onChange={(e) => setDuplicateStrategy(e.target.value as typeof duplicateStrategy)}
              className={optionClass}
            >
              <option value="UPDATE_BY_VIN">Update existing units by VIN</option>
              <option value="SKIP">Skip existing units</option>
              <option value="CREATE">Always create new</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">Default terminal</span>
            <select value={defaultTerminal} onChange={(e) => setDefaultTerminal(e.target.value)} className={optionClass}>
              {IMPORT_TERMINALS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={pairDevices} onChange={(e) => setPairDevices(e.target.checked)} />
          Pair ELD devices automatically — match the ELD serial column to unpaired devices
        </label>
        <label className="flex items-center gap-2 text-body text-text">
          <input type="checkbox" checked={emailSummary} onChange={(e) => setEmailSummary(e.target.checked)} />
          Send a summary email when the import finishes
        </label>
        <p className="text-caption text-text-muted">
          Not sure about the format?{' '}
          <button type="button" onClick={downloadTemplate} className="text-primary hover:underline">
            Download CSV template
          </button>
        </p>
      </div>
    </Modal>
  );
}
