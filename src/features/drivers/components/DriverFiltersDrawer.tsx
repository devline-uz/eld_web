// owner: web-vehicles-drivers — W-06 Drivers, 11.23 Filters (web/tz.md §11.23).
// Design: web/roles and screens/admin panel/Driver roster with live HOS clocks and violations.jpg
import { useState } from 'react';
import { FilterDrawer, FilterGroup, FilterCheckbox } from '@/shared/ui/FilterDrawer';
import { Badge } from '@/shared/ui/Badge';
import {
  DRIVER_EXEMPTION_OPTIONS,
  DRIVER_STATUS_OPTIONS,
  EMPTY_DRIVER_FILTERS,
  countActiveDriverFilters,
  type DriverExemptionFilter,
  type DriverFilters,
  type DriverStatusFilter,
} from '../lib/filters';

const STATUS_LABEL: Record<DriverStatusFilter, string> = {
  DRIVING: 'Driving',
  ON_DUTY: 'On-duty (not driving)',
  SLEEPER: 'Sleeper',
  OFF_DUTY: 'Off-duty',
};

const EXEMPTION_LABEL: Record<DriverExemptionFilter, string> = {
  eldExempt: 'ELD exempt',
  allowPersonalConveyance: 'Personal conveyance allowed',
  allowYardMove: 'Yard move allowed',
  shortHaulException: 'Short-haul exception',
  splitSleeperEnabled: 'Split sleeper berth',
};

const selectClass = 'h-input w-full rounded-md border border-border bg-bg-surface px-3 text-body text-text';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export interface DriverFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: DriverFilters;
  onApply: (filters: DriverFilters) => void;
  terminalOptions: string[];
}

export function DriverFiltersDrawer({ open, onClose, filters, onApply, terminalOptions }: DriverFiltersDrawerProps) {
  // No sync effect: the parent remounts this component (`key={filtersRevision}`) each time it
  // opens, so the draft always starts fresh from the last applied `filters` without setState in
  // an effect (react-hooks/set-state-in-effect).
  const [draft, setDraft] = useState<DriverFilters>(filters);

  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      screenName="Drivers"
      appliedCount={countActiveDriverFilters(draft)}
      onReset={() => setDraft(EMPTY_DRIVER_FILTERS)}
      onApply={() => {
        onApply(draft);
        onClose();
      }}
    >
      <FilterGroup title="Status">
        {DRIVER_STATUS_OPTIONS.map((status) => (
          <FilterCheckbox
            key={status}
            label={STATUS_LABEL[status]}
            checked={draft.status.includes(status)}
            onChange={() => setDraft((d) => ({ ...d, status: toggle(d.status, status) }))}
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

      <FilterGroup title="Violations">
        <label className="flex items-center justify-between rounded-md border border-border p-3">
          <span className="text-body text-text">Only drivers with open violations</span>
          <input
            type="checkbox"
            checked={draft.violationsOnly}
            onChange={(e) => setDraft((d) => ({ ...d, violationsOnly: e.target.checked }))}
          />
        </label>
      </FilterGroup>

      <FilterGroup title="Exemptions">
        {DRIVER_EXEMPTION_OPTIONS.map((key) => (
          <FilterCheckbox
            key={key}
            label={EXEMPTION_LABEL[key]}
            checked={draft.exemptions.includes(key)}
            onChange={() => setDraft((d) => ({ ...d, exemptions: toggle(d.exemptions, key) }))}
          />
        ))}
      </FilterGroup>
    </FilterDrawer>
  );
}

/** Active-filter chips row shown under the control bar (11.23 "shareable" URL filters). */
export function DriverFilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: DriverFilters;
  onRemove: (patch: Partial<DriverFilters>) => void;
  onClearAll: () => void;
}) {
  const chips: { key: string; label: string; patch: Partial<DriverFilters> }[] = [];
  if (filters.status.length) chips.push({ key: 'status', label: `Status: ${filters.status.map((s) => STATUS_LABEL[s]).join(', ')}`, patch: { status: [] } });
  if (filters.terminal) chips.push({ key: 'terminal', label: `Terminal: ${filters.terminal}`, patch: { terminal: null } });
  if (filters.violationsOnly) chips.push({ key: 'violations', label: 'Open violations only', patch: { violationsOnly: false } });
  if (filters.exemptions.length)
    chips.push({ key: 'exemptions', label: `Exemptions: ${filters.exemptions.map((e) => EXEMPTION_LABEL[e]).join(', ')}`, patch: { exemptions: [] } });

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
