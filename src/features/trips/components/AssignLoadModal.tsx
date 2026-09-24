// owner: web-dispatch-messaging — 11.4 Assign driver, load variant (web/tz.md §11.4):
// "Load uchun variant: sarlavha `Assign driver to load LD-9912`, endpoint `POST /trips/:id/assign`."
import { useMemo, useRef, useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
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
  // B-74 (shipped) — `POST /trips/:id/assign` now takes `notify` (server default `true`); starts
  // checked so an untouched submit keeps the previous (only) behaviour.
  const [notify, setNotify] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

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
      isDirty={Boolean(selectedId) || query !== '' || !notify}
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-body text-text-secondary">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Notify the driver in the app
          </label>
          <ModalCancelButton disabled={mutation.isPending} />
          <Button
            variant="primary"
            size="lg"
            disabled={!selectedId || blocked || mutation.isPending}
            loading={mutation.isPending}
            onClick={() => {
              // `mutate()` returns immediately — without this a double click assigns twice.
              if (!selectedId || mutation.isPending) return;
              mutation.mutate(
                { driverId: selectedId, notify },
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
          onKeyDown={(e) => {
            // WB-237 — Enter picks the first driver the (live-filtered) list shows and moves focus
            // to its radio; it never submits the modal, and does nothing when nothing matches.
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const first = driversQuery.data?.items[0];
            if (!first) return;
            setSelectedId(first.id);
            listRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
          }}
          aria-label="Search driver by name, username or licence"
          placeholder="Search driver by name, username or licence…"
          className="h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text outline-none"
        />
        {blocked && (
          <p className="rounded-md bg-danger-soft p-3 text-body text-danger">
            This driver&apos;s e-mail is not verified. Verify it before assigning a trip.
          </p>
        )}
        {driversQuery.isLoading && <p className="p-2 text-body text-text-muted">Loading drivers…</p>}
        {/* A native radio group (shared `name`) inside labels: arrow keys move the selection and
            there is no interactive element nested in another (the old row was a radio in a button). */}
        <div ref={listRef} role="radiogroup" aria-label="Driver" className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {(driversQuery.data?.items ?? []).map((driver) => {
            const name = [driver.firstName, driver.lastName].filter(Boolean).join(' ') || driver.username || 'Unnamed driver';
            const checked = selectedId === driver.id;
            return (
              <label
                key={driver.id}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-md border p-2 text-left ${
                  checked ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-bg-subtle'
                }`}
              >
                <input
                  type="radio"
                  name={`assign-load-${load.id}-driver`}
                  value={driver.id}
                  checked={checked}
                  onChange={() => setSelectedId(driver.id)}
                  aria-label={name}
                />
                <Avatar name={name} size="sm" />
                <span className="flex-1">
                  <span className="block text-body-strong text-text">{name}</span>
                  <span className="block text-caption text-text-muted">
                    {driver.status === 'ACTIVE' ? 'Active' : driver.status} · {driver.homeTerminalName}
                  </span>
                </span>
                {/* ⛔ GAP B-2 — no per-driver HOS read endpoint; hours cannot be shown here. */}
                <span className="text-right text-caption text-text-muted">—</span>
              </label>
            );
          })}
        </div>
        {!driversQuery.isLoading && (driversQuery.data?.items.length ?? 0) === 0 && (
          <p className="p-2 text-body text-text-muted">No drivers match this search.</p>
        )}
      </div>
    </Modal>
  );
}
