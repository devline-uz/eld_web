// owner: web-settings-admin — W-22 API keys row menu `Edit scopes`. `integrations` FULL.
// Real endpoint: `PATCH /api-keys/:id/scopes { scopes }`.
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useUpdateApiKeyScopes, type ApiKeyRow } from '@/shared/api/settingsAdmin';
import { SETTINGS_TOAST } from '../lib/copy';

/** The scope vocabulary the API accepts — the same list the create-key modal offers. */
const API_KEY_SCOPES: { value: string; label: string }[] = [
  { value: 'reports:read', label: 'Read reports' },
  { value: 'vehicles:read', label: 'Read vehicles' },
  { value: 'drivers:read', label: 'Read drivers' },
  { value: 'hos:read', label: 'Read HOS logs' },
];

export function EditApiKeyScopesModal({ apiKey, onClose }: { apiKey: ApiKeyRow; onClose: () => void }) {
  const { toast } = useToast();
  const updateScopes = useUpdateApiKeyScopes();
  const [scopes, setScopes] = useState<string[]>(apiKey.scopes);
  const [error, setError] = useState<string | null>(null);

  const submitting = updateScopes.isPending;
  const dirty = JSON.stringify([...scopes].sort()) !== JSON.stringify([...apiKey.scopes].sort());

  function toggle(value: string, checked: boolean) {
    setError(null);
    setScopes((prev) => (checked ? [...prev, value] : prev.filter((s) => s !== value)));
  }

  function submit() {
    if (submitting) return;
    if (scopes.length === 0) {
      setError('Choose at least one scope.');
      return;
    }
    if (!dirty) {
      onClose();
      return;
    }
    setError(null);
    updateScopes.mutate(
      { id: apiKey.id, scopes },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...SETTINGS_TOAST.apiKeyScopesUpdated(apiKey.name) });
          onClose();
        },
        onError: (err) => setError(err instanceof ApiError ? err.userMessage : 'Something went wrong.'),
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit scopes"
      subtitle={`${apiKey.name} · ${apiKey.prefix}••••••••`}
      size="sm"
      isDirty={dirty}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button variant="primary" size="lg" loading={submitting} disabled={submitting} onClick={submit}>
            Save scopes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {API_KEY_SCOPES.map((scope) => (
          <label key={scope.value} className="flex items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={scopes.includes(scope.value)}
              disabled={submitting}
              onChange={(e) => toggle(scope.value, e.target.checked)}
            />
            {scope.label} <span className="font-mono text-caption text-text-muted">{scope.value}</span>
          </label>
        ))}
        {/* A key may carry a scope granted before this list existed — never silently dropped. */}
        {scopes
          .filter((s) => !API_KEY_SCOPES.some((o) => o.value === s))
          .map((s) => (
            <label key={s} className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked disabled={submitting} onChange={(e) => toggle(s, e.target.checked)} />
              <span className="font-mono text-caption text-text-muted">{s}</span>
            </label>
          ))}
        {error && (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}
        <p className="text-caption text-text-muted">
          Every OneBook API key is read-only. Removing a scope takes effect on the next request.
        </p>
      </div>
    </Modal>
  );
}
