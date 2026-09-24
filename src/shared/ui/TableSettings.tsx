import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, ChevronUp, GripVertical, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from './Button';
import { cn } from './cn';

// owner: web-design-system — §5.5 / 11.24. Column visibility + order, persisted by the
// caller with `useUiPreference('tableColumns', '<screen>', defaults)` from
// `shared/auth/uiPreferences.ts` — `PUT /me/preferences` (B-11) with a localStorage fallback.

export interface TableColumnSetting {
  id: string;
  label: string;
  visible: boolean;
  locked?: boolean;
}

export interface TableSettingsProps {
  columns: TableColumnSetting[];
  onApply: (columns: TableColumnSetting[]) => void;
  onReset: () => void;
}

export function TableSettings({ columns, onApply, onReset }: TableSettingsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(columns);

  function handleOpenChange(next: boolean) {
    if (next) setDraft(columns);
    setOpen(next);
  }

  function toggle(id: string) {
    setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }

  function move(index: number, direction: -1 | 1) {
    setDraft((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <Button variant="secondary" iconLeft={<Settings2 size={16} strokeWidth={1.75} />}>
          Table settings
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[280px] rounded-lg border border-border bg-bg-surface p-3 shadow-pop"
        >
          <div className="flex items-center justify-between">
            <span className="text-body-strong text-text">Table settings</span>
            <button
              type="button"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
              className="text-caption text-primary hover:underline"
            >
              Reset
            </button>
          </div>
          <p className="mt-3 text-nav-section font-semibold uppercase tracking-wide text-text-muted">Columns</p>
          <ul className="mt-1 flex flex-col gap-1">
            {draft.map((col, i) => (
              <li key={col.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-bg-subtle">
                <GripVertical size={14} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />
                <span className="flex items-center text-text-muted">
                  <button
                    type="button"
                    aria-label={`Move ${col.label} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="rounded p-0.5 hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronUp size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${col.label} down`}
                    disabled={i === draft.length - 1}
                    onClick={() => move(i, 1)}
                    className="rounded p-0.5 hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronDown size={14} strokeWidth={1.75} />
                  </button>
                </span>
                <span className="flex-1 text-body text-text">{col.label}</span>
                {col.locked ? (
                  <span className="text-caption text-text-muted">Locked</span>
                ) : (
                  <input
                    type="checkbox"
                    aria-label={`Show ${col.label}`}
                    checked={col.visible}
                    onChange={() => toggle(col.id)}
                  />
                )}
              </li>
            ))}
          </ul>
          <div className={cn('mt-3 flex justify-end gap-2 border-t border-border pt-3')}>
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
