// owner: web-vehicles-drivers — W-03 Vehicles, 11.23 Filters (web/tz.md §11.23).
// Design: web/roles and screens/admin panel/Real-time GPS map, vehicle list, unit detail card.jpg
import { useState } from 'react';
import { FilterDrawer, FilterGroup, FilterCheckbox } from '@/shared/ui/FilterDrawer';
import { Badge } from '@/shared/ui/Badge';
import {
  EMPTY_VEHICLE_FILTERS,
  VEHICLE_STATUS_OPTIONS,
  countActiveVehicleFilters,
  sameVehicleFilters,
  type VehicleFilters,
  type VehicleStatusFilter,
} from '../lib/filters';

const STATUS_LABEL: Record<VehicleStatusFilter, string> = {
  DRIVING: 'Driving',
  IDLE: 'Idle',
  OFF_DUTY: 'Off duty',
  ELD_OFFLINE: 'ELD offline',
  INACTIVE: 'Inactive',
};

const selectClass = 'h-input w-full rounded-md border border-border bg-bg-surface px-3 text-body text-text';

/** Year filter bounds (11.23): no unit predates 1970; the ceiling tracks the current year. */
const MIN_YEAR = 1970;

export interface VehicleFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: VehicleFilters;
  onApply: (filters: VehicleFilters) => void;
  eldDeviceOptions: string[];
  makeOptions: string[];
  terminalOptions: string[];
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function VehicleFiltersDrawer({
  open,
  onClose,
  filters,
  onApply,
  eldDeviceOptions,
  makeOptions,
  terminalOptions,
}: VehicleFiltersDrawerProps) {
  // No sync effect: the parent remounts this component (`key={filtersRevision}`) each time it
  // opens, so the draft always starts fresh from the last applied `filters` without setState in
  // an effect (react-hooks/set-state-in-effect).
  const [draft, setDraft] = useState<VehicleFilters>(filters);

  // Computed fresh each render (not module-level) so a drawer left open across a year boundary
  // still reads today's ceiling.
  const currentYear = new Date().getFullYear();
  const effectiveYearFrom = draft.yearFrom ?? MIN_YEAR;
  const effectiveYearTo = draft.yearTo ?? currentYear;
  const yearFromMax = Math.min(currentYear, effectiveYearTo);
  const yearToMin = Math.max(MIN_YEAR, effectiveYearFrom);

  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      screenName="Vehicles"
      appliedCount={countActiveVehicleFilters(draft)}
      isDirty={!sameVehicleFilters(draft, filters)}
      onReset={() => setDraft(EMPTY_VEHICLE_FILTERS)}
      onApply={() => {
        onApply(draft);
        onClose();
      }}
    >
      <FilterGroup title="Status">
        {VEHICLE_STATUS_OPTIONS.map((status) => (
          <FilterCheckbox
            key={status}
            label={STATUS_LABEL[status]}
            checked={draft.status.includes(status)}
            onChange={() => setDraft((d) => ({ ...d, status: toggle(d.status, status) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="ELD device">
        {eldDeviceOptions.map((device) => (
          <FilterCheckbox
            key={device}
            label={device}
            checked={draft.eldDevice.includes(device)}
            onChange={() => setDraft((d) => ({ ...d, eldDevice: toggle(d.eldDevice, device) }))}
          />
        ))}
        <FilterCheckbox
          label="Not assigned"
          checked={draft.eldDevice.includes('UNASSIGNED')}
          onChange={() => setDraft((d) => ({ ...d, eldDevice: toggle(d.eldDevice, 'UNASSIGNED') }))}
        />
      </FilterGroup>

      <FilterGroup title="Make">
        {makeOptions.map((make) => (
          <FilterCheckbox
            key={make}
            label={make}
            checked={draft.make.includes(make)}
            onChange={() => setDraft((d) => ({ ...d, make: toggle(d.make, make) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Year">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-caption text-text-muted">
            Year from
            <input
              type="number"
              min={MIN_YEAR}
              max={yearFromMax}
              value={draft.yearFrom ?? MIN_YEAR}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setDraft((d) => ({ ...d, yearFrom: null }));
                  return;
                }
                const parsed = Number(raw);
                if (Number.isNaN(parsed)) return;
                setDraft((d) => ({ ...d, yearFrom: parsed }));
              }}
              onBlur={() =>
                setDraft((d) => {
                  if (d.yearFrom == null) return d;
                  const bound = Math.min(currentYear, d.yearTo ?? currentYear);
                  const clamped = Math.min(Math.max(d.yearFrom, MIN_YEAR), bound);
                  return clamped === d.yearFrom ? d : { ...d, yearFrom: clamped };
                })
              }
              className={selectClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-caption text-text-muted">
            Year to
            <input
              type="number"
              min={yearToMin}
              max={currentYear}
              value={draft.yearTo ?? currentYear}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setDraft((d) => ({ ...d, yearTo: null }));
                  return;
                }
                const parsed = Number(raw);
                if (Number.isNaN(parsed)) return;
                setDraft((d) => ({ ...d, yearTo: parsed }));
              }}
              onBlur={() =>
                setDraft((d) => {
                  if (d.yearTo == null) return d;
                  const bound = Math.max(MIN_YEAR, d.yearFrom ?? MIN_YEAR);
                  const clamped = Math.max(Math.min(d.yearTo, currentYear), bound);
                  return clamped === d.yearTo ? d : { ...d, yearTo: clamped };
                })
              }
              className={selectClass}
            />
          </label>
        </div>
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

      <FilterGroup title="Condition">
        <label className="flex items-center justify-between rounded-md border border-border p-3">
          <span className="text-body text-text">Only units with open defects</span>
          <input
            type="checkbox"
            checked={draft.openDefectsOnly}
            onChange={(e) => setDraft((d) => ({ ...d, openDefectsOnly: e.target.checked }))}
          />
        </label>
        <label className="flex items-center justify-between rounded-md border border-border p-3">
          <span className="text-body text-text">Only units with firmware out of date</span>
          <input
            type="checkbox"
            checked={draft.firmwareOutdatedOnly}
            onChange={(e) => setDraft((d) => ({ ...d, firmwareOutdatedOnly: e.target.checked }))}
          />
        </label>
      </FilterGroup>
    </FilterDrawer>
  );
}

/** Active-filter chips row shown under the control bar (11.23 "shareable" URL filters). */
export function VehicleFilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: VehicleFilters;
  onRemove: (patch: Partial<VehicleFilters>) => void;
  onClearAll: () => void;
}) {
  const chips: { key: string; label: string; patch: Partial<VehicleFilters> }[] = [];
  if (filters.status.length) chips.push({ key: 'status', label: `Status: ${filters.status.map((s) => STATUS_LABEL[s]).join(', ')}`, patch: { status: [] } });
  if (filters.eldDevice.length) chips.push({ key: 'device', label: `ELD device: ${filters.eldDevice.length}`, patch: { eldDevice: [] } });
  if (filters.make.length) chips.push({ key: 'make', label: `Make: ${filters.make.join(', ')}`, patch: { make: [] } });
  if (filters.yearFrom != null || filters.yearTo != null)
    chips.push({ key: 'year', label: `Year ${filters.yearFrom ?? '…'}–${filters.yearTo ?? '…'}`, patch: { yearFrom: null, yearTo: null } });
  if (filters.terminal) chips.push({ key: 'terminal', label: `Terminal: ${filters.terminal}`, patch: { terminal: null } });
  if (filters.openDefectsOnly) chips.push({ key: 'defects', label: 'Open defects only', patch: { openDefectsOnly: false } });
  if (filters.firmwareOutdatedOnly) chips.push({ key: 'firmware', label: 'Firmware outdated only', patch: { firmwareOutdatedOnly: false } });

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
