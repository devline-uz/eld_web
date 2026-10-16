// owner: web-settings-admin — 11.21 New / edit / duplicate alert rule (web/tz.md §11.21).
// `alertRules` FULL.
// Q-2 — SMS is permanently disabled and is never put into the `channels` array; the backend
// rejects it with `422 CHANNEL_NOT_AVAILABLE` if it ever were sent.
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import {
  useCreateAlertRule,
  useUpdateAlertRule,
  type AlertRuleCondition,
  type AlertRuleRow,
  type AlertSeverity,
  type CreateAlertRulePayload,
} from '@/shared/api/settingsAdmin';
import { ApiError } from '@/shared/api/errors';
import { Field, inputClass, ToggleRow } from './formKit';
import { SETTINGS_TOAST } from '../lib/copy';
import { placeServerFieldErrors, serverErrorBanner } from '../lib/serverFieldErrors';

// Validation comes from the shared `alertRuleFormSchema`, which matches `CreateAlertRuleDto` (WB-025).
import { alertRuleFormSchema, type AlertRuleFormValues } from '@/shared/forms/schemas';
import { EVENT_BY_VALUE, EVENT_OPTIONS } from '../lib/alertConditions';
import {
  DEFAULT_RECIPIENT_ROLES,
  normalizeRecipientRoles,
  RECIPIENT_ROLE_OPTIONS,
  recipientRoleLabel,
} from '../lib/alertRecipients';

/** Server issue path → where this modal shows it; the rest is spelled out in the banner. */
const SERVER_FIELDS = {
  name: 'name',
  key: 'name',
  conditions: 'conditions',
  channels: 'channels',
} as const;
const FIELD_LABELS = {
  recipients: 'Recipients',
  throttle: 'Repeat',
  quietHours: 'Quiet hours',
  severity: 'Severity',
};
/** `CreateAlertRuleDto.key` is `max(100)` while the name allows 200. */
const RULE_KEY_MAX = 100;

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
  if (throttle.perDriverPerDay === 1 && throttle.cooldownMin === undefined)
    return 'once-per-driver-per-day';
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

type RulePayload = Omit<CreateAlertRulePayload, 'key'>;

/**
 * F3-02 — an edit PATCHes only what changed. `conditions` is never sent for a system rule (the
 * API answers 422 to it even when unchanged), and untouched fields are not re-sent.
 */
function changedFields(payload: RulePayload, rule: AlertRuleRow): Partial<RulePayload> {
  const dto: Partial<RulePayload> = {};
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if (payload.name !== rule.name) dto.name = payload.name;
  if (payload.severity !== rule.severity) dto.severity = payload.severity;
  if (!rule.isSystem && !same(payload.conditions, rule.conditions)) dto.conditions = payload.conditions;
  if (!same(payload.channels, rule.channels)) dto.channels = payload.channels;
  if (!same(payload.recipients.roles, rule.recipients.roles)) dto.recipients = payload.recipients;
  if (!same(payload.throttle, rule.throttle)) dto.throttle = payload.throttle;
  if (!same(payload.quietHours, rule.quietHours)) dto.quietHours = payload.quietHours;
  if (payload.enabled !== rule.enabled) dto.enabled = payload.enabled;
  return dto;
}

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
  // F3-02 — the API refuses any `conditions` on a system rule (422); they are read-only here.
  const systemRule = editing && rule.isSystem === true;

  const seededName = rule ? (mode === 'duplicate' ? `${rule.name} (copy)` : rule.name) : '';
  // F3-01 — role keys (legacy stored labels are mapped to them), never display labels.
  const storedRoles = rule
    ? normalizeRecipientRoles(rule.recipients.roles)
    : DEFAULT_RECIPIENT_ROLES;
  // A stored role the checkboxes do not offer (SUPER_ADMIN, a custom role) stays visible and kept.
  const roleOptions = [
    ...RECIPIENT_ROLE_OPTIONS,
    ...storedRoles
      .filter((key) => !RECIPIENT_ROLE_OPTIONS.some((o) => o.key === key))
      .map((key) => ({ key, label: recipientRoleLabel(key) })),
  ];
  // In option order, so an untouched edit compares equal to what the checkboxes hold.
  const seededRoles = roleOptions.map((o) => o.key).filter((k) => storedRoles.includes(k));
  const otherRecipients = Boolean(
    rule?.recipients.userIds?.length ||
    rule?.recipients.driverIds?.length ||
    rule?.recipients.subjectDriver,
  );

  const [inApp, setInApp] = useState(rule ? rule.channels.includes('IN_APP') : true);
  const [email, setEmail] = useState(rule ? rule.channels.includes('EMAIL') : true);
  const [webhook, setWebhook] = useState(rule ? rule.channels.includes('WEBHOOK') : false);
  const [recipientRoles, setRecipientRoles] = useState<string[]>(seededRoles);
  const [quietHours, setQuietHours] = useState(rule ? Boolean(rule.quietHours) : true);
  const [enableNow, setEnableNow] = useState(rule ? rule.enabled : true);
  const [conditions, setConditions] = useState<AlertRuleCondition[]>(
    rule && rule.conditions.length > 0 ? rule.conditions : [DEFAULT_CONDITION],
  );
  const [repeat, setRepeat] = useState<RepeatKey>(repeatOf(rule?.throttle));
  const [conditionError, setConditionError] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  // A server refusal the fields cannot show — top of this `lg` modal, scrolled into view.
  const [banner, setBanner] = useState<string | null>(null);
  const bannerRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (banner) bannerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [banner]);

  const {
    register,
    handleSubmit,
    setError,
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
    JSON.stringify(recipientRoles) !== JSON.stringify(seededRoles) ||
    quietHours !== (rule ? Boolean(rule.quietHours) : true) ||
    enableNow !== (rule ? rule.enabled : true) ||
    repeat !== repeatOf(rule?.throttle) ||
    JSON.stringify(conditions) !==
      JSON.stringify(rule && rule.conditions.length > 0 ? rule.conditions : [DEFAULT_CONDITION]);

  function setConditionEvent(index: number, event: string) {
    setConditionError(null);
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const hasMinutes = Boolean(EVENT_BY_VALUE.get(event)?.minutesLabel);
        return hasMinutes
          ? { event, params: { minutes: Number(c.params?.minutes ?? 30) } }
          : { event };
      }),
    );
  }

  function setConditionMinutes(index: number, minutes: string) {
    const parsed = Number(minutes.replace(/\D/g, '').slice(0, 4));
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, params: { ...c.params, minutes: parsed } } : c)),
    );
  }

  function addCondition() {
    setConditionError(null);
    const unused =
      EVENT_OPTIONS.find((o) => !conditions.some((c) => c.event === o.value)) ?? EVENT_OPTIONS[0]!;
    const hasMinutes = Boolean(unused.minutesLabel);
    setConditions((prev) => [
      ...prev,
      hasMinutes ? { event: unused.value, params: { minutes: 30 } } : { event: unused.value },
    ]);
  }

  function toggleRecipientRole(key: string, checked: boolean) {
    setRecipientError(null);
    // Kept in option order so an untouched edit compares equal to the seeded list.
    setRecipientRoles((prev) =>
      roleOptions.map((o) => o.key).filter((k) => (k === key ? checked : prev.includes(k))),
    );
  }

  function removeCondition(index: number) {
    setConditions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function onSubmit(values: AlertRuleFormValues) {
    // `mutate()` resolves RHF's `submitting` before the request lands — guard on the mutation
    // so a double click cannot create two rules.
    if (submitting) return;
    setBanner(null);
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
    if (recipientRoles.length === 0 && !otherRecipients) {
      setRecipientError('Choose at least one recipient.');
      return;
    }
    const channels: ('IN_APP' | 'EMAIL' | 'WEBHOOK')[] = [];
    if (inApp) channels.push('IN_APP');
    if (email) channels.push('EMAIL');
    if (webhook) channels.push('WEBHOOK');
    // Q-2 — SMS never reaches this array, regardless of any future UI state.

    const payload: RulePayload = {
      name: values.name,
      severity: values.severity as AlertSeverity,
      conditions,
      channels,
      // Users, drivers and the subject driver the form does not edit are kept as they are.
      recipients: {
        ...rule?.recipients,
        roles: recipientRoles.length > 0 ? recipientRoles : undefined,
      },
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
        // A 422 used to be one generic toast — nothing marked, nothing said about which part.
        const placed = placeServerFieldErrors(error, SERVER_FIELDS, (field, message) => {
          if (field === 'name') setError('name', { message });
          else if (field === 'conditions') setConditionError(message);
          else setChannelError(message);
        });
        const message = serverErrorBanner(error, placed, FIELD_LABELS);
        if (message === null) return;
        setBanner(message);
        // A validation issue stays in the banner; any other failure is also a toast (§13.3).
        if (!(error instanceof ApiError && (error.status === 400 || error.status === 422))) {
          toast({ kind: 'error' as const, title: message });
        }
      },
    };

    // `key` is the rule's stable identifier: it is minted on create only. Re-deriving it from an
    // edited name on PATCH would silently re-key the rule.
    if (editing) updateRule.mutate({ id: rule.id, dto: changedFields(payload, rule) }, handlers);
    else
      createRule.mutate(
        {
          ...payload,
          key: values.name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .slice(0, RULE_KEY_MAX),
        },
        handlers,
      );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        editing
          ? 'Edit alert rule'
          : mode === 'duplicate'
            ? 'Duplicate alert rule'
            : 'New alert rule'
      }
      subtitle="Alerts are evaluated against live ELD telemetry"
      size="lg"
      isDirty={dirty}
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-body text-text">
            <input
              type="checkbox"
              checked={enableNow}
              onChange={(e) => setEnableNow(e.target.checked)}
            />
            {editing ? 'Rule is enabled' : 'Enable the rule immediately'}
          </label>
          <ModalCancelButton disabled={submitting} />
          {/* ⛔ GAP B-9 — `POST /alert-rules/:id/test` does not exist on the live API; `Test rule`
              stays out of the DOM. */}
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting}
            onClick={handleSubmit(onSubmit)}
          >
            {editing ? 'Save changes' : mode === 'duplicate' ? 'Create copy' : 'Create rule'}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        {banner && (
          <p ref={bannerRef} role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {banner}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rule name" required error={errors.name?.message}>
            <input
              {...register('name')}
              placeholder="Break required soon"
              disabled={submitting}
              className={inputClass}
            />
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
                        aria-label={
                          index === 0 ? 'Condition event' : `Condition ${index + 1} event`
                        }
                        onChange={(e) => setConditionEvent(index, e.target.value)}
                        disabled={submitting || systemRule}
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
                          disabled={submitting || systemRule}
                          className={`${inputClass} tabular-nums`}
                        />
                      </Field>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove condition ${index + 1}`}
                    disabled={conditions.length <= 1 || submitting || systemRule}
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
          {systemRule && (
            <p className="mt-2 text-caption text-text-muted">
              System rule conditions are fixed. Duplicate the rule to change them.
            </p>
          )}
          <button
            type="button"
            onClick={addCondition}
            disabled={submitting || systemRule}
            className="mt-3 rounded-md border border-dashed border-border px-3 py-1.5 text-caption text-text-secondary hover:bg-bg-subtle disabled:cursor-not-allowed"
          >
            + Add a condition
          </button>
        </div>

        <div>
          <p className="mb-2 text-nav-section font-semibold uppercase tracking-wide text-text-muted">
            Delivery
          </p>
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
            <label
              className="flex items-center gap-2 text-body text-text-muted"
              title="SMS is not available"
            >
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1 text-label text-text">Recipients</legend>
            <div className="flex flex-col gap-2">
              {roleOptions.map((o) => (
                <label key={o.key} className="flex items-center gap-2 text-body text-text">
                  <input
                    type="checkbox"
                    checked={recipientRoles.includes(o.key)}
                    disabled={submitting}
                    onChange={(e) => toggleRecipientRole(o.key, e.target.checked)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {recipientError && (
              <span role="alert" className="mt-2 block text-caption text-danger">
                {recipientError}
              </span>
            )}
          </fieldset>
          <Field label="Repeat">
            <select
              value={repeat}
              aria-label="Repeat"
              onChange={(e) => setRepeat(e.target.value as RepeatKey)}
              disabled={submitting}
              className={inputClass}
            >
              <option value="once-per-driver-per-day">
                {REPEAT_LABEL['once-per-driver-per-day']}
              </option>
              <option value="every-occurrence">{REPEAT_LABEL['every-occurrence']}</option>
              <option value="once-per-hour">{REPEAT_LABEL['once-per-hour']}</option>
              {repeatOf(rule?.throttle) === 'custom' && (
                <option value="custom">{REPEAT_LABEL.custom}</option>
              )}
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
