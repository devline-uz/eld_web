// owner: web-settings-admin — 11.7-area "Create key" affordance inside W-22 Integrations.
// `integrations` FULL. The plaintext key is shown exactly once, per the backend contract.
import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Copy } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useCreateApiKey } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';

const SCOPE_OPTIONS = ['reports:read', 'vehicles:read', 'drivers:read', 'hos:read'] as const;

const createKeySchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.'),
});
type CreateKeyValues = z.infer<typeof createKeySchema>;

export function CreateApiKeyModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const createKey = useCreateApiKey();
  const [scopes, setScopes] = useState<string[]>(['reports:read']);
  const [plaintext, setPlaintext] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateKeyValues>({ resolver: zodResolver(createKeySchema), mode: 'onBlur', defaultValues: { name: '' } });

  function onSubmit(values: CreateKeyValues) {
    createKey.mutate(
      { name: values.name, scopes },
      {
        onSuccess: (result) => setPlaintext(result.plaintextKey),
        onError: (error) => toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
      },
    );
  }

  if (plaintext) {
    return (
      <Modal open onClose={onClose} title="Key created" subtitle="Copy this key now — it will not be shown again." size="sm" footer={<Button variant="primary" size="lg" onClick={onClose}>Done</Button>}>
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
      isDirty={isDirty}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Create key
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Name" required error={errors.name?.message}>
          <input {...register('name')} placeholder="McLeod TMS" disabled={isSubmitting} className={inputClass} />
        </Field>
        <div>
          <p className="mb-2 text-label text-text">Scopes</p>
          <div className="flex flex-col gap-2">
            {SCOPE_OPTIONS.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-body text-text">
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={(e) =>
                    setScopes((prev) => (e.target.checked ? [...prev, scope] : prev.filter((s) => s !== scope)))
                  }
                />
                {scope}
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
