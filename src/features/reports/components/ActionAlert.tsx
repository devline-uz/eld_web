// owner: web-reports-transfer — a server refusal rendered in place, verbatim (§6.2 rules 5–6: a 403
// or 422 is never toasted). Dismissible; never retried.
import { AlertTriangle, X } from 'lucide-react';

export function ActionAlert({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md bg-danger-soft px-4 py-3 text-body text-danger">
      <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <p className="flex-1">{message}</p>
      {onDismiss && (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="shrink-0 rounded-md p-0.5 hover:bg-bg-surface">
          <X size={16} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
