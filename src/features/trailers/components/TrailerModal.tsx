// owner: web-vehicles-drivers — Add / Edit trailer. `vehicles` FULL (the backend gates /trailers on it).
// Fields mirror `CreateTrailerDto` (`number` 1–40, `vin` optional) + `UpdateTrailerDto.status`.
import { useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { trailerSchema, type TrailerFormValues } from '@/shared/forms/schemas';
import { VALIDATION_MESSAGES } from '@/shared/forms/messages';
import { ApiError } from '@/shared/api/errors';
import {
  useCreateTrailer,
  useUpdateTrailer,
  type TrailerRow,
  type TrailerStatus,
} from '@/shared/api/trailers';

const inputClass = 'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text';
const STATUS_LABEL: Record<TrailerStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  OUT_OF_SERVICE: 'Out of service',
};

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

export function TrailerModal({ trailer, onClose }: { trailer?: TrailerRow; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = Boolean(trailer);
  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
    setError,
  } = useForm<TrailerFormValues>({
    resolver: zodResolver(trailerSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      number: trailer?.number ?? '',
      vin: trailer?.vin ?? '',
      status: trailer?.status ?? 'ACTIVE',
    },
  });
  // `dirtyFields` only fills from a real change (see AddVehicleModal) — an untouched form closes silently.
  const isDirty = Object.keys(dirtyFields).length > 0;

  const createMutation = useCreateTrailer();
  const updateMutation = useUpdateTrailer(trailer?.id ?? '');
  const mutation = isEdit ? updateMutation : createMutation;
  const inFlight = useRef(false);
  const submitting = mutation.isPending;

  function onSubmit(values: TrailerFormValues) {
    if (inFlight.current || submitting) return;
    const base = { number: values.number, vin: values.vin || undefined };
    inFlight.current = true;
    const callbacks = {
      onSettled: () => {
        inFlight.current = false;
      },
      onSuccess: () => {
        toast({ kind: 'success', ...(isEdit ? TOAST_COPY.trailerUpdated(values.number) : TOAST_COPY.trailerCreated(values.number)) });
        onClose();
      },
      onError: (error: unknown) => {
        if (error instanceof ApiError && error.status === 409) {
          // `number` is unique among non-deleted trailers and is the only unique column — the list is
          // server-paged, so there is no client pre-check; the 409 is the authority.
          setError('number', { message: VALIDATION_MESSAGES.trailerNumberTaken });
          return;
        }
        if (error instanceof ApiError) {
          const fieldErrors = error.fieldErrors;
          for (const [field, message] of Object.entries(fieldErrors)) {
            if (field === 'number' || field === 'vin' || field === 'status') setError(field, { message });
          }
          if (Object.keys(fieldErrors).length > 0) return;
        }
        toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
      },
    };
    if (isEdit) {
      // A cleared VIN on edit is sent as '' — `vin: undefined` would silently keep the old one.
      updateMutation.mutate({ number: values.number, vin: values.vin, status: values.status }, callbacks);
    } else {
      createMutation.mutate(base, callbacks);
    }
  }

  const statuses: TrailerStatus[] = ['ACTIVE', 'INACTIVE', ...(trailer?.status === 'OUT_OF_SERVICE' ? (['OUT_OF_SERVICE'] as const) : [])];

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit trailer ${trailer?.number}` : 'Add trailer'}
      subtitle={isEdit ? 'Update the trailer details' : 'Register a trailer so it can be attached to trips'}
      size="md"
      isDirty={isDirty}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button variant="primary" size="lg" loading={submitting} onClick={() => void handleSubmit(onSubmit)()}>
            {isEdit ? 'Save changes' : 'Save trailer'}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <Field label="Trailer number" required error={errors.number?.message}>
          <input
            {...register('number')}
            placeholder="e.g. T-4471"
            maxLength={40}
            aria-invalid={errors.number ? true : undefined}
            disabled={submitting}
            className={inputClass}
          />
        </Field>
        <Field label="VIN" error={errors.vin?.message}>
          <input
            {...register('vin')}
            placeholder="17-character VIN (optional)"
            aria-invalid={errors.vin ? true : undefined}
            disabled={submitting}
            className={inputClass}
          />
        </Field>
        {isEdit && (
          <Field label="Status" error={errors.status?.message}>
            <select {...register('status')} disabled={submitting} className={inputClass}>
              {statuses.map((s) => (
                <option key={s} value={s} disabled={s === 'OUT_OF_SERVICE'}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        )}
      </form>
    </Modal>
  );
}
