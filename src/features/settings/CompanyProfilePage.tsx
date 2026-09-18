// owner: web-settings-admin — W-17 Settings · Company profile (web/tz.md §10 W-17).
// Design: web/roles and screens/admin panel/Settings — company profile and HOS ruleset.jpg
import { useState } from 'react';
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
import { ConfirmDelete } from '@/shared/ui/Modal';

const HOS_RULESETS: { value: HosRuleset; label: string }[] = [
  { value: 'US_70_8_PROPERTY', label: 'US 70 hr / 8 day — Property carrying' },
  { value: 'US_60_7_PROPERTY', label: 'US 60 hr / 7 day — Property carrying' },
  { value: 'US_70_8_PASSENGER', label: 'US 70 hr / 8 day — Passenger carrying' },
  { value: 'US_60_7_PASSENGER', label: 'US 60 hr / 7 day — Passenger carrying' },
];

const US_STATES = ['OH', 'NY', 'PA', 'MI', 'IN', 'IL', 'WV', 'KY', 'ON'];

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

  function set<K extends keyof CarrierRow>(key: K, value: CarrierRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function validateEldIdentifier(value: string | null | undefined): boolean {
    if (!value) return true;
    const ok = /^[A-Z0-9]{4}$/.test(value);
    setEldError(ok ? null : 'The ELD identifier is exactly 4 characters.');
    return ok;
  }

  function doSave() {
    if (!validateEldIdentifier(form.eldIdentifier)) return;
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
          <Field label="Company name" required>
            <input
              className={inputClass}
              value={form.name ?? ''}
              readOnly={!canFull}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label="US DOT number" required>
            <input
              className={inputClass}
              value={form.dotNumber ?? ''}
              readOnly={!canFull}
              onChange={(e) => set('dotNumber', e.target.value)}
            />
          </Field>
          <Field label="MC number">
            <input
              className={inputClass}
              value={form.mcNumber ?? ''}
              readOnly={!canFull}
              onChange={(e) => set('mcNumber', e.target.value)}
            />
          </Field>
          <Field label="EIN / Tax ID">
            <input
              className={inputClass}
              value={form.ein ?? ''}
              readOnly={!canFull}
              onChange={(e) => set('ein', e.target.value)}
            />
          </Field>
          <Field label="Main phone">
            <input
              className={inputClass}
              value={form.phone ?? ''}
              readOnly={!canFull}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label="Compliance email">
            <input
              className={inputClass}
              value={form.complianceEmail ?? ''}
              readOnly={!canFull}
              onChange={(e) => set('complianceEmail', e.target.value)}
            />
          </Field>
          <Field label="Street address" >
            <input
              className={inputClass}
              value={form.addressLine1 ?? ''}
              readOnly={!canFull}
              onChange={(e) => set('addressLine1', e.target.value)}
            />
          </Field>
          <Field label="City">
            <input
              className={inputClass}
              value={form.city ?? ''}
              readOnly={!canFull}
              onChange={(e) => set('city', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State">
              <select
                className={inputClass}
                value={form.state ?? ''}
                disabled={!canFull}
                onChange={(e) => set('state', e.target.value)}
              >
                <option value="">—</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ZIP">
              <input
                className={inputClass}
                value={form.zip ?? ''}
                readOnly={!canFull}
                onChange={(e) => set('zip', e.target.value)}
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
              type="number"
              className={inputClass}
              value={form.unassignedThresholdMin ?? 0}
              readOnly={!canFull}
              onChange={(e) => set('unassignedThresholdMin', Number(e.target.value))}
            />
          </Field>
          <Field label="DVIR retention" hint="months">
            <input
              type="number"
              className={inputClass}
              value={form.dvirRetentionMonths ?? 0}
              readOnly={!canFull}
              onChange={(e) => set('dvirRetentionMonths', Number(e.target.value))}
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
              onChange={(e) => {
                // WB-112 — §14.2: `eldIdentifier` is validated exactly as typed, never rewritten
                // (no silent `.toUpperCase()`); a lowercase or mixed-case value is flagged by
                // `validateEldIdentifier` instead of being corrected out from under the carrier.
                const v = e.target.value;
                set('eldIdentifier', v);
                validateEldIdentifier(v);
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
