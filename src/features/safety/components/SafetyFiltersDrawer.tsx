// owner: web-dvir-safety — W-10 Safety, 11.23 Filters (web/tz.md §11.23).
// Design: web/roles and screens/admin panel/Real-time GPS map, vehicle list, unit detail card.jpg
// (the drawer shell 11.23 draws) with W-10's own filter set — no dedicated Safety filters mock exists.
import { useState } from 'react';
import { FilterDrawer, FilterGroup, FilterCheckbox } from '@/shared/ui/FilterDrawer';
import { Badge } from '@/shared/ui/Badge';
import {
  SAFETY_EVENT_TYPE_OPTIONS,
  SAFETY_SEVERITY_OPTIONS,
  SAFETY_COACHING_STATUS_OPTIONS,
  EMPTY_SAFETY_FILTERS,
  countActiveSafetyFilters,
  writeSafetyFilters,
  type SafetyFilters,
  type SafetySeverityBucket,
} from '../lib/filters';
import type { CoachingStatus, SafetyEventType } from '@/shared/api/safety';

const TYPE_LABEL: Record<SafetyEventType, string> = {
  HARSH_BRAKING: 'Harsh braking',
  HARSH_ACCEL: 'Harsh acceleration',
  HARSH_TURN: 'Harsh turn',
  SPEEDING: 'Speeding',
  SEATBELT: 'Seatbelt',
};

const SEVERITY_LABEL: Record<SafetySeverityBucket, string> = {
  CRITICAL: 'Critical',
  MAJOR: 'Major',
  MINOR: 'Minor',
};

const COACHING_STATUS_LABEL: Record<CoachingStatus, string> = {
  NEW: 'New',
  REVIEWED: 'Reviewed',
  COACHED: 'Coached',
  DISMISSED: 'Dismissed',
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export interface SafetyFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: SafetyFilters;
  onApply: (filters: SafetyFilters) => void;
}

export function SafetyFiltersDrawer({ open, onClose, filters, onApply }: SafetyFiltersDrawerProps) {
  // No sync effect: the parent remounts this component (`key={filtersRevision}`) each time it
  // opens, so the draft always starts fresh from the last applied `filters` without setState in
  // an effect (react-hooks/set-state-in-effect).
  const [draft, setDraft] = useState<SafetyFilters>(filters);
  // WB — Esc / X / Cancel used to drop every edit silently. Two filter sets are equal exactly
  // when they serialise to the same URL, so the canonical writer doubles as the comparison.
  const isDirty =
    writeSafetyFilters(new URLSearchParams(), draft).toString() !==
    writeSafetyFilters(new URLSearchParams(), filters).toString();

  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      screenName="Safety"
      appliedCount={countActiveSafetyFilters(draft)}
      isDirty={isDirty}
      onReset={() => setDraft(EMPTY_SAFETY_FILTERS)}
      onApply={() => {
        onApply(draft);
        onClose();
      }}
    >
      <FilterGroup title="Event type">
        {SAFETY_EVENT_TYPE_OPTIONS.map((type) => (
          <FilterCheckbox
            key={type}
            label={TYPE_LABEL[type]}
            checked={draft.type.includes(type)}
            onChange={() => setDraft((d) => ({ ...d, type: toggle(d.type, type) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Severity">
        {SAFETY_SEVERITY_OPTIONS.map((severity) => (
          <FilterCheckbox
            key={severity}
            label={SEVERITY_LABEL[severity]}
            checked={draft.severity.includes(severity)}
            onChange={() => setDraft((d) => ({ ...d, severity: toggle(d.severity, severity) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Coaching status">
        {SAFETY_COACHING_STATUS_OPTIONS.map((status) => (
          <FilterCheckbox
            key={status}
            label={COACHING_STATUS_LABEL[status]}
            checked={draft.coachingStatus.includes(status)}
            onChange={() => setDraft((d) => ({ ...d, coachingStatus: toggle(d.coachingStatus, status) }))}
          />
        ))}
      </FilterGroup>
    </FilterDrawer>
  );
}

/** Active-filter chips row shown under the control bar (11.23 "shareable" URL filters). */
export function SafetyFilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: SafetyFilters;
  onRemove: (patch: Partial<SafetyFilters>) => void;
  onClearAll: () => void;
}) {
  const chips: { key: string; label: string; patch: Partial<SafetyFilters> }[] = [];
  if (filters.type.length) chips.push({ key: 'type', label: `Event type: ${filters.type.map((t) => TYPE_LABEL[t]).join(', ')}`, patch: { type: [] } });
  if (filters.severity.length)
    chips.push({ key: 'severity', label: `Severity: ${filters.severity.map((s) => SEVERITY_LABEL[s]).join(', ')}`, patch: { severity: [] } });
  if (filters.coachingStatus.length)
    chips.push({
      key: 'coaching',
      label: `Coaching: ${filters.coachingStatus.map((s) => COACHING_STATUS_LABEL[s]).join(', ')}`,
      patch: { coachingStatus: [] },
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
