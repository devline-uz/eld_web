// owner: web-settings-admin — 11.21 New alert rule (web/tz.md §11.21). `alertRules` FULL.
// Q-2 — SMS is permanently disabled and is never put into the `channels` array; the backend
// rejects it with `422 CHANNEL_NOT_AVAILABLE` if it ever were sent.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useCreateAlertRule, type AlertSeverity } from '@/shared/api/settingsAdmin';
import { Field, inputClass, ToggleRow } from './formKit';

// Validation comes from the shared `alertRuleFormSchema`, which matches `CreateAlertRuleDto` (WB-025).
import { alertRuleFormSchema, type AlertRuleFormValues } from '@/shared/forms/schemas';

const RECIPIENT_OPTIONS = ['Assigned fleet manager', 'Fleet managers', 'Dispatchers', 'Safety team'] as const;

export function NewAlertRuleModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const createRule = useCreateAlertRule();
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(true);
  const [webhook, setWebhook] = useState(false);
  const [recipientRole, setRecipientRole] = useState<(typeof RECIPIENT_OPTIONS)[number]>('Fleet managers');
  const [quietHours, setQuietHours] = useState(true);
  const [enableNow, setEnableNow] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AlertRuleFormValues>({
    resolver: zodResolver(alertRuleFormSchema),
    mode: 'onBlur',
    defaultValues: { name: '', severity: 'WARNING' },
  });

  function onSubmit(values: AlertRuleFormValues) {
    const channels: ('IN_APP' | 'EMAIL' | 'WEBHOOK')[] = [];
    if (inApp) channels.push('IN_APP');
    if (email) channels.push('EMAIL');
    if (webhook) channels.push('WEBHOOK');
    // Q-2 — SMS never reaches this array, regardless of any future UI state.

    createRule.mutate(
      {
        key: values.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name: values.name,
        severity: values.severity as AlertSeverity,
        conditions: [{ event: 'custom_condition' }],
        channels,
        recipients: { roles: [recipientRole] },
        quietHours: quietHours ? { from: '22:00', to: '06:00', timezone: 'local' } : undefined,
        enabled: enableNow,
      },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: 'Alert rule created' });
          onClose();
        },
        onError: (error) => {
          toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New alert rule"
      subtitle="Alerts are evaluated against live ELD telemetry"
      size="lg"
      isDirty={isDirty}
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-body text-text">
            <input type="checkbox" checked={enableNow} onChange={(e) => setEnableNow(e.target.checked)} />
            Enable the rule immediately
          </label>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {/* ⛔ GAP B-9 — `POST /alert-rules/:id/test` needs an existing rule id and does not
              exist on the live API; `Test rule` stays out of the DOM in this create modal. */}
          <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Create rule
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rule name" required error={errors.name?.message}>
            <input {...register('name')} placeholder="Break required soon" disabled={isSubmitting} className={inputClass} />
          </Field>
          <Field label="Severity" required>
            <select {...register('severity')} disabled={isSubmitting} className={inputClass}>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
              <option value="INFO">Info</option>
            </select>
          </Field>
        </div>

        <div className="rounded-md border border-border p-4">
          <p className="mb-2 text-nav-section font-semibold uppercase tracking-wide text-text-muted">Condition</p>
          <p className="text-body text-text">
            When <span className="rounded border border-border px-2 py-0.5">30-minute break</span> is due within{' '}
            <span className="rounded border border-border px-2 py-0.5">30 minutes</span> for{' '}
            <span className="rounded border border-border px-2 py-0.5">any driver</span>
          </p>
          <p className="mt-2 text-body text-text">
            And <span className="rounded border border-border px-2 py-0.5">vehicle status</span> is{' '}
            <span className="rounded border border-border px-2 py-0.5">Driving</span>
          </p>
          <button type="button" className="mt-3 rounded-md border border-dashed border-border px-3 py-1.5 text-caption text-text-secondary">
            + Add a condition
          </button>
        </div>

        <div>
          <p className="mb-2 text-nav-section font-semibold uppercase tracking-wide text-text-muted">Delivery</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} />
              In-app
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              Email
            </label>
            {/* Q-2 — permanently disabled; SMS never enters the channels array. */}
            <label className="flex items-center gap-2 text-body text-text-muted" title="SMS is not available">
              <input type="checkbox" checked={false} disabled />
              SMS
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked={webhook} onChange={(e) => setWebhook(e.target.checked)} />
              Webhook
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Recipients">
            <select value={recipientRole} onChange={(e) => setRecipientRole(e.target.value as typeof recipientRole)} disabled={isSubmitting} className={inputClass}>
              {RECIPIENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Repeat">
            <select disabled={isSubmitting} className={inputClass} defaultValue="once-per-driver-per-day">
              <option value="once-per-driver-per-day">Once per driver per day</option>
              <option value="every-occurrence">Every occurrence</option>
              <option value="once-per-hour">Once per hour</option>
            </select>
          </Field>
        </div>

        <ToggleRow
          title="Quiet hours"
          description="Hold non-critical alerts between 22:00 and 06:00 local time"
          checked={quietHours}
          onChange={setQuietHours}
        />
      </form>
    </Modal>
  );
}
