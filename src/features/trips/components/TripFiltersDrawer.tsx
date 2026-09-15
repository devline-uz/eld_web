// owner: web-dispatch-messaging — W-11 Dispatch & Trips, 11.23 Filters (web/tz.md §11.23).
// Design: mirrors web/roles and screens/admin panel/Real-time GPS map, vehicle list, unit detail card.jpg
// (the drawer shell 11.23 draws) with W-11's own filter set — no dedicated Trips filters mock exists.
import { useState } from 'react';
import { FilterDrawer, FilterGroup, FilterCheckbox } from '@/shared/ui/FilterDrawer';
import { Badge } from '@/shared/ui/Badge';
import {
  EMPTY_TRIP_FILTERS,
  TRIP_STATUS_OPTIONS,
  countActiveTripFilters,
  type TripFilters,
} from '../lib/filters';

const selectClass = 'h-input w-full rounded-md border border-border bg-bg-surface px-3 text-body text-text';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export interface TripFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: TripFilters;
  onApply: (filters: TripFilters) => void;
  driverOptions: { id: string; name: string }[];
  vehicleOptions: { id: string; unitNumber: string }[];
  terminalOptions: string[];
}

export function TripFiltersDrawer({
  open,
  onClose,
  filters,
  onApply,
  driverOptions,
  vehicleOptions,
  terminalOptions,
}: TripFiltersDrawerProps) {
  // No sync effect: the parent remounts this component (`key={filtersRevision}`) each time it
  // opens, so the draft always starts fresh from the last applied `filters` without setState in
  // an effect (react-hooks/set-state-in-effect).
  const [draft, setDraft] = useState<TripFilters>(filters);

  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      screenName="Trips"
      appliedCount={countActiveTripFilters(draft)}
      onReset={() => setDraft(EMPTY_TRIP_FILTERS)}
      onApply={() => {
        onApply(draft);
        onClose();
      }}
    >
      <FilterGroup title="Status">
        {TRIP_STATUS_OPTIONS.map((status) => (
          <FilterCheckbox
            key={status}
            label={status}
            checked={draft.status.includes(status)}
            onChange={() => setDraft((d) => ({ ...d, status: toggle(d.status, status) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Driver">
        {driverOptions.map((driver) => (
          <FilterCheckbox
            key={driver.id}
            label={driver.name}
            checked={draft.driverId.includes(driver.id)}
            onChange={() => setDraft((d) => ({ ...d, driverId: toggle(d.driverId, driver.id) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Unit">
        {vehicleOptions.map((vehicle) => (
          <FilterCheckbox
            key={vehicle.id}
            label={vehicle.unitNumber}
            checked={draft.vehicleId.includes(vehicle.id)}
            onChange={() => setDraft((d) => ({ ...d, vehicleId: toggle(d.vehicleId, vehicle.id) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Home terminal">
        <select
          value={draft.terminal ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, terminal: e.target.value || null }))}
          className={selectClass}
        >
          <option value="">All terminals</option>
          {terminalOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup title="Depart">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-caption text-text-muted">
            From
            <input
              type="date"
              value={draft.departFrom ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, departFrom: e.target.value || null }))}
              className={selectClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-caption text-text-muted">
            To
            <input
              type="date"
              value={draft.departTo ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, departTo: e.target.value || null }))}
              className={selectClass}
            />
          </label>
        </div>
      </FilterGroup>

      <FilterGroup title="Condition">
        <label className="flex items-center justify-between rounded-md border border-border p-3">
          <span className="text-body text-text">Only trips with no trailer assigned</span>
          <input
            type="checkbox"
            checked={draft.noTrailerOnly}
            onChange={(e) => setDraft((d) => ({ ...d, noTrailerOnly: e.target.checked }))}
          />
        </label>
      </FilterGroup>
    </FilterDrawer>
  );
}

/** Active-filter chips row shown under the control bar (11.23 "shareable" URL filters). */
export function TripFilterChips({
  filters,
  driverById,
  vehicleById,
  onRemove,
  onClearAll,
}: {
  filters: TripFilters;
  driverById: Map<string, string>;
  vehicleById: Map<string, string>;
  onRemove: (patch: Partial<TripFilters>) => void;
  onClearAll: () => void;
}) {
  const chips: { key: string; label: string; patch: Partial<TripFilters> }[] = [];
  if (filters.status.length) chips.push({ key: 'status', label: `Status: ${filters.status.join(', ')}`, patch: { status: [] } });
  if (filters.driverId.length)
    chips.push({
      key: 'driver',
      label: `Driver: ${filters.driverId.map((id) => driverById.get(id) ?? id).join(', ')}`,
      patch: { driverId: [] },
    });
  if (filters.vehicleId.length)
    chips.push({
      key: 'unit',
      label: `Unit: ${filters.vehicleId.map((id) => vehicleById.get(id) ?? id).join(', ')}`,
      patch: { vehicleId: [] },
    });
  if (filters.terminal) chips.push({ key: 'terminal', label: `Terminal: ${filters.terminal}`, patch: { terminal: null } });
  if (filters.departFrom || filters.departTo)
    chips.push({ key: 'depart', label: `Depart ${filters.departFrom ?? '…'} – ${filters.departTo ?? '…'}`, patch: { departFrom: null, departTo: null } });
  if (filters.noTrailerOnly) chips.push({ key: 'noTrailer', label: 'No trailer assigned', patch: { noTrailerOnly: false } });

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button key={chip.key} type="button" onClick={() => onRemove(chip.patch)} className="rounded-full">
          <Badge tone="info">{`${chip.label} ×`}</Badge>
        </button>
      ))}
      <button type="button" onClick={onClearAll} className="text-caption font-medium text-primary hover:underline">
        Clear all
      </button>
    </div>
  );
}
