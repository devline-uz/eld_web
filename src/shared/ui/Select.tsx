import * as Popover from '@radix-ui/react-popover';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

// owner: web-design-system — a single-value dropdown whose menu is our own listbox, so it can
// have a fixed height with its own scrollbar (a native <select> popup is browser-controlled and
// a long list grows past the viewport). WAI-ARIA "select-only combobox" pattern: the trigger is
// role=combobox, the menu role=listbox with aria-activedescendant; ↑/↓/Home/End move, Enter/Space
// pick, Esc/Tab close, typing jumps to the first option starting with the typed text.

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
}

/** Menu height cap (Tailwind `max-h-72` = 18rem ≈ 288px, same as the Driver/Unit picker list). */
export const SELECT_MENU_CLASS = 'max-h-72 overflow-y-auto';

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
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  function openMenu(index = selectedIndex >= 0 ? selectedIndex : 0) {
    if (disabled || options.length === 0) return;
    setActive(Math.max(0, Math.min(index, options.length - 1)));
    setOpen(true);
  }

  function pick(index: number) {
    const option = options[index];
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
    const index = options.findIndex((o) => o.label.toLowerCase().startsWith(query));
    if (index >= 0) setActive(index);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (open) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
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
      case 'Enter':
      case ' ':
        event.preventDefault();
        pick(active);
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          jumpByTyping(event.key);
        }
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? openMenu() : setOpen(false))}>
      <Popover.Trigger asChild>
        <button
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
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            listRef.current?.focus();
          }}
          className="z-50 min-w-[var(--radix-popover-trigger-width)] rounded-md border border-border bg-bg-surface p-1 shadow-pop"
        >
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-activedescendant={options.length ? optionId(active) : undefined}
            onKeyDown={onListKeyDown}
            className={cn('flex flex-col', SELECT_MENU_CLASS)}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                onMouseMove={() => setActive(index)}
                onClick={() => pick(index)}
                className={cn(
                  'cursor-pointer rounded-sm px-3 py-1.5 text-body text-text',
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
