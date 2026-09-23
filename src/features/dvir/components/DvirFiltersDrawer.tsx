// owner: web-dvir-safety — W-09 DVIR & Maintenance, 11.23 Filters (web/tz.md §11.23).
// Design: web/roles and screens/admin panel/Real-time GPS map, vehicle list, unit detail card.jpg
// (the drawer shell 11.23 draws) with W-09's own filter set — no dedicated DVIR filters mock exists.
import { useState } from 'react';
import { FilterDrawer, FilterGroup, FilterCheckbox } from '@/shared/ui/FilterDrawer';
import { Badge } from '@/shared/ui/Badge';
import {
  DVIR_TYPE_OPTIONS,
  DVIR_SEVERITY_OPTIONS,
  DVIR_REPAIR_STATUS_OPTIONS,
  EMPTY_DVIR_FILTERS,
  countActiveDvirFilters,
  sameDvirFilters,
  type DvirFilters,
} from '../lib/filters';
import type { DefectSeverity, DvirType, RepairStatus } from '@/shared/api/dvir';

const TYPE_LABEL: Record<DvirType, string> = {
  PRE_TRIP: 'Pre-trip',
  POST_TRIP: 'Post-trip',
  INTERMEDIATE: 'Intermediate',
};

const SEVERITY_LABEL: Record<DefectSeverity, string> = {
  CRITICAL: 'Critical',
  MAJOR: 'Major',
  MINOR: 'Minor',
};

const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  NOT_REQUIRED: 'Not required',
  PENDING: 'Pending',
  REPAIRED: 'Repaired',
  DEFERRED: 'Deferred',
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export interface DvirFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: DvirFilters;
  onApply: (filters: DvirFilters) => void;
}

export function DvirFiltersDrawer({ open, onClose, filters, onApply }: DvirFiltersDrawerProps) {
  // No sync effect: the parent remounts this component (`key={filtersRevision}`) each time it
  // opens, so the draft always starts fresh from the last applied `filters` without setState in
  // an effect (react-hooks/set-state-in-effect).
  const [draft, setDraft] = useState<DvirFilters>(filters);

  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      screenName="DVIRs"
      appliedCount={countActiveDvirFilters(draft)}
      isDirty={!sameDvirFilters(draft, filters)}
      onReset={() => setDraft(EMPTY_DVIR_FILTERS)}
      onApply={() => {
        onApply(draft);
        onClose();
      }}
    >
      <FilterGroup title="Type">
        {DVIR_TYPE_OPTIONS.map((type) => (
          <FilterCheckbox
            key={type}
            label={TYPE_LABEL[type]}
            checked={draft.type.includes(type)}
            onChange={() => setDraft((d) => ({ ...d, type: toggle(d.type, type) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Severity">
        {DVIR_SEVERITY_OPTIONS.map((severity) => (
          <FilterCheckbox
            key={severity}
            label={SEVERITY_LABEL[severity]}
            checked={draft.severity.includes(severity)}
            onChange={() => setDraft((d) => ({ ...d, severity: toggle(d.severity, severity) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Repair status">
        {DVIR_REPAIR_STATUS_OPTIONS.map((status) => (
          <FilterCheckbox
            key={status}
            label={REPAIR_STATUS_LABEL[status]}
            checked={draft.repairStatus.includes(status)}
            onChange={() => setDraft((d) => ({ ...d, repairStatus: toggle(d.repairStatus, status) }))}
          />
        ))}
      </FilterGroup>
    </FilterDrawer>
  );
}

/** Active-filter chips row shown under the control bar (11.23 "shareable" URL filters). */
export function DvirFilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: DvirFilters;
  onRemove: (patch: Partial<DvirFilters>) => void;
  onClearAll: () => void;
}) {
  const chips: { key: string; label: string; patch: Partial<DvirFilters> }[] = [];
  if (filters.type.length) chips.push({ key: 'type', label: `Type: ${filters.type.map((t) => TYPE_LABEL[t]).join(', ')}`, patch: { type: [] } });
  if (filters.severity.length)
    chips.push({ key: 'severity', label: `Severity: ${filters.severity.map((s) => SEVERITY_LABEL[s]).join(', ')}`, patch: { severity: [] } });
  if (filters.repairStatus.length)
    chips.push({
      key: 'repair',
      label: `Repair status: ${filters.repairStatus.map((s) => REPAIR_STATUS_LABEL[s]).join(', ')}`,
      patch: { repairStatus: [] },
    });

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
