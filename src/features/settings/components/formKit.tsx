// owner: web-settings-admin — small local form primitives shared across the Settings/Support
// modals so every field looks identical (§14.1). Not `shared/ui` because it is one feature's
// house style for a label + input pair, not a reusable design-system component.
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  // §11 forms — the control itself carries `aria-invalid` + `aria-describedby`, so the red
  // border (`aria-invalid:border-danger`) and the screen-reader message both follow the error.
  // An explicit prop on the child always wins.
  let control: ReactNode = children;
  if (isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    control = cloneElement(child, {
      'aria-invalid': child.props['aria-invalid'] ?? (error ? true : undefined),
      'aria-describedby': child.props['aria-describedby'] ?? describedBy,
    });
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-text">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {control}
      {hint && !error && (
        <span id={hintId} className="text-caption text-text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text disabled:bg-bg-subtle aria-invalid:border-danger';

export function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
  tooltip,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
  tooltip?: string;
}) {
  return (
    <div
      title={disabled ? tooltip : undefined}
      className="flex items-center justify-between gap-4 rounded-md border border-border p-4"
    >
      <div>
        <p className="text-body-strong text-text">{title}</p>
        <p className="text-caption text-text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={
          'relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
          (checked ? 'bg-primary' : 'bg-border')
        }
      >
        <span
          className={
            'absolute left-0.5 top-0.5 size-5 rounded-full bg-bg-surface transition-transform ' +
            (checked ? 'translate-x-4' : 'translate-x-0')
          }
        />
      </button>
    </div>
  );
}
