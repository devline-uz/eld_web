// owner: web-vehicles-drivers — 11.4 `Co-driver ▾` (web/tz.md §11.4) as its own write: team driving
// is a time-bounded pairing row (B-7 `POST /co-driver-pairings`), never part of
// `POST /vehicles/:id/assign-driver`, so it gets its own modal next to the unit's primary driver.
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { useToast } from '@/shared/ui/Toast';
import { useCreateCoDriverPairing, type DriverRow, type VehicleRow } from '@/shared/api/vehicles';
import { useDriversList } from '@/shared/api/drivers';
import { ApiError, coDriverPairingErrorMessage } from '@/shared/api/errors';

const driverName = (driver: Pick<DriverRow, 'firstName' | 'lastName' | 'username'>) =>
  [driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.username || 'Unnamed driver';

/** `datetime-local` gives a zone-less `YYYY-MM-DDTHH:mm` in the dispatcher's local time — send ISO. */
function toIso(local: string): string | null {
  const at = new Date(local);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

export function AssignCoDriverModal({
  vehicle,
  primaryDriver,
  onClose,
}: {
  vehicle: VehicleRow;
  primaryDriver: Pick<DriverRow, 'id' | 'firstName' | 'lastName' | 'username'>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Optional — empty means "now" (the server defaults `startedAt`).
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  // Only ACTIVE drivers can drive; the server filters (`?status=ACTIVE`) and never lists deleted
  // ones. The unit's primary driver cannot also be its co-driver (the server 409s on that).
  const driversQuery = useDriversList({ q: query || undefined, limit: 25, status: 'ACTIVE' });
  const candidates = (driversQuery.data?.items ?? []).filter((d) => d.id !== primaryDriver.id && d.status === 'ACTIVE');
  const mutation = useCreateCoDriverPairing();

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign co-driver to unit ${vehicle.unitNumber}`}
      subtitle={`Primary driver: ${driverName(primaryDriver)}`}
      size="md"
      isDirty={selectedId !== null || effectiveFrom !== ''}
      footer={
        <>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="primary"
            size="lg"
            disabled={!selectedId}
            loading={mutation.isPending}
            onClick={() => {
              if (!selectedId) return;
              setAssignError(null);
              let startedAt: string | undefined;
              if (effectiveFrom) {
                const iso = toIso(effectiveFrom);
                if (!iso) {
                  setAssignError('Effective from: Enter a valid date and time.');
                  return;
                }
                startedAt = iso;
              }
              mutation.mutate(
                { primaryDriverId: primaryDriver.id, coDriverId: selectedId, vehicleId: vehicle.id, startedAt },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', title: 'Co-driver assigned' });
                    onClose();
                  },
                  onError: (error) => {
                    if (error instanceof ApiError && error.status === 403) {
                      toast({ kind: 'error', title: 'You do not have permission to assign co-drivers.' });
                      return;
                    }
                    setAssignError(
                      coDriverPairingErrorMessage(error, { coDriverId: 'Co-driver', primaryDriverId: 'Primary driver', startedAt: 'Effective from' }),
                    );
                  },
                },
              );
            }}
          >
            Assign co-driver
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {assignError && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body text-danger">
            {assignError}
          </p>
        )}
        <div className="flex h-input items-center gap-2 rounded-md border border-border px-3">
          <Search size={16} strokeWidth={1.75} className="text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search driver by name, username or licence"
            placeholder="Search driver by name, username or licence…"
            className="h-full flex-1 bg-transparent text-body outline-none"
          />
        </div>
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {candidates.map((driver) => {
            const name = driverName(driver);
            return (
              <li key={driver.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(driver.id);
                    setAssignError(null);
                  }}
                  aria-pressed={selectedId === driver.id}
                  className={`flex w-full items-center gap-3 rounded-md border p-2 text-left ${
                    selectedId === driver.id ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-bg-subtle'
                  }`}
                >
                  <input type="radio" readOnly checked={selectedId === driver.id} />
                  <Avatar name={name} size="sm" />
                  <span className="flex-1">
                    <span className="block text-body-strong text-text">{name}</span>
                    <span className="block text-caption text-text-muted">
                      Active · {driver.assignedVehicleId ? 'unit assigned' : 'no unit assigned'} · {driver.homeTerminalName}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {driversQuery.isLoading && <li className="p-2 text-body text-text-muted">Loading drivers…</li>}
          {!driversQuery.isLoading && candidates.length === 0 && (
            <li className="p-2 text-body text-text-muted">No drivers match this search.</li>
          )}
        </ul>
        <label className="flex flex-col gap-1">
          <span className="text-body-strong text-text">Effective from</span>
          <input
            type="datetime-local"
            value={effectiveFrom}
            onChange={(e) => {
              setEffectiveFrom(e.target.value);
              setAssignError(null);
            }}
            className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text"
          />
          <span className="text-caption text-text-muted">Optional — leave empty to start the pairing now.</span>
        </label>
      </div>
    </Modal>
  );
}
