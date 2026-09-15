// owner: web-dispatch-messaging — 11.4 Assign driver, load variant (web/tz.md §11.4):
// "Load uchun variant: sarlavha `Assign driver to load LD-9912`, endpoint `POST /trips/:id/assign`."
import { useMemo, useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { useToast } from '@/shared/ui/Toast';
import { useDriversList } from '@/shared/api/drivers';
import { useAssignTrip, blocksAssignment, type TripRow } from '@/shared/api/trips';
import { ApiError } from '@/shared/api/errors';

export function AssignLoadModal({ load, onClose }: { load: TripRow; onClose: () => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  const driversQuery = useDriversList({ q: query || undefined, limit: 25 });
  const mutation = useAssignTrip(load.id);

  const selectedDriver = useMemo(() => driversQuery.data?.items.find((d) => d.id === selectedId) ?? null, [driversQuery.data, selectedId]);
  const blocked = blocksAssignment(selectedDriver as { emailVerified?: boolean | null } | null);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign driver to load ${load.number}`}
      size="md"
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-body text-text-secondary">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Notify the driver in the app
          </label>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!selectedId || blocked}
            loading={mutation.isPending}
            onClick={() => {
              if (!selectedId) return;
              mutation.mutate(
                { driverId: selectedId },
                {
                  onSuccess: () => {
                    toast({ kind: 'success', title: `Load ${load.number} assigned` });
                    onClose();
                  },
                  onError: (error) => {
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
      <div className="flex flex-col gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search driver by name, username or licence…"
          className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text outline-none"
        />
        {blocked && (
          <p className="rounded-md bg-danger-soft p-3 text-body text-danger">
            This driver&apos;s e-mail is not verified. Verify it before assigning a trip.
          </p>
        )}
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {(driversQuery.data?.items ?? []).map((driver) => {
            const name = `${driver.firstName} ${driver.lastName}`;
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
                      {driver.status === 'ACTIVE' ? 'Active' : driver.status} · {driver.homeTerminalName}
                    </span>
                  </span>
                  {/* ⛔ GAP B-2 — no per-driver HOS read endpoint; hours cannot be shown here. */}
                  <span className="text-right text-caption text-text-muted">—</span>
                </button>
              </li>
            );
          })}
          {!driversQuery.isLoading && (driversQuery.data?.items.length ?? 0) === 0 && (
            <li className="p-2 text-body text-text-muted">No drivers match this search.</li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
