// owner: web-vehicles-drivers — W-07 `Edit` on the Driver profile card. `drivers` FULL only.
//
// 11.8 (Add driver) creates an account: username + mobile-app password + invitation. Editing one is
// the subset that `PATCH /drivers/:id` really accepts — identity, contact, licence, terminal and
// the HOS allowances. The username and the password are deliberately not here: the username is the
// driver's sign-in identity, and there is no carrier-side password reset at all (gap B-81).
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import * as f from '@/shared/forms/fields';
import { useUpdateDriver } from '@/shared/api/drivers';
import type { DriverRow } from '@/shared/api/drivers';
import { ApiError } from '@/shared/api/errors';
import { DRIVER_TOAST } from '../lib/copy';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
];

/** Same terminal table as 11.8 — the display name and the IANA zone are kept apart (WB-153). */
const TERMINALS = [
  { name: 'Columbus, OH', label: 'Columbus, OH (Eastern)', timezone: 'America/New_York' },
  { name: 'Raleigh, NC', label: 'Raleigh, NC (Eastern)', timezone: 'America/New_York' },
] as const;

const editDriverSchema = z.object({
  firstName: f.requiredString(),
  lastName: f.requiredString(),
  email: f.email(),
  phone: f.phone().optional(),
  cdlNumber: f.cdlNumber(),
  cdlState: z.string().trim().length(2),
});
type EditDriverValues = z.infer<typeof editDriverSchema>;

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-text">
        {label} {required && <span className="text-danger" aria-hidden="true">*</span>}
      </span>
      {children}
      {error && <span className="text-caption text-danger">{error}</span>}
    </label>
  );
}

export interface EditDriverModalProps {
  driver: DriverRow;
  onClose: () => void;
}

export function EditDriverModal({ driver, onClose }: EditDriverModalProps) {
  const { toast } = useToast();
  const mutation = useUpdateDriver(driver.id);
  const [banner, setBanner] = useState<string | null>(null);
  const [terminalName, setTerminalName] = useState<string>(
    TERMINALS.find((t) => t.name === driver.homeTerminalName)?.name ?? driver.homeTerminalName,
  );
  const [allowPersonalConveyance, setAllowPersonalConveyance] = useState(driver.allowPersonalConveyance);
  const [allowYardMove, setAllowYardMove] = useState(driver.allowYardMove);
  const [adverseDrivingEnabled, setAdverseDrivingEnabled] = useState(driver.adverseDrivingEnabled);
  const [shortHaulException, setShortHaulException] = useState(driver.shortHaulException);
  const [splitSleeperEnabled, setSplitSleeperEnabled] = useState(driver.splitSleeperEnabled);
  const [eldExempt, setEldExempt] = useState(driver.eldExempt);
  const [eldExemptReason, setEldExemptReason] = useState(driver.eldExemptReason ?? '');
  const [exemptReasonError, setExemptReasonError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<EditDriverValues>({
    resolver: zodResolver(editDriverSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email ?? '',
      phone: driver.phone ?? undefined,
      cdlNumber: driver.cdlNumber,
      cdlState: driver.cdlState,
    },
  });

  const isPending = mutation.isPending;
  const extrasDirty =
    terminalName !== driver.homeTerminalName ||
    allowPersonalConveyance !== driver.allowPersonalConveyance ||
    allowYardMove !== driver.allowYardMove ||
    adverseDrivingEnabled !== driver.adverseDrivingEnabled ||
    shortHaulException !== driver.shortHaulException ||
    splitSleeperEnabled !== driver.splitSleeperEnabled ||
    eldExempt !== driver.eldExempt ||
    eldExemptReason !== (driver.eldExemptReason ?? '');

  function onSubmit(values: EditDriverValues) {
    if (isPending) return;
    if (eldExempt && !eldExemptReason.trim()) {
      setExemptReasonError('An exemption reason is required while ELD exempt is checked.');
      return;
    }
    setExemptReasonError(null);
    setBanner(null);
    const terminal = TERMINALS.find((t) => t.name === terminalName);
    mutation.mutate(
      {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        cdlNumber: values.cdlNumber,
        cdlState: values.cdlState,
        homeTerminalName: terminalName,
        ...(terminal ? { homeTerminalTimezone: terminal.timezone } : {}),
        allowPersonalConveyance,
        allowYardMove,
        adverseDrivingEnabled,
        shortHaulException,
        splitSleeperEnabled,
        eldExempt,
        eldExemptReason: eldExempt ? eldExemptReason : undefined,
      },
      {
        onSuccess: () => {
          toast({ kind: 'success', ...DRIVER_TOAST.driverUpdated(`${values.firstName} ${values.lastName}`) });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            const fieldErrors = error.fieldErrors;
            for (const [field, message] of Object.entries(fieldErrors)) {
              setError(field as keyof EditDriverValues, { message });
            }
            if (Object.keys(fieldErrors).length > 0) return;
          }
          const message = error instanceof ApiError ? error.userMessage : 'Something went wrong.';
          setBanner(message);
          toast({ kind: 'error', title: message });
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit driver"
      subtitle={`@${driver.username} · the sign-in username cannot be changed`}
      size="lg"
      isDirty={isDirty || extrasDirty}
      footer={
        <>
          <ModalCancelButton disabled={isPending} />
          <Button variant="primary" size="lg" loading={isPending} disabled={isPending} onClick={handleSubmit(onSubmit)}>
            Save changes
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
        {banner && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {banner}
          </p>
        )}
        <div className="grid grid-cols-3 gap-4">
          <Field label="First name" required error={errors.firstName?.message}>
            <input {...register('firstName')} disabled={isPending} aria-invalid={errors.firstName ? true : undefined} className={inputClass} />
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            <input {...register('lastName')} disabled={isPending} aria-invalid={errors.lastName ? true : undefined} className={inputClass} />
          </Field>
          <Field label="Email address" required error={errors.email?.message}>
            <input {...register('email')} type="email" disabled={isPending} aria-invalid={errors.email ? true : undefined} className={inputClass} />
          </Field>
          <Field label="Phone number" error={errors.phone?.message}>
            <input
              {...register('phone', { setValueAs: (v: string) => (v === '' ? undefined : v) })}
              disabled={isPending}
              className={inputClass}
            />
          </Field>
          <Field label="Driver licence number" required error={errors.cdlNumber?.message}>
            <input {...register('cdlNumber')} disabled={isPending} aria-invalid={errors.cdlNumber ? true : undefined} className={inputClass} />
          </Field>
          <Field label="Issuing state" required error={errors.cdlState?.message}>
            <select {...register('cdlState')} disabled={isPending} className={inputClass}>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Home terminal" required>
            <select value={terminalName} onChange={(e) => setTerminalName(e.target.value)} disabled={isPending} className={inputClass}>
              {TERMINALS.some((t) => t.name === terminalName) ? null : (
                <option value={terminalName}>{terminalName}</option>
              )}
              {TERMINALS.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-muted">
            HOS exemptions and allowances
          </p>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked={allowPersonalConveyance} onChange={(e) => setAllowPersonalConveyance(e.target.checked)} />
              Allow personal conveyance
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked={allowYardMove} onChange={(e) => setAllowYardMove(e.target.checked)} />
              Allow yard move
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked={adverseDrivingEnabled} onChange={(e) => setAdverseDrivingEnabled(e.target.checked)} />
              Adverse driving conditions
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked={shortHaulException} onChange={(e) => setShortHaulException(e.target.checked)} />
              Short-haul exception (150 air-mile)
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked={splitSleeperEnabled} onChange={(e) => setSplitSleeperEnabled(e.target.checked)} />
              Enable split sleeper berth
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input type="checkbox" checked={eldExempt} onChange={(e) => setEldExempt(e.target.checked)} />
              Exempt from ELD (8-day rule)
            </label>
          </div>
          {eldExempt && (
            <Field label="Exemption reason" required error={exemptReasonError ?? undefined}>
              <input
                value={eldExemptReason}
                onChange={(e) => setEldExemptReason(e.target.value)}
                disabled={isPending}
                aria-invalid={exemptReasonError ? true : undefined}
                className={`${inputClass} mt-2 w-full`}
              />
            </Field>
          )}
        </div>
      </form>
    </Modal>
  );
}
