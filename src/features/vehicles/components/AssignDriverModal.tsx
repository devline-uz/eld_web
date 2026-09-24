// owner: web-vehicles-drivers — 11.4 Assign driver to unit (web/tz.md §11.4).
// Hard rule: an OUT_OF_SERVICE unit refuses assignment — show the reason, never a silent 409.
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { useToast } from '@/shared/ui/Toast';
import { useAssignDriver, type VehicleRow } from '@/shared/api/vehicles';
import { useDriversList } from '@/shared/api/drivers';
import { ApiError } from '@/shared/api/errors';

export function AssignDriverModal({ vehicle, onClose }: { vehicle: VehicleRow; onClose: () => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const outOfService = vehicle.status === 'OUT_OF_SERVICE';

  const driversQuery = useDriversList({ q: query || undefined, limit: 25 });
  const mutation = useAssignDriver(vehicle.id);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign driver to unit ${vehicle.unitNumber}`}
      subtitle={[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
      size="md"
      // Picking a driver is a real edit — closing then routes through the 11.30 discard confirm,
      // from Cancel exactly as from Esc / X.
      isDirty={selectedId !== null}
      footer={
        <>
          {/* B-74 shipped — `POST /vehicles/:id/assign-driver` now takes `notify`. */}
          <label className="mr-auto flex items-center gap-2 text-body text-text-secondary">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Notify the driver in the app
          </label>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="primary"
            size="lg"
            disabled={outOfService || !selectedId}
            loading={mutation.isPending}
            onClick={() => {
              if (!selectedId) return;
              mutation.mutate(
                { driverId: selectedId, notify },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', title: 'Driver assigned' });
                    onClose();
                  },
                  onError: (error) => {
                    if (error instanceof ApiError && error.status === 403) {
                      toast({ kind: 'error', title: 'You do not have permission to assign drivers.' });
                      return;
                    }
                    toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
                  },
                },
              );
            }}
          >
            Assign driver
          </Button>
        </>
      }
    >
      {outOfService ? (
        <p className="rounded-md bg-danger-soft p-3 text-body text-danger">
          Unit {vehicle.unitNumber} is out of service. Close the critical defect before assigning
          a driver.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
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
            {(driversQuery.data?.items ?? []).map((driver) => {
              // A roster row missing a name rendered literally as "undefined undefined".
              const name = [driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.username || 'Unnamed driver';
              return (
                <li key={driver.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(driver.id)}
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
                        {driver.status === 'ACTIVE' ? 'Active' : driver.status} · {driver.assignedVehicleId ? 'unit assigned' : 'no unit assigned'} ·{' '}
                        {driver.homeTerminalName}
                      </span>
                    </span>
                    {/* ⛔ GAP B-2 — no per-driver HOS read endpoint; hours cannot be shown here. */}
                    <span className="text-right text-caption text-text-muted">—</span>
                  </button>
                </li>
              );
            })}
            {driversQuery.isLoading && <li className="p-2 text-body text-text-muted">Loading drivers…</li>}
            {!driversQuery.isLoading && (driversQuery.data?.items.length ?? 0) === 0 && (
              <li className="p-2 text-body text-text-muted">No drivers match this search.</li>
            )}
          </ul>
        </div>
      )}
    </Modal>
  );
}
