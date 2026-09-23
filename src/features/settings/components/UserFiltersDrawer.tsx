// owner: web-settings-admin — W-18 Settings · Users, 11.23 Filters (web/tz.md §11.23).
// Design: web/roles and screens/admin panel/Settings — back-office users and invitations.jpg
import { useState } from 'react';
import { FilterDrawer, FilterGroup, FilterCheckbox } from '@/shared/ui/FilterDrawer';
import { Badge } from '@/shared/ui/Badge';
import { ROLE_LABEL, isRole } from '@/shared/auth/permissions';
import {
  EMPTY_USER_FILTERS,
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
  countActiveUserFilters,
  writeUserFilters,
  type UserFilters,
  type UserRoleFilter,
  type UserStatusFilter,
} from '../lib/filters';

const STATUS_LABEL: Record<UserStatusFilter, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  DISABLED: 'Disabled',
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export interface UserFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: UserFilters;
  onApply: (filters: UserFilters) => void;
}

export function UserFiltersDrawer({ open, onClose, filters, onApply }: UserFiltersDrawerProps) {
  // No sync effect: the parent remounts this component (`key={filtersRevision}`) each time it
  // opens, so the draft always starts fresh from the last applied `filters` without setState in
  // an effect (react-hooks/set-state-in-effect) — matches VehicleFiltersDrawer.
  const [draft, setDraft] = useState<UserFilters>(filters);
  // WB — Esc / X / Cancel used to drop every edit silently. Two filter sets are equal exactly
  // when they serialise to the same URL, so the canonical writer doubles as the comparison.
  const isDirty =
    writeUserFilters(new URLSearchParams(), draft).toString() !==
    writeUserFilters(new URLSearchParams(), filters).toString();

  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      screenName="Users"
      appliedCount={countActiveUserFilters(draft)}
      isDirty={isDirty}
      onReset={() => setDraft(EMPTY_USER_FILTERS)}
      onApply={() => {
        onApply(draft);
        onClose();
      }}
    >
      <FilterGroup title="Role">
        {USER_ROLE_OPTIONS.map((role) => (
          <FilterCheckbox
            key={role}
            label={ROLE_LABEL[isRole(role) ? role : 'VIEWER'] ?? role}
            checked={draft.role.includes(role)}
            onChange={() => setDraft((d) => ({ ...d, role: toggle(d.role, role) }))}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Status">
        {USER_STATUS_OPTIONS.map((status) => (
          <FilterCheckbox
            key={status}
            label={STATUS_LABEL[status]}
            checked={draft.status.includes(status)}
            onChange={() => setDraft((d) => ({ ...d, status: toggle(d.status, status) }))}
          />
        ))}
      </FilterGroup>
    </FilterDrawer>
  );
}

/** Active-filter chips row shown under the control bar (11.23 "shareable" URL filters). */
export function UserFilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: UserFilters;
  onRemove: (patch: Partial<UserFilters>) => void;
  onClearAll: () => void;
}) {
  const chips: { key: string; label: string; patch: Partial<UserFilters> }[] = [];
  if (filters.role.length)
    chips.push({
      key: 'role',
      label: `Role: ${filters.role.map((r) => ROLE_LABEL[isRole(r) ? r : 'VIEWER'] ?? r).join(', ')}`,
      patch: { role: [] as UserRoleFilter[] },
    });
  if (filters.status.length)
    chips.push({ key: 'status', label: `Status: ${filters.status.map((s) => STATUS_LABEL[s]).join(', ')}`, patch: { status: [] } });

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
