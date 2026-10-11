// owner: web-settings-admin — W-22 Custom webhook connect / configure (WB-251). `integrations` FULL.
// Backend contract (`WebhooksService`, `webhook.processor.ts`): `config.url` is where events are
// POSTed, `config.secret` is the HMAC key for `X-OneBook-Signature`. `PUT /integrations/webhook`
// replaces the whole config and `GET` returns the secret redacted, so the secret is required on
// every save — including an edit — and the stored one is never shown.
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { fields } from '@/shared/forms';
import { useUpsertIntegration, type WebhookIntegrationConfig } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';
import { SETTINGS_TOAST, WEBHOOK_COPY } from '../lib/copy';
import { placeServerFieldErrors, serverErrorBanner } from '../lib/serverFieldErrors';

const webhookSchema = z.object({
  url: fields.webhookUrl(),
  secret: fields.webhookSecret(),
});
type WebhookFormValues = z.infer<typeof webhookSchema>;

/** 422 `details` paths the form can show under a field (the DTO nests them under `config`). */
const FIELD_BY_PATH: Record<string, keyof WebhookFormValues> = {
  url: 'url',
  'config.url': 'url',
  secret: 'secret',
  'config.secret': 'secret',
};

/** 32 random bytes as hex — a 256-bit HMAC key. */
function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function WebhookConfigModal({
  mode,
  name,
  initialUrl = '',
  onClose,
}: {
  mode: 'connect' | 'configure';
  /** The catalogue name, for the success toast. */
  name: string;
  initialUrl?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const upsert = useUpsertIntegration();
  const [showSecret, setShowSecret] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const bannerRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (banner) bannerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [banner]);
  const submitting = upsert.isPending;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { url: initialUrl, secret: '' },
  });

  function onGenerate() {
    setValue('secret', generateWebhookSecret(), { shouldDirty: true, shouldValidate: true });
    // The user has to copy it into their endpoint, so a generated secret is shown.
    setShowSecret(true);
  }

  function onSubmit(values: WebhookFormValues) {
    if (submitting) return;
    setBanner(null);
    const config: WebhookIntegrationConfig = { url: values.url, secret: values.secret };
    upsert.mutate(
      { provider: 'webhook', dto: { enabled: true, config: { ...config } } },
      {
        onSuccess: () => {
          toast({
            kind: 'success',
            ...(mode === 'connect'
              ? SETTINGS_TOAST.integrationConnected(name)
              : SETTINGS_TOAST.webhookUpdated),
          });
          onClose();
        },
        onError: (error) => {
          const placed = placeServerFieldErrors(error, FIELD_BY_PATH, (field, msg) =>
            setError(field, { message: msg }),
          );
          // `null` — every issue is under its field. Unplaced issues are spelled out with their
          // field name instead of a bare message (or the generic "Check the highlighted fields").
          const message = serverErrorBanner(error, placed, { config: 'Configuration', enabled: 'Enabled' });
          if (message === null) return;
          setBanner(message);
          if (error instanceof ApiError && (error.status === 400 || error.status === 422)) return;
          toast({ kind: 'error', title: message });
        },
      },
    );
  }

  const secretError = errors.secret?.message;

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'connect' ? WEBHOOK_COPY.connectTitle : WEBHOOK_COPY.configureTitle}
      subtitle={WEBHOOK_COPY.subtitle}
      size="md"
      isDirty={isDirty}
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
            {mode === 'connect' ? WEBHOOK_COPY.connectSubmit : WEBHOOK_COPY.configureSubmit}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {banner && (
          <p ref={bannerRef} role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {banner}
          </p>
        )}
        <Field
          label={WEBHOOK_COPY.urlLabel}
          required
          error={errors.url?.message}
          hint={WEBHOOK_COPY.urlHint}
        >
          <input
            {...register('url')}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder={WEBHOOK_COPY.urlPlaceholder}
            disabled={submitting}
            aria-invalid={Boolean(errors.url)}
            className={inputClass}
          />
        </Field>
        {/* Not `<Field>`: the show/hide and Generate buttons would join the label's accessible
            name if nested inside a `<label>` (same reason as AddDriverModal's password). */}
        <div className="flex flex-col gap-1">
          <label className="text-label text-text" htmlFor="webhook-secret">
            {WEBHOOK_COPY.secretLabel}{' '}
            <span className="text-danger" aria-hidden="true">
              *
            </span>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id="webhook-secret"
                type={showSecret ? 'text' : 'password'}
                {...register('secret')}
                autoComplete="new-password"
                spellCheck={false}
                disabled={submitting}
                aria-invalid={Boolean(secretError)}
                aria-describedby={
                  secretError ? 'webhook-secret-error webhook-secret-help' : 'webhook-secret-help'
                }
                className={`${inputClass} w-full pr-9 font-mono`}
              />
              <button
                type="button"
                aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle"
              >
                {showSecret ? (
                  <EyeOff size={16} strokeWidth={1.75} />
                ) : (
                  <Eye size={16} strokeWidth={1.75} />
                )}
              </button>
            </div>
            <Button
              variant="secondary"
              iconLeft={<RefreshCw size={14} strokeWidth={1.75} />}
              onClick={onGenerate}
              disabled={submitting}
            >
              {WEBHOOK_COPY.generate}
            </Button>
          </div>
          {secretError && (
            <span id="webhook-secret-error" role="alert" className="text-caption text-danger">
              {secretError}
            </span>
          )}
          {/* On `Configure` the hint stays visible next to an error: it is why the field is required. */}
          <span id="webhook-secret-help" className="text-caption text-text-muted">
            {mode === 'configure' ? WEBHOOK_COPY.secretEditHint : WEBHOOK_COPY.secretHint}
          </span>
        </div>
      </form>
    </Modal>
  );
}
