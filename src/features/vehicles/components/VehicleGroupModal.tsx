// owner: web-vehicles-drivers — New / Edit vehicle group (WD-116). `vehicles` FULL.
// Fields mirror `CreateVehicleGroupDto` (`name` 1–80, `description` ≤ 300, `color` #RRGGBB) plus
// the unit picker: create sends `vehicleIds` with the POST; edit PATCHes the details and, only when
// the selection changed, replaces the membership with `PUT /vehicle-groups/:id/vehicles`.
import { useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Search } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { GROUP_COLOR_OPTIONS, GroupColorDot } from '@/shared/ui/GroupColor';
import { cn } from '@/shared/ui/cn';
import { vehicleGroupSchema, type VehicleGroupFormValues } from '@/shared/forms/schemas';
import { LIMITS, VALIDATION_MESSAGES } from '@/shared/forms/messages';
import { ApiError } from '@/shared/api/errors';
import { useVehiclesLookup } from '@/shared/api/lookups';
import {
  useCreateVehicleGroup,
  useSetVehicleGroupVehicles,
  useUpdateVehicleGroup,
  useVehicleGroup,
  type VehicleGroupRow,
} from '@/shared/api/vehicles';

const inputClass =
  'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text disabled:bg-bg-subtle';

function Field({
  label,
  htmlFor,
  required,
  error,
  errorId,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  errorId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-label text-text">
        {label}{' '}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <span id={errorId} className="text-caption text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

const sameIds = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

export interface VehicleGroupModalProps {
  /** Present ⇒ edit mode. */
  group?: VehicleGroupRow;
  /** Every group, to name the group a picked unit currently belongs to. */
  groups: VehicleGroupRow[];
  onClose: () => void;
}

export function VehicleGroupModal({ group, groups, onClose }: VehicleGroupModalProps) {
  const isEdit = Boolean(group);
  const detail = useVehicleGroup(group?.id);
  // Edit waits for the group's real membership before showing the form, so the picker never
  // starts from a guess and a save never drops units it did not show.
  if (isEdit && (detail.isPending || detail.isError)) {
    return (
      <Modal
        open
        onClose={onClose}
        title={`Edit group ${group!.name}`}
        size="lg"
        footer={<ModalCancelButton />}
      >
        {detail.isError ? (
          <ErrorState
            title="Could not load the group"
            description="Its units did not load. Try again in a moment."
            onRetry={() => void detail.refetch()}
          />
        ) : (
          <LoadingState />
        )}
      </Modal>
    );
  }
  return (
    <VehicleGroupForm
      group={group}
      groups={groups}
      initialIds={detail.data?.vehicles.map((v) => v.id) ?? []}
      onClose={onClose}
    />
  );
}

function VehicleGroupForm({
  group,
  groups,
  initialIds,
  onClose,
}: VehicleGroupModalProps & { initialIds: string[] }) {
  const { toast } = useToast();
  const isEdit = Boolean(group);
  const vehicles = useVehiclesLookup();
  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, dirtyFields },
    setError,
  } = useForm<VehicleGroupFormValues>({
    resolver: zodResolver(vehicleGroupSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      name: group?.name ?? '',
      description: group?.description ?? '',
      color: group?.color ?? GROUP_COLOR_OPTIONS[0]!.value,
    },
  });

  const initial = useMemo(() => new Set(initialIds), [initialIds]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialIds));
  const [search, setSearch] = useState('');
  const membershipChanged = !sameIds(selected, initial);
  const isDirty = Object.keys(dirtyFields).length > 0 || membershipChanged;

  const createMutation = useCreateVehicleGroup();
  const updateMutation = useUpdateVehicleGroup(group?.id ?? '');
  const membersMutation = useSetVehicleGroupVehicles(group?.id ?? '');
  const [banner, setBanner] = useState<string | null>(null);
  const inFlight = useRef(false);
  const submitting =
    createMutation.isPending || updateMutation.isPending || membersMutation.isPending;

  const rows = useMemo(() => {
    const all = vehicles.data?.items ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? all.filter((v) =>
          [v.unitNumber, v.vin, v.make, v.model].some((s) => s?.toLowerCase().includes(q)),
        )
      : all;
    return [...filtered].sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
    );
  }, [vehicles.data, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleError(error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      setError('name', { message: VALIDATION_MESSAGES.vehicleGroupNameTaken });
      return;
    }
    if (error instanceof ApiError) {
      const fieldErrors = error.fieldErrors;
      let mapped = false;
      for (const [field, message] of Object.entries(fieldErrors)) {
        if (field === 'name' || field === 'description' || field === 'color') {
          setError(field, { message });
          mapped = true;
        }
      }
      if (mapped) return;
      // A 404 `VEHICLE_NOT_FOUND` (a unit deleted meanwhile) or an unmapped 422 lands in the modal.
      if (error.status === 404 || error.status === 422) {
        setBanner(error.message || error.userMessage);
        return;
      }
    }
    toast({
      kind: 'error',
      title: error instanceof ApiError ? error.userMessage : 'Something went wrong.',
    });
  }

  async function onSubmit(values: VehicleGroupFormValues) {
    if (inFlight.current || submitting) return;
    inFlight.current = true;
    setBanner(null);
    const name = values.name.trim();
    const description = values.description.trim() || null;
    const color = values.color || null;
    try {
      if (!isEdit) {
        await createMutation.mutateAsync({ name, description, color, vehicleIds: [...selected] });
        toast({ kind: 'success', ...TOAST_COPY.vehicleGroupCreated(name, selected.size) });
      } else {
        if (Object.keys(dirtyFields).length > 0)
          await updateMutation.mutateAsync({ name, description, color });
        if (membershipChanged) await membersMutation.mutateAsync([...selected]);
        toast({ kind: 'success', ...TOAST_COPY.vehicleGroupUpdated(name) });
      }
      onClose();
    } catch (error) {
      handleError(error);
    } finally {
      inFlight.current = false;
    }
  }

  const submit = () => void handleSubmit(onSubmit)();

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit group ${group!.name}` : 'New vehicle group'}
      subtitle={
        isEdit
          ? 'Update the group details and its units'
          : 'Group units to filter the IFTA and Activity reports'
      }
      size="lg"
      isDirty={isDirty}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button variant="primary" size="lg" loading={submitting} onClick={submit}>
            {isEdit ? 'Save changes' : 'Create group'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {banner && (
          <div role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {banner}
          </div>
        )}
        <Field
          label="Group name"
          htmlFor="vg-name"
          required
          error={errors.name?.message}
          errorId="vg-name-error"
        >
          <input
            id="vg-name"
            {...register('name')}
            placeholder="e.g. Midwest linehaul"
            maxLength={LIMITS.vehicleGroupNameMax}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'vg-name-error' : undefined}
            disabled={submitting}
            className={inputClass}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="vg-description"
          error={errors.description?.message}
          errorId="vg-description-error"
        >
          <input
            id="vg-description"
            {...register('description')}
            placeholder="Optional — e.g. OH / IN / KY lanes"
            maxLength={LIMITS.vehicleGroupDescriptionMax}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? 'vg-description-error' : undefined}
            disabled={submitting}
            className={inputClass}
          />
        </Field>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-label text-text">Color</legend>
              <div role="radiogroup" aria-label="Color" className="flex items-center gap-2">
                {GROUP_COLOR_OPTIONS.map((option) => {
                  const checked = field.value.toUpperCase() === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={option.label}
                      title={option.label}
                      disabled={submitting}
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-full border',
                        checked
                          ? 'border-border-focus'
                          : 'border-transparent hover:border-border-strong',
                      )}
                    >
                      <GroupColorDot color={option.value} className="size-5" />
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span id="vg-units-label" className="text-label text-text">
              Units
            </span>
            <span className="text-caption tabular-nums text-text-muted" aria-live="polite">
              {selected.size} selected
            </span>
          </div>
          <div className="flex h-input items-center gap-2 rounded-md border border-border bg-bg-surface px-3">
            <Search size={16} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unit #, VIN, make…"
              aria-label="Search units"
              className="w-full bg-transparent text-body outline-none"
            />
          </div>
          <div
            role="group"
            aria-labelledby="vg-units-label"
            className="max-h-64 overflow-y-auto rounded-md border border-border"
          >
            {vehicles.isPending ? (
              <LoadingState className="p-3" />
            ) : vehicles.isError ? (
              <ErrorState
                title="Could not load units"
                description="The unit list did not load. Try again in a moment."
                onRetry={() => void vehicles.refetch()}
              />
            ) : rows.length === 0 ? (
              <p className="p-3 text-body text-text-muted">
                {search.trim() ? `No units match "${search.trim()}".` : 'No units yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((v) => {
                  const otherGroup =
                    v.groupId && v.groupId !== group?.id ? groupName.get(v.groupId) : undefined;
                  const label = [v.make, v.model].filter(Boolean).join(' ');
                  return (
                    <li key={v.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-bg-subtle">
                        <input
                          type="checkbox"
                          checked={selected.has(v.id)}
                          onChange={() => toggle(v.id)}
                          disabled={submitting}
                          aria-label={`Unit ${v.unitNumber}`}
                        />
                        <span className="w-20 shrink-0 text-body-strong tabular-nums text-text">
                          {v.unitNumber}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-body text-text-secondary">
                          {label || '—'}
                        </span>
                        {otherGroup && (
                          <span className="shrink-0 text-caption text-text-muted">
                            {selected.has(v.id) ? `Moves from ${otherGroup}` : `In ${otherGroup}`}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-caption text-text-muted">
            A unit belongs to one group at a time; picking it here moves it out of its current
            group.
          </p>
        </div>
      </form>
    </Modal>
  );
}
