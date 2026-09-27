// owner: web-settings-admin — W-17 Settings · Company profile (web/tz.md §10 W-17).
// Design: web/roles and screens/admin panel/Settings — company profile and HOS ruleset.jpg
import { useState } from 'react';
import { z, type ZodTypeAny } from 'zod';
import { Check } from 'lucide-react';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { formatRelative } from '@/shared/format/relative';
import { usePermission } from '@/shared/auth/usePermission';
import { ApiError, errorMessage } from '@/shared/api/errors';
import { useCarrier, useUpdateCarrier, type CarrierRow, type HosRuleset } from '@/shared/api/settingsAdmin';
import { Field, inputClass, ToggleRow } from './components/formKit';
import { fields, inputFilters, LIMITS, US_STATES, VALIDATION_MESSAGES } from '@/shared/forms';
import { Select, type SelectOption } from '@/shared/ui/Select';
import {
  CARRIER_FIELD_LABELS,
  mapCarrierSaveError,
  toCarrierPatch,
  type CarrierFieldErrors,
  type CarrierFieldKey,
} from './lib/carrierErrors';
import { ConfirmDelete } from '@/shared/ui/Modal';
import { usePageHeader } from '@/app/layouts/Topbar';

const HOS_RULESETS: { value: HosRuleset; label: string }[] = [
  { value: 'US_70_8_PROPERTY', label: 'US 70 hr / 8 day — Property carrying' },
  { value: 'US_60_7_PROPERTY', label: 'US 60 hr / 7 day — Property carrying' },
  { value: 'US_70_8_PASSENGER', label: 'US 70 hr / 8 day — Passenger carrying' },
  { value: 'US_60_7_PASSENGER', label: 'US 60 hr / 7 day — Passenger carrying' },
];

const STATE_OPTIONS: SelectOption[] = US_STATES.map((code) => ({ value: code, label: code }));

type TextKey = 'name' | 'dotNumber' | 'mcNumber' | 'ein' | 'phone' | 'complianceEmail' | 'addressLine1' | 'city' | 'state' | 'zip';

/** Toggles have no inline error slot — a backend error on one goes to the banner instead. */
const TOGGLE_KEYS: CarrierFieldKey[] = ['allowPersonalConveyance', 'allowYardMove'];

/** Mirrors `UpdateCarrierDto` (`unassignedThresholdMin` 0-60, `dvirRetentionMonths` 1-120). */
const NUMBER_RULES: [CarrierFieldKey & ('unassignedThresholdMin' | 'dvirRetentionMonths'), number, number, string][] = [
  ['unassignedThresholdMin', 0, 60, VALIDATION_MESSAGES.unassignedThreshold],
  ['dvirRetentionMonths', 1, 120, VALIDATION_MESSAGES.dvirRetention],
];

/** The list is US-only (no shared province list exists); a carrier already stored in Ontario
 * still shows and keeps the Canadian postal-code field. */
const isCanadian = (state: string | null | undefined) => state === 'ON';

/** Save-time check of the free-typed fields. Empty optional fields are skipped; the keystroke
 * filters already keep impossible characters out, this catches incomplete values (`4321`, `12-34`). */
function companyErrors(form: Partial<CarrierRow>): CarrierFieldErrors {
  const rules: [TextKey, ZodTypeAny, boolean][] = [
    ['name', fields.companyText(VALIDATION_MESSAGES.companyName), true],
    ['dotNumber', fields.dotNumber(), true],
    ['mcNumber', fields.mcNumber(), false],
    ['ein', fields.ein(), false],
    ['phone', fields.phone(), false],
    // The backend's `z.string().email()` also rejects `''`, so once the email holds a string
    // (it is sent), it must be a valid address — only a never-set (`null`) email may stay empty.
    ['complianceEmail', fields.email(), typeof form.complianceEmail === 'string'],
    ['addressLine1', fields.companyText(), false],
    ['city', fields.city(), false],
    ['state', z.string().refine((value) => US_STATES.includes(value), VALIDATION_MESSAGES.state), false],
    ['zip', fields.postalCode(isCanadian(form.state)), false],
  ];
  const errors: CarrierFieldErrors = {};
  for (const [key, rule, required] of rules) {
    const value = (form[key] ?? '').trim();
    if (!value && !required) continue;
    const result = rule.safeParse(value);
    if (!result.success) errors[key] = result.error.issues[0]?.message;
  }
  for (const [key, min, max, message] of NUMBER_RULES) {
    const value = form[key];
    if (value != null && (!Number.isInteger(value) || value < min || value > max)) errors[key] = message;
  }
  return errors;
}

export default function CompanyProfilePage() {
  usePageHeader({ title: 'Settings', subtitle: 'Company profile, compliance ruleset and preferences' });
  const { data: carrier, isLoading, isError, refetch } = useCarrier();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <LoadingState rows={6} />
      </div>
    );
  }

  if (isError || !carrier) {
    return (
      <Card>
        <ErrorState onRetry={() => refetch()} />
      </Card>
    );
  }

  // Keyed by `carrier.id` (a single-row resource, so this only ever remounts on refetch of
  // different data) so the form's local state seeds from the loaded record without an effect.
  return <CompanyProfileForm key={carrier.id} carrier={carrier} />;
}

function CompanyProfileForm({ carrier }: { carrier: CarrierRow }) {
  const { can } = usePermission();
  const canFull = can('carrierSettings', 'FULL');
  const { toast } = useToast();
  const updateMutation = useUpdateCarrier();

  const [form, setForm] = useState<Partial<CarrierRow>>(carrier);
  const [dirty, setDirty] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [eldError, setEldError] = useState<string | null>(null);
  const [errors, setErrors] = useState<CarrierFieldErrors>({});
  /** Save errors that name no field on this form (a backend 4xx) — never swallowed. */
  const [banner, setBanner] = useState<string[]>([]);

  /** Any edit clears that field's error (a stale backend message included). */
  function set<K extends keyof CarrierRow>(key: K, value: CarrierRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setErrors((prev) => (key in prev ? { ...prev, [key]: undefined } : prev));
  }

  /** A free-typed field: the value arrives already filtered, and its save error clears on edit. */
  function setText(key: TextKey, value: string) {
    set(key, value);
  }

  /** WB-202 — the message names the real fault: length/character set, or casing. */
  function validateEldIdentifier(value: string | null | undefined): boolean {
    // `''` is sent and rejected by the backend (`ErodsIdentifierSchema`) — only a never-set value is skipped.
    if (value == null) {
      setEldError(null);
      return true;
    }
    if (!/^[A-Za-z0-9]{4}$/.test(value)) {
      setEldError('The ELD identifier is exactly 4 characters, letters and digits only.');
      return false;
    }
    if (value !== value.toUpperCase()) {
      setEldError(`The ELD identifier must be uppercase — enter ${value.toUpperCase()}.`);
      return false;
    }
    setEldError(null);
    return true;
  }

  /** 11.30/§14.1 — free-typed fields are checked when the field is left, not only on Save. */
  function validateField(key: TextKey | (typeof NUMBER_RULES)[number][0]) {
    const all = companyErrors(form);
    setErrors((prev) => ({ ...prev, [key]: all[key] }));
  }

  function doSave() {
    const textErrors = companyErrors(form);
    setErrors(textErrors);
    setBanner([]);
    const eldOk = validateEldIdentifier(form.eldIdentifier);
    if (!eldOk || Object.values(textErrors).some(Boolean)) return;
    updateMutation.mutate(toCarrierPatch(form), {
      onSuccess: () => {
        setDirty(false);
        setLastSynced(new Date().toISOString());
        toast({ kind: 'success', ...TOAST_COPY.settingsSaved });
      },
      onError: (error) => {
        // client.ts rule 6 — a 4xx's field errors go under their fields, the rest into the banner;
        // the toast alone never says which field is wrong.
        const mapped = mapCarrierSaveError(error);
        if (mapped) {
          const { eldIdentifier, ...fieldErrors } = mapped.fields;
          const toggles = TOGGLE_KEYS.flatMap((key) => {
            const message = mapped.fields[key];
            return message ? [`${CARRIER_FIELD_LABELS[key]}: ${message}`] : [];
          });
          setErrors(fieldErrors);
          if (eldIdentifier) setEldError(eldIdentifier);
          setBanner([...toggles, ...mapped.banner]);
          const highlighted = Object.entries(mapped.fields).some(
            ([key, message]) => Boolean(message) && !TOGGLE_KEYS.includes(key as CarrierFieldKey),
          );
          toast({ kind: 'error', title: highlighted ? errorMessage('VALIDATION_FAILED') : 'The changes were not saved.' });
          return;
        }
        toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
      },
    });
  }

  function handleSave() {
    if (form.erodsMode === 'PRODUCTION' && carrier?.erodsMode !== 'PRODUCTION') {
      setConfirmProduction(true);
      return;
    }
    doSave();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-end">
        {canFull && (
          <Button
            variant="primary"
            iconLeft={<Check size={16} strokeWidth={1.75} />}
            disabled={!dirty || updateMutation.isPending}
            loading={updateMutation.isPending}
            onClick={handleSave}
          >
            Save changes
          </Button>
        )}
      </div>

      {banner.length > 0 && (
        <div role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
          {banner.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <Card>
        <SectionHeader title="Company profile" subtitle="Shown on IFTA, FMCSA and DVIR exports" className="mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Company name" required error={errors.name}>
            <input
              className={inputClass}
              value={form.name ?? ''}
              readOnly={!canFull}
              aria-invalid={errors.name ? true : undefined}
              onBlur={() => validateField('name')}
              onChange={(e) => setText('name', e.target.value.slice(0, LIMITS.companyTextMax))}
            />
          </Field>
          <Field label="US DOT number" required error={errors.dotNumber}>
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.dotNumber ?? ''}
              readOnly={!canFull}
              aria-invalid={errors.dotNumber ? true : undefined}
              onBlur={() => validateField('dotNumber')}
              onChange={(e) => setText('dotNumber', inputFilters.digits(e.target.value, LIMITS.dotNumberMax))}
            />
          </Field>
          <Field label="MC number" error={errors.mcNumber}>
            <input
              className={inputClass}
              value={form.mcNumber ?? ''}
              readOnly={!canFull}
              aria-invalid={errors.mcNumber ? true : undefined}
              onBlur={() => validateField('mcNumber')}
              onChange={(e) => setText('mcNumber', inputFilters.mcNumber(e.target.value))}
            />
          </Field>
          <Field label="EIN / Tax ID" error={errors.ein}>
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="12-3456789"
              value={form.ein ?? ''}
              readOnly={!canFull}
              aria-invalid={errors.ein ? true : undefined}
              onBlur={() => validateField('ein')}
              onChange={(e) => setText('ein', inputFilters.ein(e.target.value))}
            />
          </Field>
          <Field label="Main phone" error={errors.phone}>
            <input
              className={inputClass}
              type="tel"
              autoComplete="tel"
              value={form.phone ?? ''}
              readOnly={!canFull}
              aria-invalid={errors.phone ? true : undefined}
              onBlur={() => validateField('phone')}
              onChange={(e) => setText('phone', inputFilters.phone(e.target.value))}
            />
          </Field>
          <Field label="Compliance email" error={errors.complianceEmail}>
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              value={form.complianceEmail ?? ''}
              readOnly={!canFull}
              aria-invalid={errors.complianceEmail ? true : undefined}
              onBlur={() => validateField('complianceEmail')}
              onChange={(e) => setText('complianceEmail', inputFilters.email(e.target.value))}
            />
          </Field>
          <Field label="Street address" error={errors.addressLine1}>
            <input
              className={inputClass}
              value={form.addressLine1 ?? ''}
              readOnly={!canFull}
              aria-invalid={errors.addressLine1 ? true : undefined}
              onBlur={() => validateField('addressLine1')}
              onChange={(e) => setText('addressLine1', e.target.value.slice(0, LIMITS.companyTextMax))}
            />
          </Field>
          <Field label="City" error={errors.city}>
            <input
              className={inputClass}
              value={form.city ?? ''}
              readOnly={!canFull}
              aria-invalid={errors.city ? true : undefined}
              onBlur={() => validateField('city')}
              onChange={(e) => setText('city', inputFilters.city(e.target.value))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State" error={errors.state}>
              <Select
                className={inputClass}
                value={form.state ?? ''}
                disabled={!canFull}
                invalid={Boolean(errors.state)}
                options={[
                  { value: '', label: '—' },
                  // A stored state outside the list still shows (and is flagged on save).
                  ...(form.state && !US_STATES.includes(form.state) ? [{ value: form.state, label: form.state }] : []),
                  ...STATE_OPTIONS,
                ]}
                onChange={(value) => {
                  set('state', value);
                  setErrors((prev) => ({ ...prev, zip: undefined }));
                }}
              />
            </Field>
            <Field label={isCanadian(form.state) ? 'Postal code' : 'ZIP'} error={errors.zip}>
              <input
                className={inputClass}
                inputMode={isCanadian(form.state) ? 'text' : 'numeric'}
                value={form.zip ?? ''}
                readOnly={!canFull}
                aria-invalid={errors.zip ? true : undefined}
                onBlur={() => validateField('zip')}
                onChange={(e) =>
                  setText('zip', isCanadian(form.state) ? inputFilters.caPostal(e.target.value) : inputFilters.usZip(e.target.value))
                }
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Compliance & operating rules"
          subtitle="Applies to every driver unless overridden on the driver profile"
          className="mb-4"
        />
        <div className="grid grid-cols-3 gap-4">
          <Field label="HOS ruleset" required error={errors.hosRuleset}>
            <select
              className={inputClass}
              aria-invalid={errors.hosRuleset ? true : undefined}
              value={form.hosRuleset ?? 'US_70_8_PROPERTY'}
              disabled={!canFull}
              onChange={(e) => set('hosRuleset', e.target.value as HosRuleset)}
            >
              {HOS_RULESETS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cycle restart" error={errors.cycleRestart}>
            <select
              className={inputClass}
              aria-invalid={errors.cycleRestart ? true : undefined}
              value={form.cycleRestart ? '34' : 'none'}
              disabled={!canFull}
              onChange={(e) => set('cycleRestart', e.target.value === '34')}
            >
              <option value="34">34-hour restart</option>
              <option value="none">No restart</option>
            </select>
          </Field>
          <Field label="Home terminal time zone" error={errors.timezone}>
            <select
              className={inputClass}
              aria-invalid={errors.timezone ? true : undefined}
              value={form.timezone ?? ''}
              disabled={!canFull}
              onChange={(e) => set('timezone', e.target.value)}
            >
              <option value="America/New_York">America/New_York (Eastern)</option>
              <option value="America/Chicago">America/Chicago (Central)</option>
              <option value="America/Denver">America/Denver (Mountain)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
            </select>
          </Field>
          <Field label="Distance unit" error={errors.distanceUnit}>
            <select
              className={inputClass}
              aria-invalid={errors.distanceUnit ? true : undefined}
              value={form.distanceUnit ?? 'MILES'}
              disabled={!canFull}
              onChange={(e) => set('distanceUnit', e.target.value as CarrierRow['distanceUnit'])}
            >
              <option value="MILES">Miles</option>
              <option value="KILOMETERS">Kilometers</option>
            </select>
          </Field>
          <Field label="Unassigned driving threshold" hint="minutes" error={errors.unassignedThresholdMin}>
            <input
              className={inputClass}
              inputMode="numeric"
              value={String(form.unassignedThresholdMin ?? 0)}
              readOnly={!canFull}
              aria-invalid={errors.unassignedThresholdMin ? true : undefined}
              onBlur={() => validateField('unassignedThresholdMin')}
              onChange={(e) => set('unassignedThresholdMin', Number(inputFilters.digits(e.target.value, LIMITS.smallCountDigits)))}
            />
          </Field>
          <Field label="DVIR retention" hint="months" error={errors.dvirRetentionMonths}>
            <input
              className={inputClass}
              inputMode="numeric"
              value={String(form.dvirRetentionMonths ?? 0)}
              readOnly={!canFull}
              aria-invalid={errors.dvirRetentionMonths ? true : undefined}
              onBlur={() => validateField('dvirRetentionMonths')}
              onChange={(e) => set('dvirRetentionMonths', Number(inputFilters.digits(e.target.value, LIMITS.smallCountDigits)))}
            />
          </Field>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <ToggleRow
          title="Allow personal conveyance"
          description="Drivers may log PC time while off duty"
          checked={form.allowPersonalConveyance ?? false}
          disabled={!canFull}
          onChange={(v) => set('allowPersonalConveyance', v)}
        />
        <ToggleRow
          title="Allow yard move"
          description="Yard move is available as an on-duty sub-status"
          checked={form.allowYardMove ?? false}
          disabled={!canFull}
          onChange={(v) => set('allowYardMove', v)}
        />
      </div>

      <Card>
        <SectionHeader title="eRODS" subtitle="FMCSA electronic data transfer identity" className="mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="ELD identifier"
            error={eldError ?? undefined}
            hint="Exactly 4 characters, uppercase letters and digits only (A-Z, 0-9). Entered as typed — never auto-corrected."
          >
            <input
              className={inputClass}
              maxLength={4}
              value={form.eldIdentifier ?? ''}
              readOnly={!canFull}
              aria-invalid={eldError ? true : undefined}
              onBlur={(e) => validateEldIdentifier(e.target.value)}
              onChange={(e) => {
                // WB-112 — §14.2: `eldIdentifier` is validated exactly as typed, never rewritten
                // (no silent `.toUpperCase()`); a lowercase or mixed-case value is flagged by
                // `validateEldIdentifier` instead of being corrected out from under the carrier.
                // WB-202 — the check runs on blur, not on every keystroke, so a half-typed value
                // is not flagged as wrong while it is being typed.
                set('eldIdentifier', e.target.value);
                setEldError(null);
              }}
              placeholder="OBK1"
            />
          </Field>
          <Field label="ELD registration ID" error={errors.eldRegistrationId}>
            <input
              className={inputClass}
              maxLength={4}
              value={form.eldRegistrationId ?? ''}
              readOnly={!canFull}
              aria-invalid={errors.eldRegistrationId ? true : undefined}
              onChange={(e) => set('eldRegistrationId', e.target.value.toUpperCase())}
              placeholder="OBK1"
            />
          </Field>
          <Field label="eRODS mode" error={errors.erodsMode}>
            <select
              className={inputClass}
              aria-invalid={errors.erodsMode ? true : undefined}
              value={form.erodsMode ?? 'TEST'}
              disabled={!canFull}
              onChange={(e) => set('erodsMode', e.target.value as CarrierRow['erodsMode'])}
            >
              <option value="TEST">TEST</option>
              <option value="PRODUCTION">PRODUCTION</option>
            </select>
          </Field>
        </div>
      </Card>

      {!dirty && lastSynced && (
        <p className="text-caption text-text-muted">
          ✓ All changes saved · last synced {formatRelative(lastSynced)}
        </p>
      )}

      <ConfirmDelete
        open={confirmProduction}
        onClose={() => setConfirmProduction(false)}
        onConfirm={() => {
          setConfirmProduction(false);
          doSave();
        }}
        title="Switch to production eRODS?"
        description="Switching to production sends real files to FMCSA."
        confirmLabel="Switch to production"
        loading={updateMutation.isPending}
      />
    </div>
  );
}
