// 11.28 Command palette (⌘K) — web/tz.md §11.28, design
// `sheets, modals, drawers, menus/Settings — back-office users and invitations.jpg`.
// 560px wide, 90px from the top. Combobox + listbox: ↑↓ move, Enter opens, Esc closes (Radix
// Dialog: focus trap and focus return to the trigger).
import * as Dialog from '@radix-ui/react-dialog';
import { FileText, Search, Truck, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS, useGlobalSearch } from '@/shared/api/search';
import { formatNumber } from '@/shared/format/numbers';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { searchEmptyState } from '@/shared/ui/copy';
import { driverSubtitle, vehicleLabel, vehicleSubtitle } from './paletteText';
import type { CommandPaletteProps } from './types';

type Group = 'DRIVERS' | 'VEHICLES' | 'ACTIONS' | 'PAGES';
const GROUP_ORDER: Group[] = ['DRIVERS', 'VEHICLES', 'ACTIONS', 'PAGES'];

interface Entry {
  id: string;
  group: Group;
  label: string;
  sub?: string;
  icon: LucideIcon;
  to: string;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-btn-sm min-w-6 items-center justify-center rounded-sm border border-border bg-bg-surface px-1.5 font-sans text-caption text-text-secondary">
      {children}
    </kbd>
  );
}

export default function CommandPalette({
  open,
  onOpenChange,
  pages,
  actions,
  canSearchDrivers,
  canSearchVehicles,
  canOpenHosLogs,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const term = query.trim();
  const debounced = useDebouncedValue(term, SEARCH_DEBOUNCE_MS);
  const scope = { drivers: canSearchDrivers, vehicles: canSearchVehicles };
  const searchable = canSearchDrivers || canSearchVehicles;
  const entitySearchOn = searchable && term.length >= SEARCH_MIN_CHARS;
  const search = useGlobalSearch(debounced, scope);
  const result = entitySearchOn && debounced.length >= SEARCH_MIN_CHARS ? search.data : undefined;

  const lower = term.toLowerCase();
  const entries: Entry[] = [];
  for (const hit of result?.drivers ?? []) {
    entries.push({
      id: `driver:${hit.id}`,
      group: 'DRIVERS',
      label: hit.name,
      sub: driverSubtitle(hit),
      icon: Users,
      to: `/drivers/${hit.id}`,
    });
  }
  for (const hit of result?.vehicles ?? []) {
    entries.push({
      id: `vehicle:${hit.id}`,
      group: 'VEHICLES',
      label: vehicleLabel(hit),
      sub: vehicleSubtitle(hit),
      icon: Truck,
      to: `/vehicles/${hit.id}`,
    });
  }
  const topDriver = result?.drivers[0];
  if (topDriver && canOpenHosLogs) {
    entries.push({
      id: `action:hos:${topDriver.id}`,
      group: 'ACTIONS',
      label: `Open HOS logs for ${topDriver.name}`,
      icon: FileText,
      to: `/hos-logs?driverId=${encodeURIComponent(topDriver.id)}`,
    });
  }
  for (const action of actions) {
    const to =
      action.to === '/hos-logs' && topDriver && canOpenHosLogs
        ? `/hos-logs?driverId=${encodeURIComponent(topDriver.id)}`
        : action.to;
    entries.push({ ...action, group: 'ACTIONS', to });
  }
  for (const page of pages) {
    if (lower && !page.label.toLowerCase().includes(lower)) continue;
    entries.push({ ...page, group: 'PAGES' });
  }

  const count = entries.length;
  const activeIndex = count === 0 ? -1 : Math.min(active, count - 1);
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const activeId = activeIndex >= 0 ? optionId(activeIndex) : undefined;

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  function run(entry: Entry | undefined) {
    if (!entry) return;
    onOpenChange(false);
    navigate(entry.to);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (count === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((activeIndex + 1) % count);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((activeIndex - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(entries[activeIndex]);
    }
  }

  const searching = entitySearchOn && (search.isFetching || debounced !== term) && !result;
  const searchFailed = entitySearchOn && search.isError;
  const noResults = term.length > 0 && count - actions.length - (topDriver && canOpenHosLogs ? 1 : 0) === 0 && !searching && !searchFailed;
  const empty = searchEmptyState(term);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg-overlay" />
        <Dialog.Content className="fixed left-1/2 top-palette-top z-50 flex w-palette -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-bg-surface shadow-modal">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search drivers and vehicles or jump to a page. Use the arrow keys to move and Enter to open.
          </Dialog.Description>

          <div className="flex items-center gap-3 border-b border-border px-4 py-2">
            <Search size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-text-muted" />
            <input
              role="combobox"
              aria-label="Search vehicles, drivers…"
              aria-expanded={count > 0}
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search vehicles, drivers…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-input min-w-0 flex-1 bg-transparent text-body text-text placeholder:text-text-muted"
            />
            <Kbd>ESC</Kbd>
          </div>

          <div className="max-h-palette-list overflow-y-auto py-2">
            {searchFailed ? (
              <div
                role="alert"
                className="mx-4 my-2 flex items-center justify-between gap-3 rounded-md bg-danger-soft px-3 py-2 text-caption text-danger"
              >
                <span>Search is unavailable right now. Pages and actions still work.</span>
                <Button variant="link" onClick={() => void search.refetch()}>
                  Retry
                </Button>
              </div>
            ) : null}

            {searching ? (
              <div aria-busy="true" className="flex flex-col gap-2 px-4 py-2">
                <span className="sr-only">Searching</span>
                {[0, 1].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <div className="size-4 animate-pulse rounded bg-bg-subtle" />
                    <div className="h-2.5 w-3/5 animate-pulse rounded bg-bg-subtle" />
                  </div>
                ))}
              </div>
            ) : null}

            {noResults ? (
              <div className="px-4 py-3">
                <p className="text-body-strong text-text">{empty.title}</p>
                <p className="text-caption text-text-muted">{empty.description}</p>
              </div>
            ) : null}

            <div role="listbox" id={listId} aria-label="Results">
              {GROUP_ORDER.map((group) => {
                const groupEntries = entries
                  .map((entry, index) => ({ entry, index }))
                  .filter(({ entry }) => entry.group === group);
                if (groupEntries.length === 0) return null;
                const headingId = `${baseId}-${group}`;
                return (
                  <div key={group} role="group" aria-labelledby={headingId} className="border-b border-border pb-2 last:border-b-0">
                    <div id={headingId} className="px-4 pb-1 pt-2 text-nav-section uppercase text-text-muted">
                      {group}
                    </div>
                    {groupEntries.map(({ entry, index }) => {
                      const Icon = entry.icon;
                      const selected = index === activeIndex;
                      return (
                        <div
                          key={entry.id}
                          id={optionId(index)}
                          role="option"
                          aria-selected={selected}
                          onMouseMove={() => setActive(index)}
                          onClick={() => run(entry)}
                          className={cn(
                            'mx-2 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2',
                            selected && 'bg-primary-soft',
                          )}
                        >
                          <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-text-secondary" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body text-text">{entry.label}</span>
                            {entry.sub ? (
                              <span className="block truncate text-caption text-text-muted tabular-nums">{entry.sub}</span>
                            ) : null}
                          </span>
                          {selected ? (
                            <span aria-hidden="true">
                              <Kbd>Enter</Kbd>
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-border bg-bg-app px-4 py-2 text-caption text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Kbd>↑↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>⌘K</Kbd> toggle
            </span>
            {result?.scope ? (
              <span className="ml-auto text-text-muted tabular-nums">
                Searching {formatNumber(result.scope.units)} units · {formatNumber(result.scope.drivers)} drivers ·{' '}
                {formatNumber(result.scope.logs)} logs
              </span>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
