// owner: web-settings-admin — small local form primitives shared across the Settings/Support
// modals so every field looks identical (§14.1). Not `shared/ui` because it is one feature's
// house style for a label + input pair, not a reusable design-system component.
import type { ReactNode } from 'react';

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
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-text">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="text-caption text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  'h-input rounded-md border border-border bg-bg-surface px-3 text-body text-text disabled:bg-bg-subtle';
