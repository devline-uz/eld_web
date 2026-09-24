// owner: web-vehicles-drivers — 11.8 Add driver (web/tz.md §11.8). Q-3: this is how a driver
// account is created — the driver never signs in to the web panel. `drivers` FULL only.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { driverSchema, type DriverFormValues } from '@/shared/forms/schemas';
import { useCreateDriver } from '@/shared/api/drivers';
import { useVehiclesPicker } from '@/shared/api/vehicles';
import { ApiError } from '@/shared/api/errors';
import { TERMINALS } from '../lib/terminals';

/** WB-187 — the list used to hold ten states, so a CDL from any other one could not be recorded. */
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
];

const DEFAULT_TERMINAL = TERMINALS[0];

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
  // WB-191 — the exemption reason used to be validated only by a toast on submit; the field itself
  // showed nothing, so a screen reader never learned which input was wrong.
  const [eldExemptReasonError, setEldExemptReasonError] = useState<string | null>(null);
  const [terminalName, setTerminalName] = useState<string>(DEFAULT_TERMINAL.name);
  const [sendInvitation, setSendInvitation] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const vehiclesQuery = useVehiclesPicker();
  const mutation = useCreateDriver();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setError,
    setValue,
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    mode: 'onBlur',
    // Every field is seeded: RHF reads a registered control's DOM value at mount, so a field the
    // defaults do not mention (the terminal `<select>`, which always has a value) made `isDirty`
    // true on an untouched form and every close asked "Discard changes?".
    defaultValues: {
      firstName: '',
      lastName: '',
      username: '',
      password: '',
      email: '',
      phone: undefined,
      cdlNumber: '',
      cdlState: 'OH',
      homeTerminalTimezone: DEFAULT_TERMINAL.timezone,
      notifyByEmail: true,
    },
  });

  // The submit guard is the mutation, not RHF: `isSubmitting` is already false again while the
  // POST is in flight, so a double click used to create two drivers.
  const isPending = mutation.isPending;

  // Honest dirty tracking: the checkboxes, the unit, the exemption reason and the terminal all
  // live outside RHF, so a real edit to any of them must confirm on close.
  const extrasDirty =
    assignedVehicleId !== '' ||
    !allowPersonalConveyance ||
    !allowYardMove ||
    adverseDrivingEnabled ||
    shortHaulException ||
    !splitSleeperEnabled ||
    eldExempt ||
    eldExemptReason !== '' ||
    terminalName !== DEFAULT_TERMINAL.name;

  function onSubmit(values: DriverFormValues) {
    if (isPending) return;
    if (eldExempt && !eldExemptReason.trim()) {
      setEldExemptReasonError('An exemption reason is required while ELD exempt is checked.');
      return;
    }
    setEldExemptReasonError(null);
    setBanner(null);
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
        homeTerminalName: terminalName,
        homeTerminalTimezone: values.homeTerminalTimezone,
        assignedVehicleId: assignedVehicleId || undefined,
        allowPersonalConveyance,
        allowYardMove,
        adverseDrivingEnabled,
        shortHaulException,
        splitSleeperEnabled,
        eldExempt,
        eldExemptReason: eldExempt ? eldExemptReason : undefined,
        sendInvitation,
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
          // The POST used to fail silently: the modal stayed open with nothing to read. An
          // unmapped failure is shown in the modal (§6.2 rule 6) as well as toasted.
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
      title="Add driver"
      subtitle="Creates a driver account for the OneBook ELD mobile app"
      size="lg"
      isDirty={isDirty || extrasDirty}
      footer={
        <>
          {/* B-82 shipped — `sendInvitation` rides on `POST /drivers`. */}
          <label className="mr-auto flex items-center gap-2 text-body text-text-secondary">
            <input type="checkbox" checked={sendInvitation} onChange={(e) => setSendInvitation(e.target.checked)} disabled={isPending} />
            Send invitation now
          </label>
          <ModalCancelButton disabled={isPending} />
          <Button variant="primary" size="lg" loading={isPending} disabled={isPending} onClick={handleSubmit(onSubmit)}>
            Save driver
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
        <div>
          <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-muted">Personal details</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="First name" required error={errors.firstName?.message}>
              <input {...register('firstName')} disabled={isPending} className={inputClass} />
            </Field>
            <Field label="Last name" required error={errors.lastName?.message}>
              <input {...register('lastName')} disabled={isPending} className={inputClass} />
            </Field>
            <Field label="Username" required error={errors.username?.message}>
              <input {...register('username')} placeholder="Used to sign in to the app" disabled={isPending} className={inputClass} />
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
                  disabled={isPending}
                  className={`${inputClass} w-full pr-9`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  // WB-190 — the icon alone was a 16×16 target, under the 24px minimum (§5.6).
                  className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted hover:bg-bg-subtle"
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
                </button>
              </div>
              {errors.password?.message && <span className="text-caption text-danger">{errors.password.message}</span>}
            </div>
            <Field label="Email address" required error={errors.email?.message}>
              <input {...register('email')} type="email" placeholder="driver@gmail.com" disabled={isPending} className={inputClass} />
            </Field>
            <Field label="Phone number" error={errors.phone?.message}>
              <input
                {...register('phone', {
                  // Same empty-string-vs-undefined trap as WB-012/WB-019: an untouched optional
                  // field defaults to '', which fails the phone regex even though it is optional.
                  setValueAs: (v: string) => (v === '' ? undefined : v),
                })}
                disabled={isPending}
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
              <input {...register('cdlNumber')} disabled={isPending} className={inputClass} />
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
            <Field label="Home terminal" required error={errors.homeTerminalTimezone?.message}>
              <select
                value={terminalName}
                onChange={(e) => {
                  const next = TERMINALS.find((t) => t.name === e.target.value) ?? DEFAULT_TERMINAL;
                  setTerminalName(next.name);
                  setValue('homeTerminalTimezone', next.timezone, { shouldDirty: true });
                }}
                disabled={isPending}
                className={inputClass}
              >
                {TERMINALS.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assigned unit">
              <select value={assignedVehicleId} onChange={(e) => setAssignedVehicleId(e.target.value)} disabled={isPending} className={inputClass}>
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
            <Field label="Exemption reason" required error={eldExemptReasonError ?? undefined}>
              <input
                value={eldExemptReason}
                onChange={(e) => setEldExemptReason(e.target.value)}
                disabled={isPending}
                aria-invalid={eldExemptReasonError ? true : undefined}
                className={`${inputClass} mt-2 w-full`}
              />
            </Field>
          )}
        </div>

        <p className="rounded-md bg-info-soft p-3 text-body text-info">
          {sendInvitation
            ? 'The driver receives an email with the app download link and a one-time sign-in code.'
            : 'No invitation email is sent — share the mobile password with the driver directly.'}
        </p>
      </form>
    </Modal>
  );
}
