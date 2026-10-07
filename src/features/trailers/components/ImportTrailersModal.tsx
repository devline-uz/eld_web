// owner: web-vehicles-drivers — Import trailers (CSV ≤ 5 MB → `POST /trailers/import`, upsert by `number`).
import { useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { useImportTrailers } from '@/shared/api/trailers';
import { ApiError } from '@/shared/api/errors';
import { parseCsv, toCsv } from '@/shared/lib/csv';
import { importIssues } from '../lib/importIssues';
import { toTrailerPayloads } from '../lib/trailerRows';

const MAX_BYTES = 5 * 1024 * 1024;
/** `ImportTrailersDto.trailers` is `.max(1000)`. */
const MAX_ROWS = 1000;

export function ImportTrailersModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const mutation = useImportTrailers();

  function downloadTemplate() {
    const blob = new Blob([toCsv([['number', 'vin'], ['T-5001', '1JJV532W7YL123456']])], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'trailers-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function reset() {
    setFile(null);
    setRows([]);
    setError(null);
  }

  function handleFile(selected: File) {
    setError(null);
    if (selected.size > MAX_BYTES) {
      setError('File is larger than 5 MB.');
      return;
    }
    void selected.text().then((text) => {
      const parsed = parseCsv(text);
      if (parsed.length > MAX_ROWS) {
        reset();
        setError(`File has ${parsed.length} rows — 1,000 rows maximum.`);
        return;
      }
      if (parsed.length > 0 && !('number' in parsed[0]!)) {
        reset();
        setError('The file needs a "number" column. Download the CSV template for the format.');
        return;
      }
      setRows(parsed);
      setFile(selected);
    });
  }

  function submit() {
    mutation.mutate(
      { trailers: toTrailerPayloads(rows) },
      {
        onSuccess: (summary) => {
          const failed = summary.failed.length;
          toast({
            kind: failed > 0 ? 'error' : 'success',
            ...TOAST_COPY.trailersImported(summary.imported, summary.updated, failed, summary.imported + summary.updated),
          });
          if (failed === 0) {
            onClose();
            return;
          }
          // The import is not transactional on the server: the good rows are already saved, so the
          // failed ones stay visible next to the file instead of vanishing with the toast.
          setError(
            `Not imported — ${summary.failed
              .slice(0, 5)
              .map((f) => `Row ${f.index + 1}: ${f.error}`)
              .join(' · ')}`,
          );
        },
        onError: (err) => {
          const rowIssues = err instanceof ApiError ? importIssues(err) : [];
          if (rowIssues.length > 0) {
            setError(`The file was not imported. ${rowIssues.join(' · ')}`);
            return;
          }
          toast({ kind: 'error', title: err instanceof ApiError ? err.userMessage : 'Something went wrong.' });
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import trailers"
      subtitle="Bulk-create or update trailers from a CSV file"
      size="md"
      isDirty={file !== null && !mutation.isSuccess}
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button variant="primary" size="lg" disabled={!file || rows.length === 0} loading={mutation.isPending} onClick={submit}>
            {rows.length > 0 ? `Import ${rows.length} trailer${rows.length === 1 ? '' : 's'}` : 'Import trailers'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
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
            <span className="text-caption text-text-muted">Up to 5 MB · one trailer per row · 1,000 rows maximum</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <FileText size={20} strokeWidth={1.75} className="text-text-muted" />
            <div className="flex-1">
              <p className="text-body-strong text-text">{file.name}</p>
              <p className="text-caption text-text-muted tabular-nums">
                {(file.size / 1024).toFixed(0)} KB · {rows.length} rows detected
              </p>
            </div>
            <Badge tone="success" dot>
              Ready
            </Badge>
            <button type="button" aria-label="Remove file" onClick={reset}>
              <X size={16} strokeWidth={1.75} className="text-text-muted" />
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          aria-label="Trailers CSV file"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) handleFile(selected);
          }}
        />
        {error && (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        )}
        <p className="text-caption text-text-muted">
          Existing trailers are matched by number and updated; new numbers are created.{' '}
          <button type="button" onClick={downloadTemplate} className="text-primary hover:underline">
            Download CSV template
          </button>
        </p>
      </div>
    </Modal>
  );
}
