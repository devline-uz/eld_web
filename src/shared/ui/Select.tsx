import * as Popover from '@radix-ui/react-popover';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

// owner: web-design-system — a single-value dropdown whose menu is our own listbox, so it can
// have a fixed height with its own scrollbar (a native <select> popup is browser-controlled and
// a long list grows past the viewport). WAI-ARIA "select-only combobox" pattern: the trigger is
// role=combobox, the menu role=listbox with aria-activedescendant; ↑/↓/Home/End move, Enter/Space
// pick, Esc/Tab close, typing jumps to the first option starting with the typed text.
// `searchable` adds a filter box above the list (long lists such as countries): typing narrows
// the options by label or value, ↑/↓/Enter work from the box.

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** Shown when `value` matches no option. */
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-label'?: string;
  /** Trigger classes — pass the form's input class so the field matches its neighbours. */
  className?: string;
  /** Show a filter box above the list. */
  searchable?: boolean;
  /** Accessible name / placeholder of the filter box. */
  searchLabel?: string;
  /** How many option rows the open menu shows before it scrolls (default 10). */
  maxVisibleItems?: number;
}

/** Height of one option row in px (`h-8`; = py-1.5 + the 20px `text-body` line). */
export const SELECT_ROW_PX = 32;
/** Rows an open dropdown menu shows at once; the rest are reached by scrolling. */
export const SELECT_MAX_VISIBLE_ITEMS = 10;
/** Scroll classes of the option list; its height cap is `selectMenuMaxHeight()`. */
export const SELECT_MENU_CLASS = 'overflow-y-auto overscroll-contain';

/** Max height of a menu list that shows exactly `rows` option rows (plus vertical padding). */
export function selectMenuMaxHeight(rows: number = SELECT_MAX_VISIBLE_ITEMS, paddingPx = 0): string {
  return `${Math.max(1, rows) * SELECT_ROW_PX + paddingPx}px`;
}

const TYPEAHEAD_RESET_MS = 500;

export function Select({
  value,
  options,
  onChange,
  placeholder = '—',
  disabled,
  invalid,
  id,
  'aria-label': ariaLabel,
  className,
  searchable = false,
  searchLabel = 'Search',
  maxVisibleItems = SELECT_MAX_VISIBLE_ITEMS,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Inside a modal Dialog the menu portals INTO the dialog (same as DriverPicker): otherwise the
  // dialog's react-remove-scroll swallows wheel events on the list and it can't be scrolled.
  const [container, setContainer] = useState<HTMLElement | undefined>(undefined);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;
  const selected = options.find((o) => o.value === value);
  const needle = searchable ? query.trim().toLowerCase() : '';
  const visible = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle) || o.value.toLowerCase() === needle)
    : options;

  function openMenu() {
    if (disabled || options.length === 0) return;
    setQuery('');
    const index = options.findIndex((o) => o.value === value);
    setActive(Math.max(0, index));
    setContainer((triggerRef.current?.closest('[role="dialog"]') as HTMLElement | null) ?? undefined);
    setOpen(true);
  }

  function pick(index: number) {
    const option = visible[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  // Keep the highlighted option visible inside the scrolling menu.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active))}`);
    el?.scrollIntoView?.({ block: 'nearest' });
    // optionId is derived from a stable useId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function jumpByTyping(key: string) {
    const now = Date.now();
    const state = typeahead.current;
    state.text = now - state.at > TYPEAHEAD_RESET_MS ? key : state.text + key;
    state.at = now;
    const query = state.text.toLowerCase();
    const index = visible.findIndex((o) => o.label.toLowerCase().startsWith(query));
    if (index >= 0) setActive(index);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (open) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLElement>) {
    const last = visible.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((i) => Math.min(i + 1, last));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      case 'Home':
        event.preventDefault();
        setActive(0);
        return;
      case 'End':
        event.preventDefault();
        setActive(last);
        return;
      case ' ':
        if (event.currentTarget === searchRef.current) return;
        event.preventDefault();
        pick(active);
        return;
      case 'Enter':
        event.preventDefault();
        pick(active);
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
        if (event.currentTarget === searchRef.current) return;
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          jumpByTyping(event.key);
        }
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? openMenu() : setOpen(false))}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={ariaLabel}
          aria-invalid={invalid ? true : undefined}
          disabled={disabled}
          onKeyDown={onTriggerKeyDown}
          className={cn('flex items-center justify-between gap-2 text-left', className)}
        >
          <span className={cn('truncate', !selected && 'text-text-muted')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            className="shrink-0 text-text-muted"
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (searchable ? searchRef.current : listRef.current)?.focus();
          }}
          collisionPadding={8}
          className="z-50 flex max-h-[var(--radix-popover-content-available-height)] min-w-[var(--radix-popover-trigger-width)] flex-col rounded-md border border-border bg-bg-surface p-1 shadow-pop"
        >
          {searchable && (
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder={searchLabel}
              aria-label={searchLabel}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={visible.length ? optionId(active) : undefined}
              autoComplete="off"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onListKeyDown}
              className="mb-1 h-input w-full rounded-sm border border-border bg-bg-surface px-3 text-body text-text"
            />
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-activedescendant={visible.length ? optionId(active) : undefined}
            onKeyDown={onListKeyDown}
            style={{ maxHeight: selectMenuMaxHeight(maxVisibleItems) }}
            className={cn('flex min-h-0 flex-col', SELECT_MENU_CLASS)}
          >
            {visible.length === 0 && (
              <li role="presentation" className="flex h-8 shrink-0 items-center px-3 text-body text-text-muted">
                No matches
              </li>
            )}
            {visible.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                onMouseMove={() => setActive(index)}
                onClick={() => pick(index)}
                className={cn(
                  'flex h-8 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-sm px-3 text-body text-text',
                  index === active && 'bg-bg-subtle',
                  option.value === value && 'font-medium',
                )}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
