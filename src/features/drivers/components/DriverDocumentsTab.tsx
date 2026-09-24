// owner: web-vehicles-drivers — W-07 Driver profile, `Documents` tab (web/tz.md §10 W-07, gap
// B-94, shipped 2026-09-24). `GET /drivers/:id/documents` lists metadata + a short-lived presigned
// GET url; upload is metadata POST → presigned PUT of the bytes → refetch; delete is a real write.
// Writes gated on `drivers` FULL — a read-only viewer sees the list with no upload zone or row
// actions, matching §12.2 (in-card action buttons removed from the DOM).
import { useRef, useState } from 'react';
import { FileText, Upload, Trash2 } from 'lucide-react';
import { Can } from '@/shared/auth/Can';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { ConfirmDelete } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { formatLocal } from '@/shared/format/datetime';
import { ApiError } from '@/shared/api/errors';
import {
  useDriverDocuments,
  useUploadDriverDocument,
  useDeleteDriverDocument,
  DRIVER_DOCUMENT_CONTENT_TYPES,
  type DriverDocumentType,
} from '@/shared/api/drivers';

const MAX_BYTES = 5 * 1024 * 1024;

const TYPE_LABEL: Record<DriverDocumentType, string> = {
  CDL: 'CDL',
  MEDICAL_CARD: 'Medical card',
  MVR: 'MVR',
  OTHER: 'Other',
};

export function DriverDocumentsTab({ driverId }: { driverId: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<DriverDocumentType>('CDL');
  const [expiresAt, setExpiresAt] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docsQuery = useDriverDocuments(driverId);
  const upload = useUploadDriverDocument(driverId);
  const remove = useDeleteDriverDocument(driverId);

  function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError('File is larger than 5 MB.');
      return;
    }
    if (!(DRIVER_DOCUMENT_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      setError('Unsupported file type — PDF, JPEG, PNG, HEIC or WebP only.');
      return;
    }
    upload.mutate(
      { type: uploadType, file, expiresAt: expiresAt || undefined },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: `${file.name} uploaded` });
          setExpiresAt('');
          if (inputRef.current) inputRef.current.value = '';
        },
        onError: (err) => {
          const message = err instanceof ApiError ? err.userMessage : 'Something went wrong.';
          setError(message);
          toast({ kind: 'error', title: message });
        },
      },
    );
  }

  function runDelete() {
    if (!pendingDelete) return;
    remove.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast({ kind: 'success', title: `${pendingDelete.fileName} deleted` });
        setPendingDelete(null);
      },
      onError: (err) => {
        setPendingDelete(null);
        toast({ kind: 'error', title: err instanceof ApiError ? err.userMessage : 'Something went wrong.' });
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Can perm="drivers" level="FULL">
        <Card>
          <SectionHeader title="Upload document" subtitle="PDF, JPEG, PNG, HEIC or WebP · up to 5 MB" />
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-label text-text">Type</span>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as DriverDocumentType)}
                disabled={upload.isPending}
                className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
              >
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-label text-text">Expires on (optional)</span>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={upload.isPending}
                className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
              />
            </label>
            <Button
              variant="secondary"
              iconLeft={<Upload size={16} strokeWidth={1.75} />}
              loading={upload.isPending}
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={DRIVER_DOCUMENT_CONTENT_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFile(selected);
              }}
            />
          </div>
          {error && <p className="mt-2 text-body text-danger">{error}</p>}
        </Card>
      </Can>

      <Card padded={false}>
        <div className="p-card pb-0">
          <SectionHeader title="Documents" subtitle={docsQuery.data ? `${docsQuery.data.length} on file` : undefined} />
        </div>
        {docsQuery.isLoading ? (
          <LoadingState className="p-4" />
        ) : docsQuery.isError ? (
          <ErrorState onRetry={() => docsQuery.refetch()} />
        ) : (docsQuery.data?.length ?? 0) === 0 ? (
          <p className="p-4 text-body text-text-muted">No documents uploaded.</p>
        ) : (
          <table className="w-full text-body">
            <thead>
              <tr className="border-t border-border text-table-head text-text-muted">
                <th className="p-3 text-left font-semibold">FILE</th>
                <th className="p-3 text-left font-semibold">TYPE</th>
                <th className="p-3 text-left font-semibold">UPLOADED</th>
                <th className="p-3 text-left font-semibold">EXPIRES</th>
                <th className="p-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {docsQuery.data?.map((doc) => (
                <tr key={doc.id} className="border-t border-border">
                  <td className="p-3">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                      <FileText size={16} strokeWidth={1.75} />
                      {doc.fileName}
                    </a>
                  </td>
                  <td className="p-3">
                    <Badge tone="neutral">{TYPE_LABEL[doc.type]}</Badge>
                  </td>
                  <td className="p-3 tabular-nums">{formatLocal(doc.uploadedAt, 'shortDate')}</td>
                  <td className="p-3 tabular-nums">{doc.expiresAt ? formatLocal(doc.expiresAt, 'shortDate') : '—'}</td>
                  <td className="p-3 text-right">
                    <Can perm="drivers" level="FULL">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label={`Delete ${doc.fileName}`}
                        onClick={() => setPendingDelete({ id: doc.id, fileName: doc.fileName })}
                      >
                        <Trash2 size={16} strokeWidth={1.75} className="text-danger" />
                      </Button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDelete
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={runDelete}
        title={pendingDelete ? `Delete ${pendingDelete.fileName}?` : ''}
        description="This cannot be undone."
        loading={remove.isPending}
      />
    </div>
  );
}
