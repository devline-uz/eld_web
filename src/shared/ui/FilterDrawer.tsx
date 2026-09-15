import type { ReactNode } from 'react';
import { RotateCcw, Check } from 'lucide-react';
import { Drawer } from './Modal';
import { Button } from './Button';

// owner: web-design-system — §5.7 / 11.23. The 380px right drawer shell; each screen supplies
// its own filter groups as children (Vehicles: status/eld/make; Drivers: status/terminal/…).

export interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  screenName: string;
  appliedCount: number;
  onReset: () => void;
  onApply: () => void;
  children: ReactNode;
}

export function FilterDrawer({ open, onClose, screenName, appliedCount, onReset, onApply, children }: FilterDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle={appliedCount > 0 ? `${screenName} · ${appliedCount} filters applied` : screenName}
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="secondary" iconLeft={<RotateCcw size={16} strokeWidth={1.75} />} onClick={onReset}>
            Reset all
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            iconLeft={<Check size={16} strokeWidth={1.75} />}
            onClick={onApply}
          >
            Apply {appliedCount} filters
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">{children}</div>
    </Drawer>
  );
}

export function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-6 last:border-b-0 last:pb-0">
      <h3 className="text-nav-section font-semibold uppercase tracking-wide text-text-muted">{title}</h3>
      {children}
    </div>
  );
}

export function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-body text-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
