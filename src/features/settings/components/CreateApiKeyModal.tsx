// owner: web-settings-admin — 11.7-area "Create key" affordance inside W-22 Integrations.
// `integrations` FULL. The plaintext key is shown exactly once, per the backend contract.
import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Copy } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';

import { useCreateApiKey } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import { placeServerFieldErrors, serverErrorBanner } from '../lib/serverFieldErrors';

const SCOPE_OPTIONS = ['reports:read', 'vehicles:read', 'drivers:read', 'hos:read'] as const;

/** `CreateApiKeyDto`: `name` 1–80, `scopes` at least one. */
const KEY_NAME_MAX = 80;
const createKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(KEY_NAME_MAX, `Name must be ${KEY_NAME_MAX} characters or fewer.`),
});
const NO_SCOPE_MESSAGE = 'Choose at least one scope.';
type CreateKeyValues = z.infer<typeof createKeySchema>;

export function CreateApiKeyModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const createKey = useCreateApiKey();
  const [scopes, setScopes] = useState<string[]>(['reports:read']);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [scopesError, setScopesError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<CreateKeyValues>({
    resolver: zodResolver(createKeySchema),
    mode: 'onBlur',
    defaultValues: { name: '' },
  });

  const submitting = createKey.isPending;
  // `scopes` lives outside react-hook-form.
  const dirty = isDirty || scopes.length !== 1 || scopes[0] !== 'reports:read';

  function onSubmit(values: CreateKeyValues) {
    // `mutate()` resolves RHF's `submitting` before the request lands — guard on the mutation
    // so a double click cannot mint two keys.
    if (submitting) return;
    // The DTO needs at least one scope — unticking all of them used to come back as a bare 422.
    if (scopes.length === 0) {
      setScopesError(NO_SCOPE_MESSAGE);
      return;
    }
    createKey.mutate(
      { name: values.name, scopes },
      {
        onSuccess: (result) => setPlaintext(result.plaintextKey),
        onError: (error) => {
          const placed = placeServerFieldErrors(error, { name: 'name', scopes: 'scopes' } as const, (field, message) => {
            if (field === 'name') setError('name', { message });
            else setScopesError(message);
          });
          const message = serverErrorBanner(error, placed);
          if (message !== null) toast({ kind: 'error', title: message });
        },
      },
    );
  }

  if (plaintext) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Key created"
        subtitle="Copy this key now — it will not be shown again."
        size="sm"
        footer={
          <Button variant="primary" size="lg" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="flex items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2">
          <code className="flex-1 truncate text-body">{plaintext}</code>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Copy size={14} strokeWidth={1.75} />}
            onClick={() => navigator.clipboard?.writeText(plaintext)}
          >
            Copy
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create key"
      size="sm"
      isDirty={dirty}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting}
            onClick={handleSubmit(onSubmit)}
          >
            Create key
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Name" required error={errors.name?.message}>
          <input
            {...register('name')}
            placeholder="McLeod TMS"
            disabled={submitting}
            className={inputClass}
          />
        </Field>
        <div>
          <p className="mb-2 text-label text-text">
            Scopes <span className="text-danger">*</span>
          </p>
          <div className="flex flex-col gap-2">
            {SCOPE_OPTIONS.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-body text-text">
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={(e) => {
                    setScopesError(null);
                    setScopes((prev) =>
                      e.target.checked ? [...prev, scope] : prev.filter((s) => s !== scope),
                    );
                  }}
                />
                {scope}
              </label>
            ))}
          </div>
          {scopesError && (
            <span role="alert" className="mt-1 block text-caption text-danger">
              {scopesError}
            </span>
          )}
        </div>
      </form>
    </Modal>
  );
}
