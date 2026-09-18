import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isSameMonth,
  startOfMonth,
  startOfQuarter,
  subDays,
  subMonths,
} from 'date-fns';
import { Button } from './Button';
import { cn } from './cn';

// owner: web-design-system — §5.12 / 11.25.

export interface DateRange {
  from: Date;
  to: Date;
}

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last14'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'last8Hos'
  | 'custom';

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  last14: 'Last 14 days',
  last30: 'Last 30 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  thisQuarter: 'This quarter',
  last8Hos: 'Last 8 days (HOS)',
  custom: 'Custom range',
};

export function resolvePreset(preset: DateRangePreset, today = new Date()): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: subDays(today, 1), to: subDays(today, 1) };
    case 'last7':
      return { from: subDays(today, 6), to: today };
    case 'last14':
      return { from: subDays(today, 13), to: today };
    case 'last30':
      return { from: subDays(today, 29), to: today };
    case 'thisMonth':
      return { from: startOfMonth(today), to: today };
    case 'lastMonth': {
      const prev = subMonths(today, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case 'thisQuarter':
      return { from: startOfQuarter(today), to: today };
    case 'last8Hos':
      // FMCSA 8-day window — exactly 8 days (today + 7), default on HOS and Transfers.
      return { from: subDays(today, 7), to: today };
    case 'custom':
    default:
      return { from: today, to: today };
  }
}

export interface DateRangePickerProps {
  value: DateRange;
  preset?: DateRangePreset;
  onChange: (range: DateRange, preset: DateRangePreset) => void;
}

export function DateRangePicker({ value, preset = 'custom', onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [draftPreset, setDraftPreset] = useState<DateRangePreset>(preset);
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(value.from));

  const daysSelected = Math.round((draft.to.getTime() - draft.from.getTime()) / 86_400_000) + 1;

  function selectPreset(p: DateRangePreset) {
    setDraftPreset(p);
    const range = resolvePreset(p);
    setDraft(range);
    setViewMonth(startOfMonth(range.from));
  }

  const triggerLabel =
    preset === 'custom'
      ? `${format(value.from, 'MMM dd')} – ${format(value.to, 'MMM dd, yyyy')}`
      : PRESET_LABELS[preset];

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(value);
          setDraftPreset(preset);
          // Re-anchor the visible month to the current selection each time the popover
          // opens, but never move it again just because a day is picked — that is what
          // stranded the calendar inside a single month (WB-120).
          setViewMonth(startOfMonth(value.from));
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
        <Popover.Content align="start" sideOffset={8} className="z-50 flex w-[620px] rounded-lg border border-border bg-bg-surface shadow-pop">
          <div className="flex w-[168px] flex-col gap-1 border-r border-border p-3">
            <p className="mb-1 text-nav-section font-semibold uppercase tracking-wide text-text-muted">Presets</p>
            {(Object.keys(PRESET_LABELS) as DateRangePreset[])
              .filter((p) => p !== 'custom')
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-left text-body',
                    draftPreset === p ? 'bg-primary-soft text-primary' : 'text-text-secondary hover:bg-bg-subtle',
                  )}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <MonthCalendar
              month={viewMonth}
              range={draft}
              onPickDay={(day) => pickDay(day)}
              onPrevMonth={() => setViewMonth((m) => subMonths(m, 1))}
              onNextMonth={() => setViewMonth((m) => addMonths(m, 1))}
            />
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-caption text-text-muted">{daysSelected} days selected</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onChange(draft, draftPreset);
                    setOpen(false);
                  }}
                >
                  ✓ Apply range
                </Button>
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  function pickDay(day: Date) {
    if (isAfter(day, new Date())) return; // future days are disabled
    setDraftPreset('custom');
    setDraft((prev) => {
      const sameSelection = prev.from.getTime() !== prev.to.getTime();
      if (sameSelection) return { from: day, to: day };
      return day < prev.from ? { from: day, to: prev.from } : { from: prev.from, to: day };
    });
  }
}

function MonthCalendar({
  month,
  range,
  onPickDay,
  onPrevMonth,
  onNextMonth,
}: {
  month: Date;
  range: DateRange;
  onPickDay: (day: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const start = startOfMonth(month);
  const days: Date[] = [];
  for (let i = 0; i < start.getDay(); i++) days.push(addDays(start, i - start.getDay()));
  const end = endOfMonth(month);
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={onPrevMonth}
          className="flex size-7 items-center justify-center rounded-md text-text-secondary hover:bg-bg-subtle"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <p className="text-body-strong text-text">{format(month, 'MMMM yyyy')}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={onNextMonth}
          className="flex size-7 items-center justify-center rounded-md text-text-secondary hover:bg-bg-subtle"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-caption text-text-muted">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
        {days.map((day, i) => {
          const inRange = day >= range.from && day <= range.to;
          const isEdge = day.toDateString() === range.from.toDateString() || day.toDateString() === range.to.toDateString();
          const future = isAfter(day, new Date());
          const outsideMonth = !isSameMonth(day, month);
          return (
            <button
              key={i}
              type="button"
              disabled={future}
              onClick={() => onPickDay(day)}
              className={cn(
                'tabular flex size-8 items-center justify-center rounded-full text-body',
                outsideMonth && 'text-text-muted opacity-40',
                inRange && !isEdge && 'bg-primary-soft',
                isEdge && 'bg-primary text-text-inverse',
                future && 'cursor-not-allowed opacity-30',
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
