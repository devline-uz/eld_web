// owner: web-settings-admin — small local form primitives shared across the Settings/Support
// modals so every field looks identical (§14.1). Not `shared/ui` because it is one feature's
// house style for a label + input pair, not a reusable design-system component.
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

export function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const errorId = `${useId()}-error`;
  // §11 forms — the control carries `aria-invalid` + `aria-describedby` so the red border and the
  // screen-reader message follow the error. An explicit prop on the child always wins.
  let control: ReactNode = children;
  if (isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    control = cloneElement(child, {
      'aria-invalid': child.props['aria-invalid'] ?? (error ? true : undefined),
      'aria-describedby': child.props['aria-describedby'] ?? (error ? errorId : undefined),
    });
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-text">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {control}
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
