// owner: web-settings-admin — W-17 Settings · Company profile (web/tz.md §10 W-17).
// Design: web/roles and screens/admin panel/Settings — company profile and HOS ruleset.jpg
import { useState } from 'react';
import type { ZodTypeAny } from 'zod';
import { Check } from 'lucide-react';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { formatRelative } from '@/shared/format/relative';
import { usePermission } from '@/shared/auth/usePermission';
import { ApiError } from '@/shared/api/errors';
import { useCarrier, useUpdateCarrier, type CarrierRow, type HosRuleset } from '@/shared/api/settingsAdmin';
import { Field, inputClass, ToggleRow } from './components/formKit';
import { fields, inputFilters, LIMITS } from '@/shared/forms';
import { ConfirmDelete } from '@/shared/ui/Modal';

const HOS_RULESETS: { value: HosRuleset; label: string }[] = [
  { value: 'US_70_8_PROPERTY', label: 'US 70 hr / 8 day — Property carrying' },
  { value: 'US_60_7_PROPERTY', label: 'US 60 hr / 7 day — Property carrying' },
  { value: 'US_70_8_PASSENGER', label: 'US 70 hr / 8 day — Passenger carrying' },
  { value: 'US_60_7_PASSENGER', label: 'US 60 hr / 7 day — Passenger carrying' },
];

const US_STATES = ['OH', 'NY', 'PA', 'MI', 'IN', 'IL', 'WV', 'KY', 'ON'];

type TextKey = 'name' | 'dotNumber' | 'mcNumber' | 'ein' | 'phone' | 'complianceEmail' | 'addressLine1' | 'city' | 'zip';
type TextErrors = Partial<Record<TextKey, string>>;

/** Ontario is the one non-US entry in the state list — its ZIP field takes a Canadian postal code. */
const isCanadian = (state: string | null | undefined) => state === 'ON';

/** Save-time check of the free-typed fields. Empty optional fields are skipped; the keystroke
 * filters already keep impossible characters out, this catches incomplete values (`4321`, `12-34`). */
function companyErrors(form: Partial<CarrierRow>): TextErrors {
  const rules: [TextKey, ZodTypeAny, boolean][] = [
    ['name', fields.companyText(), true],
    ['dotNumber', fields.dotNumber(), true],
    ['mcNumber', fields.mcNumber(), false],
    ['ein', fields.ein(), false],
    ['phone', fields.phone(), false],
    ['complianceEmail', fields.email(), false],
    ['addressLine1', fields.companyText(), false],
    ['city', fields.city(), false],
    ['zip', fields.postalCode(isCanadian(form.state)), false],
  ];
  const errors: TextErrors = {};
  for (const [key, rule, required] of rules) {
    const value = (form[key] ?? '').trim();
    if (!value && !required) continue;
    const result = rule.safeParse(value);
    if (!result.success) errors[key] = result.error.issues[0]?.message;
  }
  return errors;
}

export default function CompanyProfilePage() {
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
  const [errors, setErrors] = useState<TextErrors>({});

  function set<K extends keyof CarrierRow>(key: K, value: CarrierRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  /** A free-typed field: the value arrives already filtered, and its save error clears on edit. */
  function setText(key: TextKey, value: string) {
    set(key, value);
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  /** WB-202 — the message names the real fault: length/character set, or casing. */
  function validateEldIdentifier(value: string | null | undefined): boolean {
    if (!value) {
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
  function validateField(key: TextKey) {
    const all = companyErrors(form);
    setErrors((prev) => ({ ...prev, [key]: all[key] }));
  }

  function doSave() {
    const textErrors = companyErrors(form);
    setErrors(textErrors);
    const eldOk = validateEldIdentifier(form.eldIdentifier);
    if (!eldOk || Object.values(textErrors).some(Boolean)) return;
    updateMutation.mutate(form, {
      onSuccess: () => {
        setDirty(false);
        setLastSynced(new Date().toISOString());
        toast({ kind: 'success', ...TOAST_COPY.settingsSaved });
      },
      onError: (error) => {
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-page-title text-text">Settings</h1>
          <p className="text-page-sub text-text-muted">Company profile, compliance ruleset and preferences</p>
        </div>
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

      <Card>
        <SectionHeader title="Company profile" className="mb-4" />
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
            <Field label="State">
              <select
                className={inputClass}
                value={form.state ?? ''}
                disabled={!canFull}
                onChange={(e) => {
                  set('state', e.target.value);
                  setErrors((prev) => ({ ...prev, zip: undefined }));
                }}
              >
                <option value="">—</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
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
          <Field label="HOS ruleset" required>
            <select
              className={inputClass}
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
          <Field label="Cycle restart">
            <select
              className={inputClass}
              value={form.cycleRestart ? '34' : 'none'}
              disabled={!canFull}
              onChange={(e) => set('cycleRestart', e.target.value === '34')}
            >
              <option value="34">34-hour restart</option>
              <option value="none">No restart</option>
            </select>
          </Field>
          <Field label="Home terminal time zone">
            <select
              className={inputClass}
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
          <Field label="Distance unit">
            <select
              className={inputClass}
              value={form.distanceUnit ?? 'MILES'}
              disabled={!canFull}
              onChange={(e) => set('distanceUnit', e.target.value as CarrierRow['distanceUnit'])}
            >
              <option value="MILES">Miles</option>
              <option value="KILOMETERS">Kilometers</option>
            </select>
          </Field>
          <Field label="Unassigned driving threshold" hint="minutes">
            <input
              className={inputClass}
              inputMode="numeric"
              value={String(form.unassignedThresholdMin ?? 0)}
              readOnly={!canFull}
              onChange={(e) => set('unassignedThresholdMin', Number(inputFilters.digits(e.target.value, LIMITS.smallCountDigits)))}
            />
          </Field>
          <Field label="DVIR retention" hint="months">
            <input
              className={inputClass}
              inputMode="numeric"
              value={String(form.dvirRetentionMonths ?? 0)}
              readOnly={!canFull}
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
          <Field label="ELD registration ID">
            <input
              className={inputClass}
              maxLength={4}
              value={form.eldRegistrationId ?? ''}
              readOnly={!canFull}
              onChange={(e) => set('eldRegistrationId', e.target.value.toUpperCase())}
              placeholder="OBK1"
            />
          </Field>
          <Field label="eRODS mode">
            <select
              className={inputClass}
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
