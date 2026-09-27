// owner: web-settings-admin — W-22 Connect McLeod / WEX / Comdata / QuickBooks / Slack (WB-QA-S-01).
// `integrations` FULL. Same pattern as `WebhookConfigModal`: RHF + zod, 422 `details.issues`
// (`config.<key>`) mapped under the field, anything unmapped in a banner. Connect used to send
// `config: {}` and the backend stored the provider as CONNECTED with no credentials.
import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Info } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useUpsertIntegration } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import { SETTINGS_TOAST } from '../lib/copy';
import {
  CREDENTIAL_SPECS,
  credentialSchema,
  type CredentialField,
  type CredentialProvider,
} from '../lib/integrationCredentials';

type Values = Record<string, string>;

export function IntegrationCredentialsModal({
  provider,
  name,
  onClose,
}: {
  provider: CredentialProvider;
  /** The catalogue name, for the title and the success toast. */
  name: string;
  onClose: () => void;
}) {
  const spec = CREDENTIAL_SPECS[provider];
  const schema = useMemo(() => credentialSchema(spec), [spec]);
  const { toast } = useToast();
  const upsert = useUpsertIntegration();
  const [banner, setBanner] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const submitting = upsert.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: Object.fromEntries(spec.fields.map((f) => [f.key, ''])),
  });

  function onSubmit(values: Values) {
    if (submitting) return;
    setBanner(null);
    // Secrets are sent exactly as typed; plain fields are trimmed.
    const config = Object.fromEntries(
      spec.fields.map((f) => [f.key, f.kind === 'secret' ? values[f.key] : (values[f.key] ?? '').trim()]),
    );
    upsert.mutate(
      { provider, dto: { enabled: true, config } },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...SETTINGS_TOAST.integrationConnected(name) });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            const keys = new Set(spec.fields.map((f) => f.key));
            const unmapped: string[] = [];
            let mapped = 0;
            for (const [path, msg] of Object.entries(error.fieldErrors)) {
              const key = path.startsWith('config.') ? path.slice('config.'.length) : path;
              if (keys.has(key)) {
                setError(key, { message: msg });
                mapped += 1;
              } else unmapped.push(msg);
            }
            if (unmapped.length > 0) setBanner(unmapped.join(' '));
            if (mapped > 0 || unmapped.length > 0) return;
          }
          const message = error instanceof ApiError ? error.userMessage : 'Something went wrong.';
          setBanner(message);
          toast({ kind: 'error', title: message });
        },
      },
    );
  }

  function renderField(field: CredentialField) {
    const error = errors[field.key]?.message;
    if (field.kind !== 'secret') {
      return (
        <Field key={field.key} label={field.label} required error={error} hint={field.hint}>
          <input
            {...register(field.key)}
            type={field.kind === 'url' ? 'url' : 'text'}
            inputMode={field.kind === 'url' ? 'url' : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={field.placeholder}
            disabled={submitting}
            className={inputClass}
          />
        </Field>
      );
    }
    // Not `<Field>`: the show/hide button would join the label's accessible name.
    const id = `integration-${provider}-${field.key}`;
    const visible = Boolean(shown[field.key]);
    const describedBy = [error ? `${id}-error` : null, field.hint ? `${id}-help` : null].filter(Boolean).join(' ');
    return (
      <div key={field.key} className="flex flex-col gap-1">
        <label className="text-label text-text" htmlFor={id}>
          {field.label}{' '}
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        </label>
        <div className="relative">
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            {...register(field.key)}
            autoComplete="new-password"
            spellCheck={false}
            placeholder={field.placeholder}
            disabled={submitting}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy || undefined}
            className={`${inputClass} w-full pr-9 font-mono`}
          />
          <button
            type="button"
            aria-label={visible ? 'Hide secret' : 'Show secret'}
            onClick={() => setShown((s) => ({ ...s, [field.key]: !s[field.key] }))}
            className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle"
          >
            {visible ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
          </button>
        </div>
        {error && (
          <span id={`${id}-error`} role="alert" className="text-caption text-danger">
            {error}
          </span>
        )}
        {field.hint && (
          <span id={`${id}-help`} className="text-caption text-text-muted">
            {field.hint}
          </span>
        )}
      </div>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Connect ${name}`}
      subtitle={spec.subtitle}
      size="md"
      isDirty={isDirty}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button variant="primary" size="lg" loading={submitting} disabled={submitting} onClick={handleSubmit(onSubmit)}>
            Connect
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {banner && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {banner}
          </p>
        )}
        {spec.note && (
          <p className="flex items-start gap-2 rounded-md bg-bg-subtle px-3 py-2 text-caption text-text-secondary">
            <Info size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
            {spec.note}
          </p>
        )}
        {spec.fields.map(renderField)}
        <p className="text-caption text-text-muted">
          Keys and secrets are encrypted at rest and never shown again after you save.
        </p>
      </form>
    </Modal>
  );
}
