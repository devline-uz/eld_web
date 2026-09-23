// owner: web-settings-admin — 11.21 New / edit / duplicate alert rule (web/tz.md §11.21).
// `alertRules` FULL.
// Q-2 — SMS is permanently disabled and is never put into the `channels` array; the backend
// rejects it with `422 CHANNEL_NOT_AVAILABLE` if it ever were sent.
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import {
  useCreateAlertRule,
  useUpdateAlertRule,
  type AlertRuleCondition,
  type AlertRuleRow,
  type AlertSeverity,
} from '@/shared/api/settingsAdmin';
import { Field, inputClass, ToggleRow } from './formKit';
import { SETTINGS_TOAST } from '../lib/copy';

// Validation comes from the shared `alertRuleFormSchema`, which matches `CreateAlertRuleDto` (WB-025).
import { alertRuleFormSchema, type AlertRuleFormValues } from '@/shared/forms/schemas';

const RECIPIENT_OPTIONS = ['Assigned fleet manager', 'Fleet managers', 'Dispatchers', 'Safety team'] as const;

/** The event vocabulary the rule engine evaluates (`conditions[].event`). */
const EVENT_OPTIONS: { value: string; label: string; minutesLabel?: string }[] = [
  { value: 'hos.break_due', label: '30-minute break is due', minutesLabel: 'within (minutes)' },
  { value: 'hos.violation', label: 'HOS violation recorded' },
  { value: 'device.offline', label: 'ELD stopped reporting', minutesLabel: 'for (minutes)' },
  { value: 'unidentified.created', label: 'Unassigned driving detected', minutesLabel: 'longer than (minutes)' },
  { value: 'maintenance.overdue', label: 'Maintenance is overdue' },
  { value: 'safety.harsh', label: 'Harsh driving event' },
  { value: 'geofence.exit', label: 'Unit left a geofence' },
];

const EVENT_BY_VALUE = new Map(EVENT_OPTIONS.map((o) => [o.value, o]));

/**
 * `Repeat` maps onto the real `throttle` field of `CreateAlertRuleDto`. A rule whose existing
 * throttle is not one of the three presets keeps it under `custom` rather than being silently
 * rewritten when the rule is edited.
 */
type RepeatKey = 'once-per-driver-per-day' | 'every-occurrence' | 'once-per-hour' | 'custom';
type Throttle = AlertRuleRow['throttle'];

const REPEAT_LABEL: Record<RepeatKey, string> = {
  'once-per-driver-per-day': 'Once per driver per day',
  'every-occurrence': 'Every occurrence',
  'once-per-hour': 'Once per hour',
  custom: 'Keep the current custom throttle',
};

function repeatOf(throttle: Throttle): RepeatKey {
  if (!throttle || (throttle.perDriverPerDay === undefined && throttle.cooldownMin === undefined)) {
    return 'every-occurrence';
  }
  if (throttle.perDriverPerDay === 1 && throttle.cooldownMin === undefined) return 'once-per-driver-per-day';
  if (throttle.cooldownMin === 60 && throttle.perDriverPerDay === undefined) return 'once-per-hour';
  return 'custom';
}

function throttleOf(repeat: RepeatKey, original: Throttle): Throttle {
  if (repeat === 'once-per-driver-per-day') return { perDriverPerDay: 1 };
  if (repeat === 'once-per-hour') return { cooldownMin: 60 };
  if (repeat === 'custom') return original;
  return undefined;
}

const DEFAULT_CONDITION: AlertRuleCondition = { event: 'hos.break_due', params: { minutes: 30 } };

/** The window the `Quiet hours` switch describes; an existing rule's own window is kept as-is. */
const DEFAULT_QUIET_HOURS = { from: '22:00', to: '06:00', timezone: 'local' };

export interface AlertRuleModalProps {
  onClose: () => void;
  /** `edit` patches this rule; `duplicate` seeds a new rule from it. */
  rule?: AlertRuleRow;
  mode?: 'create' | 'edit' | 'duplicate';
}

export function NewAlertRuleModal({ onClose, rule, mode = 'create' }: AlertRuleModalProps) {
  const { toast } = useToast();
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const editing = mode === 'edit' && rule !== undefined;

  const seededName = rule ? (mode === 'duplicate' ? `${rule.name} (copy)` : rule.name) : '';
  const seededRecipient =
    (rule?.recipients.roles ?? []).find((r): r is (typeof RECIPIENT_OPTIONS)[number] =>
      (RECIPIENT_OPTIONS as readonly string[]).includes(r),
    ) ?? 'Fleet managers';

  const [inApp, setInApp] = useState(rule ? rule.channels.includes('IN_APP') : true);
  const [email, setEmail] = useState(rule ? rule.channels.includes('EMAIL') : true);
  const [webhook, setWebhook] = useState(rule ? rule.channels.includes('WEBHOOK') : false);
  const [recipientRole, setRecipientRole] = useState<(typeof RECIPIENT_OPTIONS)[number]>(seededRecipient);
  const [quietHours, setQuietHours] = useState(rule ? Boolean(rule.quietHours) : true);
  const [enableNow, setEnableNow] = useState(rule ? rule.enabled : true);
  const [conditions, setConditions] = useState<AlertRuleCondition[]>(
    rule && rule.conditions.length > 0 ? rule.conditions : [DEFAULT_CONDITION],
  );
  const [repeat, setRepeat] = useState<RepeatKey>(repeatOf(rule?.throttle));
  const [conditionError, setConditionError] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AlertRuleFormValues>({
    resolver: zodResolver(alertRuleFormSchema),
    mode: 'onBlur',
    defaultValues: { name: seededName, severity: rule?.severity ?? 'WARNING' },
  });

  const submitting = createRule.isPending || updateRule.isPending;
  // Everything but name/severity lives outside react-hook-form.
  const dirty =
    isDirty ||
    inApp !== (rule ? rule.channels.includes('IN_APP') : true) ||
    email !== (rule ? rule.channels.includes('EMAIL') : true) ||
    webhook !== (rule ? rule.channels.includes('WEBHOOK') : false) ||
    recipientRole !== seededRecipient ||
    quietHours !== (rule ? Boolean(rule.quietHours) : true) ||
    enableNow !== (rule ? rule.enabled : true) ||
    repeat !== repeatOf(rule?.throttle) ||
    JSON.stringify(conditions) !== JSON.stringify(rule && rule.conditions.length > 0 ? rule.conditions : [DEFAULT_CONDITION]);

  function setConditionEvent(index: number, event: string) {
    setConditionError(null);
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const hasMinutes = Boolean(EVENT_BY_VALUE.get(event)?.minutesLabel);
        return hasMinutes ? { event, params: { minutes: Number(c.params?.minutes ?? 30) } } : { event };
      }),
    );
  }

  function setConditionMinutes(index: number, minutes: string) {
    const parsed = Number(minutes.replace(/\D/g, '').slice(0, 4));
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, params: { ...c.params, minutes: parsed } } : c)));
  }

  function addCondition() {
    setConditionError(null);
    const unused = EVENT_OPTIONS.find((o) => !conditions.some((c) => c.event === o.value)) ?? EVENT_OPTIONS[0]!;
    const hasMinutes = Boolean(unused.minutesLabel);
    setConditions((prev) => [...prev, hasMinutes ? { event: unused.value, params: { minutes: 30 } } : { event: unused.value }]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function onSubmit(values: AlertRuleFormValues) {
    // `mutate()` resolves RHF's `submitting` before the request lands — guard on the mutation
    // so a double click cannot create two rules.
    if (submitting) return;
    if (conditions.length === 0) {
      setConditionError('Add at least one condition.');
      return;
    }
    // A threshold of 0 (or an emptied field) would fire on every telemetry tick.
    const badMinutes = conditions.some(
      (c) => EVENT_BY_VALUE.get(c.event)?.minutesLabel && !(Number(c.params?.minutes) > 0),
    );
    if (badMinutes) {
      setConditionError('Enter a number of minutes greater than 0 for every condition.');
      return;
    }
    if (!inApp && !email && !webhook) {
      setChannelError('Choose at least one delivery channel.');
      return;
    }
    const channels: ('IN_APP' | 'EMAIL' | 'WEBHOOK')[] = [];
    if (inApp) channels.push('IN_APP');
    if (email) channels.push('EMAIL');
    if (webhook) channels.push('WEBHOOK');
    // Q-2 — SMS never reaches this array, regardless of any future UI state.

    const payload = {
      name: values.name,
      severity: values.severity as AlertSeverity,
      conditions,
      channels,
      recipients: { roles: [recipientRole] },
      throttle: throttleOf(repeat, rule?.throttle),
      // Editing a rule must not silently rewrite its own quiet-hours window to the default one.
      quietHours: quietHours ? (rule?.quietHours ?? DEFAULT_QUIET_HOURS) : undefined,
      enabled: enableNow,
    };

    const handlers = {
      onSuccess: () => {
        toast({
          kind: 'success' as const,
          ...(editing
            ? SETTINGS_TOAST.alertRuleUpdated
            : mode === 'duplicate'
              ? SETTINGS_TOAST.alertRuleDuplicated
              : SETTINGS_TOAST.alertRuleCreated),
        });
        onClose();
      },
      onError: (error: unknown) => {
        toast({ kind: 'error' as const, title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
      },
    };

    // `key` is the rule's stable identifier: it is minted on create only. Re-deriving it from an
    // edited name on PATCH would silently re-key the rule.
    if (editing) updateRule.mutate({ id: rule.id, dto: payload }, handlers);
    else createRule.mutate({ ...payload, key: values.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') }, handlers);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit alert rule' : mode === 'duplicate' ? 'Duplicate alert rule' : 'New alert rule'}
      subtitle="Alerts are evaluated against live ELD telemetry"
      size="lg"
      isDirty={dirty}
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-body text-text">
            <input type="checkbox" checked={enableNow} onChange={(e) => setEnableNow(e.target.checked)} />
            {editing ? 'Rule is enabled' : 'Enable the rule immediately'}
          </label>
          <ModalCancelButton disabled={submitting} />
          {/* ⛔ GAP B-9 — `POST /alert-rules/:id/test` does not exist on the live API; `Test rule`
              stays out of the DOM. */}
          <Button variant="primary" size="lg" loading={submitting} disabled={submitting} onClick={handleSubmit(onSubmit)}>
            {editing ? 'Save changes' : mode === 'duplicate' ? 'Create copy' : 'Create rule'}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rule name" required error={errors.name?.message}>
            <input {...register('name')} placeholder="Break required soon" disabled={submitting} className={inputClass} />
          </Field>
          <Field label="Severity" required>
            <select {...register('severity')} disabled={submitting} className={inputClass}>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
              <option value="INFO">Info</option>
            </select>
          </Field>
        </div>

        <div className="rounded-md border border-border p-4">
          <p className="mb-2 text-nav-section font-semibold uppercase tracking-wide text-text-muted">
            Conditions
          </p>
          <div className="flex flex-col gap-2">
            {conditions.map((condition, index) => {
              const option = EVENT_BY_VALUE.get(condition.event);
              return (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label={index === 0 ? 'When' : 'And when'}>
                      <select
                        value={condition.event}
                        aria-label={index === 0 ? 'Condition event' : `Condition ${index + 1} event`}
                        onChange={(e) => setConditionEvent(index, e.target.value)}
                        disabled={submitting}
                        className={inputClass}
                      >
                        {EVENT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                        {!option && <option value={condition.event}>{condition.event}</option>}
                      </select>
                    </Field>
                  </div>
                  {option?.minutesLabel && (
                    <div className="w-40">
                      <Field label={option.minutesLabel}>
                        <input
                          value={String(condition.params?.minutes ?? '')}
                          aria-label={`Condition ${index + 1} minutes`}
                          inputMode="numeric"
                          onChange={(e) => {
                            setConditionError(null);
                            setConditionMinutes(index, e.target.value);
                          }}
                          disabled={submitting}
                          className={`${inputClass} tabular-nums`}
                        />
                      </Field>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove condition ${index + 1}`}
                    disabled={conditions.length <= 1 || submitting}
                    onClick={() => removeCondition(index)}
                    className="mb-0.5 flex h-input w-10 items-center justify-center rounded-md border border-border text-text-muted hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
          {conditionError && (
            <span role="alert" className="mt-2 block text-caption text-danger">
              {conditionError}
            </span>
          )}
          <button
            type="button"
            onClick={addCondition}
            disabled={submitting}
            className="mt-3 rounded-md border border-dashed border-border px-3 py-1.5 text-caption text-text-secondary hover:bg-bg-subtle disabled:cursor-not-allowed"
          >
            + Add a condition
          </button>
        </div>

        <div>
          <p className="mb-2 text-nav-section font-semibold uppercase tracking-wide text-text-muted">Delivery</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={inApp}
                disabled={submitting}
                onChange={(e) => {
                  setChannelError(null);
                  setInApp(e.target.checked);
                }}
              />
              In-app
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={email}
                disabled={submitting}
                onChange={(e) => {
                  setChannelError(null);
                  setEmail(e.target.checked);
                }}
              />
              Email
            </label>
            {/* Q-2 — permanently disabled; SMS never enters the channels array. */}
            <label className="flex items-center gap-2 text-body text-text-muted" title="SMS is not available">
              <input type="checkbox" checked={false} disabled />
              SMS
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={webhook}
                disabled={submitting}
                onChange={(e) => {
                  setChannelError(null);
                  setWebhook(e.target.checked);
                }}
              />
              Webhook
            </label>
          </div>
          {channelError && (
            <span role="alert" className="mt-2 block text-caption text-danger">
              {channelError}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Recipients">
            <select value={recipientRole} onChange={(e) => setRecipientRole(e.target.value as typeof recipientRole)} disabled={submitting} className={inputClass}>
              {RECIPIENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Repeat">
            <select
              value={repeat}
              aria-label="Repeat"
              onChange={(e) => setRepeat(e.target.value as RepeatKey)}
              disabled={submitting}
              className={inputClass}
            >
              <option value="once-per-driver-per-day">{REPEAT_LABEL['once-per-driver-per-day']}</option>
              <option value="every-occurrence">{REPEAT_LABEL['every-occurrence']}</option>
              <option value="once-per-hour">{REPEAT_LABEL['once-per-hour']}</option>
              {repeatOf(rule?.throttle) === 'custom' && <option value="custom">{REPEAT_LABEL.custom}</option>}
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
