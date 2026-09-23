// owner: web-dispatch-messaging — W-11 Dispatch & Trips, the `This week ▾` period control
// next to search (web/tz.md W-11 line "qidiruv `Search trip, driver, city…` · `This week ▾` ·
// `Filters` · `+ Create trip`"). See web/bugs.md WB-042 (Trips part) and web/decisions.md WD-065
// for why the default preset does not write `fDepartFrom`/`fDepartTo` on first load.
//
// Reuses the exact same URL params the Filters drawer's "Depart" group already owns
// (`fDepartFrom`/`fDepartTo` in `../lib/filters.ts`) — there is no separate precedence to define,
// picking a period here or a depart range in the drawer both write/read the same two keys, so
// the chip row and the drawer's own fields always agree with whatever this dropdown shows.
import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import type { TripFilters } from '../lib/filters';
import { CUSTOM_RANGE_MIN, departRangeMax, isRealCalendarDate, validateDepartRange } from '../lib/periodRange';

export type TripPeriodPreset = 'today' | 'thisWeek' | 'thisMonth' | 'custom';

const PRESET_LABELS: Record<TripPeriodPreset, string> = {
  today: 'Today',
  thisWeek: 'This week',
  thisMonth: 'This month',
  custom: 'Custom',
};

function toDay(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function presetRange(preset: TripPeriodPreset, today = new Date()): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: toDay(today), to: toDay(today) };
    case 'thisMonth':
      return { from: toDay(startOfMonth(today)), to: toDay(endOfMonth(today)) };
    case 'thisWeek':
    default:
      return { from: toDay(startOfWeek(today, { weekStartsOn: 1 })), to: toDay(endOfWeek(today, { weekStartsOn: 1 })) };
  }
}

/** Which preset the current `departFrom`/`departTo` pair matches, if any — `null` means either
 * nothing is set (the "no active period filter" default) or the range is a custom one the user
 * picked or typed into the Filters drawer. */
function matchingPreset(filters: Pick<TripFilters, 'departFrom' | 'departTo'>, today = new Date()): TripPeriodPreset | null {
  if (!filters.departFrom && !filters.departTo) return null;
  for (const preset of ['today', 'thisWeek', 'thisMonth'] as const) {
    const range = presetRange(preset, today);
    if (filters.departFrom === range.from && filters.departTo === range.to) return preset;
  }
  return 'custom';
}

export interface PeriodDropdownProps {
  filters: TripFilters;
  onApply: (patch: Pick<TripFilters, 'departFrom' | 'departTo'>) => void;
}

/** The `This week ▾` control drawn next to the search box. WD-065: with no `fDepartFrom`/
 * `fDepartTo` in the URL (the initial page load) it shows "This week" as a label only — it does
 * NOT write those params, so the row list starts unfiltered by date. Only once the user actually
 * picks a period does it start filtering, at which point it writes the same params the Filters
 * drawer's Depart group reads and writes. */
/** The Custom range inputs start from the applied range only when it *is* a custom one — a
 * preset's dates (e.g. This week's `2026-09-14`) left in From would make a To picked in an earlier
 * month read as "before From" for no reason the user can see. */
function customSeed(filters: TripFilters): { from: string; to: string } {
  return matchingPreset(filters) === 'custom'
    ? { from: filters.departFrom ?? '', to: filters.departTo ?? '' }
    : { from: '', to: '' };
}

export function PeriodDropdown({ filters, onApply }: PeriodDropdownProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(() => customSeed(filters).from);
  const [customTo, setCustomTo] = useState(() => customSeed(filters).to);
  // The From/To inputs sit behind a fourth "Custom range" option next to the three presets, so
  // custom dates read as one of the choices rather than a footnote under them.
  const [showCustom, setShowCustom] = useState(() => matchingPreset(filters) === 'custom');
  // Recomputed each time the popover opens (never a module-load constant) so the upper bound
  // always reflects the browser's clock at the moment the user is picking a range.
  const [today, setToday] = useState(() => new Date());

  const rangeMax = departRangeMax(today);
  const toMin = isRealCalendarDate(customFrom) ? customFrom : CUSTOM_RANGE_MIN;
  const { fromError, toError } = validateDepartRange(customFrom || null, customTo || null, today);
  const canApply = (Boolean(customFrom) || Boolean(customTo)) && !fromError && !toError;

  const active = matchingPreset(filters);
  const triggerLabel = active
    ? active === 'custom'
      ? filters.departFrom && filters.departTo
        ? `${filters.departFrom} – ${filters.departTo}`
        : 'Custom'
      : PRESET_LABELS[active]
    : // No range applied → say so; a "This week" label here would misstate what the table shows.
      'All dates';

  function selectPreset(preset: Exclude<TripPeriodPreset, 'custom'>) {
    const range = presetRange(preset);
    onApply({ departFrom: range.from, departTo: range.to });
    setOpen(false);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const seed = customSeed(filters);
          setCustomFrom(seed.from);
          setCustomTo(seed.to);
          setShowCustom(matchingPreset(filters) === 'custom');
          setToday(new Date());
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <Button variant="secondary" iconRight={<ChevronDown size={16} strokeWidth={1.75} />}>
          {triggerLabel}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={8} className="z-50 w-period-popover rounded-lg border border-border bg-bg-surface p-2 shadow-pop">
          <div className="flex flex-col gap-1">
            {(['today', 'thisWeek', 'thisMonth'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPreset(preset)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-left text-body',
                  // One highlighted choice at a time — while Custom range is open it owns the highlight.
                  active === preset && !showCustom ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-bg-subtle',
                )}
              >
                {PRESET_LABELS[preset]}
              </button>
            ))}
            <button
              type="button"
              aria-expanded={showCustom}
              onClick={() => setShowCustom((v) => !v)}
              className={cn(
                'flex items-center justify-between rounded-md px-2 py-1.5 text-left text-body',
                active === 'custom' || showCustom ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-bg-subtle',
              )}
            >
              Custom range
              <ChevronDown size={16} strokeWidth={1.75} className={cn('transition-transform', showCustom && 'rotate-180')} />
            </button>
          </div>
          <div className="mt-2 border-t border-border pt-2">
            {showCustom ? (
              <div className="grid grid-cols-2 gap-2 px-2">
                <label className="flex flex-col gap-1 text-caption text-text-muted">
                  From
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    min={CUSTOM_RANGE_MIN}
                    max={rangeMax}
                    aria-invalid={Boolean(fromError) || undefined}
                    className={cn(
                      'h-input w-full min-w-0 rounded-md border bg-bg-surface px-1 text-body text-text',
                      '[&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:ml-0.5 [&::-webkit-calendar-picker-indicator]:p-0',
                      fromError ? 'border-danger' : 'border-border',
                    )}
                  />
                  {fromError ? <span className="text-caption text-danger">{fromError}</span> : null}
                </label>
                <label className="flex flex-col gap-1 text-caption text-text-muted">
                  To
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    min={toMin}
                    max={rangeMax}
                    aria-invalid={Boolean(toError) || undefined}
                    className={cn(
                      'h-input w-full min-w-0 rounded-md border bg-bg-surface px-1 text-body text-text',
                      '[&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:ml-0.5 [&::-webkit-calendar-picker-indicator]:p-0',
                      toError ? 'border-danger' : 'border-border',
                    )}
                  />
                  {toError ? <span className="text-caption text-danger">{toError}</span> : null}
                </label>
              </div>
            ) : null}
            <div className={cn('flex justify-between px-2', showCustom && 'mt-2')}>
              {/* With no period applied `Clear` was a no-op that still took a click target. */}
              {filters.departFrom || filters.departTo ? (
                <button
                  type="button"
                  onClick={() => {
                    onApply({ departFrom: null, departTo: null });
                    setOpen(false);
                  }}
                  // Stage 3 — was ~29×16; now a full small-button target (h-btn-sm, 32px).
                  className="inline-flex h-btn-sm min-w-btn-sm items-center justify-center rounded-md px-2 text-caption font-medium text-primary hover:bg-bg-subtle hover:underline"
                >
                  Clear
                </button>
              ) : (
                <span />
              )}
              {showCustom ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canApply}
                  onClick={() => {
                    onApply({ departFrom: customFrom || null, departTo: customTo || null });
                    setOpen(false);
                  }}
                >
                  Apply
                </Button>
              ) : null}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
