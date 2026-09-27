// owner: web-vehicles-drivers — W-07 `Edit` on the Driver profile card. `drivers` FULL only.
//
// 11.8 (Add driver) creates an account: username + mobile-app password + invitation. Editing one is
// the subset that `PATCH /drivers/:id` really accepts — identity, contact, licence, terminal and
// the HOS allowances. The username and the password are deliberately not here: the username is the
// driver's sign-in identity, and there is no carrier-side password reset at all (gap B-81).
import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import * as f from '@/shared/forms/fields';
import { internationalPhone, phoneForDisplay, phoneProblem } from '@/shared/forms/phoneNumber';
import {
  licenceNumber,
  normalizeLicenceNumber,
  withLicenceStateCheck,
} from '@/shared/forms/driverLicence';
import { useUpdateDriver } from '@/shared/api/drivers';
import type { DriverRow } from '@/shared/api/drivers';
import { ApiError } from '@/shared/api/errors';
import { DRIVER_TOAST } from '../lib/copy';
import { HOME_TERMINAL_TIMEZONES } from '../lib/terminals';
import { PhoneNumberInput } from './PhoneNumberInput';

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
];

const editDriverSchema = z.object({
  firstName: f.requiredString(),
  lastName: f.requiredString(),
  email: f.email(),
  /** Same international rule as Add driver: per-country validation, E.164 out. */
  phone: internationalPhone(),
  /** Trimmed, upper-cased, `[A-Z0-9-]`, 4–20; the issuing-state format is checked by the resolver. */
  cdlNumber: licenceNumber(),
  cdlState: z.string().trim().length(2),
  /** Optional and typed — there is no Terminal table to pick from yet (backend D-090). */
  homeTerminalName: z.string().trim().optional(),
  homeTerminalTimezone: z.string(),
});
type EditDriverValues = z.infer<typeof editDriverSchema>;

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-text">
        {label}{' '}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
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
  const [allowPersonalConveyance, setAllowPersonalConveyance] = useState(
    driver.allowPersonalConveyance,
  );
  const [allowYardMove, setAllowYardMove] = useState(driver.allowYardMove);
  const [adverseDrivingEnabled, setAdverseDrivingEnabled] = useState(driver.adverseDrivingEnabled);
  const [shortHaulException, setShortHaulException] = useState(driver.shortHaulException);
  const [splitSleeperEnabled, setSplitSleeperEnabled] = useState(driver.splitSleeperEnabled);
  const [eldExempt, setEldExempt] = useState(driver.eldExempt);
  const [eldExemptReason, setEldExemptReason] = useState(driver.eldExemptReason ?? '');
  const [exemptReasonError, setExemptReasonError] = useState<string | null>(null);

  // The stored phone is shown formatted from the start (the default itself is formatted, so opening
  // the form never makes it dirty). A legacy value these rules would reject is left alone while it
  // is untouched: it is neither re-validated nor re-sent, so it cannot block an unrelated edit.
  // Likewise an unchanged licence number/state pair is not held to the per-state format.
  const initialPhone = useMemo(() => phoneForDisplay(driver.phone), [driver.phone]);
  const resolver = useMemo<Resolver<EditDriverValues>>(() => {
    const legacyPhone = initialPhone !== '' && phoneProblem(initialPhone) !== null;
    const base = zodResolver(editDriverSchema);
    const phoneAware: Resolver<EditDriverValues> = (values, context, options) =>
      base(
        legacyPhone && values.phone === initialPhone ? { ...values, phone: undefined } : values,
        context,
        options,
      );
    return withLicenceStateCheck(
      phoneAware,
      (values) =>
        normalizeLicenceNumber(values.cdlNumber) === normalizeLicenceNumber(driver.cdlNumber) &&
        values.cdlState === driver.cdlState,
    );
  }, [initialPhone, driver.cdlNumber, driver.cdlState]);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<EditDriverValues>({
    resolver,
    mode: 'onBlur',
    defaultValues: {
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email ?? '',
      phone: initialPhone,
      cdlNumber: driver.cdlNumber,
      cdlState: driver.cdlState,
      homeTerminalName: driver.homeTerminalName ?? '',
      homeTerminalTimezone: driver.homeTerminalTimezone,
    },
  });

  const isPending = mutation.isPending;
  const extrasDirty =
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
    mutation.mutate(
      {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        // E.164 from the schema; empty or an untouched legacy value → not sent (unchanged).
        phone: values.phone || undefined,
        cdlNumber: values.cdlNumber,
        cdlState: values.cdlState,
        homeTerminalName: values.homeTerminalName || undefined,
        ...(values.homeTerminalTimezone !== driver.homeTerminalTimezone
          ? { homeTerminalTimezone: values.homeTerminalTimezone }
          : {}),
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
          toast({
            kind: 'success',
            ...DRIVER_TOAST.driverUpdated(`${values.firstName} ${values.lastName}`),
          });
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
          <Button
            variant="primary"
            size="lg"
            loading={isPending}
            disabled={isPending}
            onClick={handleSubmit(onSubmit)}
          >
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
            <input
              {...register('firstName')}
              disabled={isPending}
              aria-invalid={errors.firstName ? true : undefined}
              className={inputClass}
            />
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            <input
              {...register('lastName')}
              disabled={isPending}
              aria-invalid={errors.lastName ? true : undefined}
              className={inputClass}
            />
          </Field>
          <Field label="Email address" required error={errors.email?.message}>
            <input
              {...register('email')}
              type="email"
              disabled={isPending}
              aria-invalid={errors.email ? true : undefined}
              className={inputClass}
            />
          </Field>
          <Field label="Phone number" error={errors.phone?.message}>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneNumberInput
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  disabled={isPending}
                  aria-invalid={errors.phone ? true : undefined}
                  className={inputClass}
                />
              )}
            />
          </Field>
          <Field label="Driver licence number" required error={errors.cdlNumber?.message}>
            <input
              {...register('cdlNumber')}
              disabled={isPending}
              aria-invalid={errors.cdlNumber ? true : undefined}
              className={inputClass}
            />
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
          <Field label="Home terminal" error={errors.homeTerminalName?.message}>
            <input
              {...register('homeTerminalName')}
              disabled={isPending}
              aria-invalid={errors.homeTerminalName ? true : undefined}
              className={inputClass}
            />
          </Field>
          <Field label="Home terminal time zone" error={errors.homeTerminalTimezone?.message}>
            <select
              {...register('homeTerminalTimezone')}
              disabled={isPending}
              className={inputClass}
            >
              {/* A zone the list does not carry stays selectable, so an edit never rewrites it. */}
              {HOME_TERMINAL_TIMEZONES.some(
                (t) => t.value === driver.homeTerminalTimezone,
              ) ? null : (
                <option value={driver.homeTerminalTimezone}>{driver.homeTerminalTimezone}</option>
              )}
              {HOME_TERMINAL_TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
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
              <input
                type="checkbox"
                checked={allowPersonalConveyance}
                onChange={(e) => setAllowPersonalConveyance(e.target.checked)}
              />
              Allow personal conveyance
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={allowYardMove}
                onChange={(e) => setAllowYardMove(e.target.checked)}
              />
              Allow yard move
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={adverseDrivingEnabled}
                onChange={(e) => setAdverseDrivingEnabled(e.target.checked)}
              />
              Adverse driving conditions
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={shortHaulException}
                onChange={(e) => setShortHaulException(e.target.checked)}
              />
              Short-haul exception (150 air-mile)
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={splitSleeperEnabled}
                onChange={(e) => setSplitSleeperEnabled(e.target.checked)}
              />
              Enable split sleeper berth
            </label>
            <label className="flex items-center gap-2 text-body text-text">
              <input
                type="checkbox"
                checked={eldExempt}
                onChange={(e) => setEldExempt(e.target.checked)}
              />
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
