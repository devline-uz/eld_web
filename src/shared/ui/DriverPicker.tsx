import * as Popover from '@radix-ui/react-popover';
import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Avatar } from './Avatar';
import { cn } from './cn';

// owner: web-design-system — §5.13. Presentational only — the feature supplies the option
// list and the search callback; this component owns layout, keyboard nav and trigger style.

export interface PickerOption {
  id: string;
  name: string;
  context: string;
  hosSummary?: string;
  hosTone?: 'success' | 'warning' | 'danger';
}

export interface PickerProps {
  value?: PickerOption;
  options: PickerOption[];
  onSelect: (option: PickerOption) => void;
  onSearch?: (query: string) => void;
  placeholder: string;
  triggerVariant?: 'default' | 'compact';
}

function Picker({ value, options, onSelect, onSearch, placeholder, triggerVariant = 'default' }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Inside a modal Dialog the popover must portal INTO the dialog: otherwise the dialog's focus
  // trap steals focus from the search input and react-remove-scroll swallows wheel events.
  const [container, setContainer] = useState<HTMLElement | undefined>(undefined);

  // Client-side filter (name + context, case-insensitive) so search works without an API callback.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.name} ${o.context}`.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setContainer(
            (triggerRef.current?.closest('[role="dialog"]') as HTMLElement | null) ?? undefined,
          );
        } else {
          setQuery('');
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-md border border-border bg-bg-surface px-3 text-body text-text hover:bg-bg-subtle',
            triggerVariant === 'compact' ? 'h-8' : 'h-input',
          )}
        >
          {value ? (
            <>
              <Avatar name={value.name} size="sm" />
              <span className="font-medium">{value.name}</span>
            </>
          ) : (
            <span className="text-text-muted">{placeholder}</span>
          )}
          <ChevronDown size={16} strokeWidth={1.75} className="text-text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content align="start" sideOffset={8} className="z-50 w-80 rounded-lg border border-border bg-bg-surface p-2 shadow-pop">
          <div className="flex items-center gap-2 rounded-md border border-border px-2">
            <Search size={14} strokeWidth={1.75} className="text-text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              placeholder="Search"
              className="h-8 flex-1 bg-transparent text-body outline-none"
            />
          </div>
          <ul className="mt-2 flex max-h-72 flex-col gap-0.5 overflow-y-auto overscroll-contain">
            {visible.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-bg-subtle"
                >
                  <Avatar name={option.name} size="sm" />
                  <span className="flex-1">
                    <span className="block text-body font-medium text-text">{option.name}</span>
                    <span className="block text-caption text-text-muted">{option.context}</span>
                  </span>
                  {option.hosSummary && (
                    <span
                      className={cn(
                        'tabular text-caption',
                        option.hosTone === 'success' && 'text-success',
                        option.hosTone === 'warning' && 'text-warning',
                        option.hosTone === 'danger' && 'text-danger',
                      )}
                    >
                      {option.hosSummary}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="p-2 text-caption text-text-muted">No results</li>
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function DriverPicker(props: PickerProps) {
  return <Picker {...props} />;
}

export function UnitPicker(props: PickerProps) {
  return <Picker {...props} />;
}

export function TrailerPicker(props: PickerProps) {
  return <Picker {...props} />;
}
