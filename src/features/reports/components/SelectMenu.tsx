// owner: web-reports-transfer — the `Label ▾` toolbar dropdowns on W-12…W-15.
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectMenuBase {
  /** Accessible name of the trigger, e.g. `Report`. */
  name: string;
  value: string;
  options: SelectOption[];
}

/**
 * A filter the backend cannot apply yet (`All vehicle groups ▾`, `All units ▾` on the pack) renders
 * its single drawn option as an inert trigger — no menu, and so no handler to pass.
 */
export type SelectMenuProps = SelectMenuBase &
  ({ disabled: true; onSelect?: undefined } | { disabled?: false; onSelect: (value: string) => void });

export function SelectMenu(props: SelectMenuProps) {
  const { name, value, options } = props;
  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '';
  const trigger = (
    <Button
      variant="secondary"
      aria-label={`${name}: ${current}`}
      disabled={props.disabled}
      iconRight={<ChevronDown size={16} strokeWidth={1.75} />}
    >
      {current}
    </Button>
  );
  if (props.disabled) return trigger;

  const { onSelect } = props;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-48 rounded-md border border-border bg-bg-surface p-1 shadow-pop"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onSelect={() => onSelect(option.value)}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-body text-text outline-none data-[highlighted]:bg-bg-subtle"
            >
              {option.label}
              {option.value === value && <Check size={14} strokeWidth={1.75} className="text-primary" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
