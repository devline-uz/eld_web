// owner: web-vehicles-drivers — 11.8 Add driver (web/tz.md §11.8). Q-3: this is how a driver
// account is created — the driver never signs in to the web panel. `drivers` FULL only.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { driverSchema, type DriverFormValues } from '@/shared/forms/schemas';
import { useCreateDriver } from '@/shared/api/drivers';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { ApiError } from '@/shared/api/errors';

const US_STATES = ['OH', 'NC', 'KY', 'IN', 'PA', 'TN', 'GA', 'VA', 'MI', 'IL'];

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

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';

export function AddDriverModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [assignedVehicleId, setAssignedVehicleId] = useState('');
  const [allowPersonalConveyance, setAllowPersonalConveyance] = useState(true);
  const [allowYardMove, setAllowYardMove] = useState(true);
  const [adverseDrivingEnabled, setAdverseDrivingEnabled] = useState(false);
  const [shortHaulException, setShortHaulException] = useState(false);
  const [splitSleeperEnabled, setSplitSleeperEnabled] = useState(true);
  const [eldExempt, setEldExempt] = useState(false);
  const [eldExemptReason, setEldExemptReason] = useState('');
  const [sendInvitation, setSendInvitation] = useState(true);

  const vehiclesQuery = useVehiclesPicker();
  const mutation = useCreateDriver();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    mode: 'onBlur',
    defaultValues: { cdlState: 'OH', notifyByEmail: true },
  });

  function onSubmit(values: DriverFormValues) {
    if (eldExempt && !eldExemptReason.trim()) {
      toast({ kind: 'error', title: 'Exemption reason is required when ELD exempt is checked.' });
      return;
    }
    mutation.mutate(
      {
        firstName: values.firstName,
        lastName: values.lastName,
        username: values.username,
        password: values.password,
        email: values.email,
        phone: values.phone,
        cdlNumber: values.cdlNumber,
        cdlState: values.cdlState,
        homeTerminalName: values.homeTerminalTimezone,
        homeTerminalTimezone: values.homeTerminalTimezone,
        assignedVehicleId: assignedVehicleId || undefined,
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
          toast({ kind: 'success', ...TOAST_COPY.driverAdded(values.email) });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setError('username', { message: 'A driver with this username already exists.' });
            return;
          }
          if (error instanceof ApiError) {
            const fieldErrors = error.fieldErrors;
            for (const [field, message] of Object.entries(fieldErrors)) {
              setError(field as keyof DriverFormValues, { message });
            }
            if (Object.keys(fieldErrors).length > 0) return;
          }
          toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add driver"
      subtitle="Creates a driver account for the OneBook ELD mobile app"
      size="lg"
      isDirty={isDirty}
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-body text-text-secondary">
            <input type="checkbox" checked={sendInvitation} onChange={(e) => setSendInvitation(e.target.checked)} />
            Send invitation now
          </label>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            Save driver
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-muted">Personal details</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="First name" required error={errors.firstName?.message}>
              <input {...register('firstName')} disabled={isSubmitting} className={inputClass} />
            </Field>
            <Field label="Last name" required error={errors.lastName?.message}>
              <input {...register('lastName')} disabled={isSubmitting} className={inputClass} />
            </Field>
            <Field label="Username" required error={errors.username?.message}>
              <input {...register('username')} placeholder="Used to sign in to the app" disabled={isSubmitting} className={inputClass} />
            </Field>
            {/* Not `<Field>`: the show/hide toggle is a `<button aria-label>` — nested inside a
                `<label>`, its accessible name would be appended to the label's name-from-content
                and break an exact "Password" match, so `<label htmlFor>` stays a sibling of the
                input+button group instead of their ancestor. */}
            <div className="flex flex-col gap-1">
              <label className="text-label text-text" htmlFor="add-driver-password">
                Password <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="add-driver-password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="Minimum 8 characters"
                  disabled={isSubmitting}
                  className={`${inputClass} w-full pr-9`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </div>
              {errors.password?.message && <span className="text-caption text-danger">{errors.password.message}</span>}
            </div>
            <Field label="Email address" required error={errors.email?.message}>
              <input {...register('email')} type="email" placeholder="driver@gmail.com" disabled={isSubmitting} className={inputClass} />
            </Field>
            <Field label="Phone number" error={errors.phone?.message}>
              <input
                {...register('phone', {
                  // Same empty-string-vs-undefined trap as WB-012/WB-019: an untouched optional
                  // field defaults to '', which fails the phone regex even though it is optional.
                  setValueAs: (v: string) => (v === '' ? undefined : v),
                })}
                disabled={isSubmitting}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="mt-1 text-caption text-text-muted">
            Gmail address the driver signs in with. In production it must be verified.
          </p>
        </div>

        <div>
          <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-muted">Licence & terminal</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Driver licence number" required error={errors.cdlNumber?.message}>
              <input {...register('cdlNumber')} disabled={isSubmitting} className={inputClass} />
            </Field>
            <Field label="Issuing state" required error={errors.cdlState?.message}>
              <select {...register('cdlState')} disabled={isSubmitting} className={inputClass}>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Home terminal" required error={errors.homeTerminalTimezone?.message}>
              <select {...register('homeTerminalTimezone')} disabled={isSubmitting} className={inputClass}>
                <option value="America/New_York">Columbus, OH (Eastern)</option>
                <option value="America/Chicago">Raleigh, NC (Eastern)</option>
              </select>
            </Field>
            <Field label="Assigned unit">
              <select value={assignedVehicleId} onChange={(e) => setAssignedVehicleId(e.target.value)} disabled={isSubmitting} className={inputClass}>
                <option value="">None</option>
                {(vehiclesQuery.data?.items ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.unitNumber}
                  </option>
                ))}
              </select>
            </Field>
          </div>
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
            <Field label="Exemption reason" required>
              <input value={eldExemptReason} onChange={(e) => setEldExemptReason(e.target.value)} disabled={isSubmitting} className={`${inputClass} mt-2 w-full`} />
            </Field>
          )}
        </div>

        <p className="rounded-md bg-info-soft p-3 text-body text-info">
          The driver receives an email with the app download link and a one-time sign-in code.
        </p>
      </form>
    </Modal>
  );
}
