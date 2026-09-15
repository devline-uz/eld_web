import * as RadixToast from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

// owner: web-design-system — §5.10. Top-right, max 3 at once, success 4s / warning 6s / error sticky.

export type ToastKind = 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
  /** Screen-reader text for the action when its visible label alone isn't enough context. */
  altText?: string;
}

export interface ToastInput {
  kind: ToastKind;
  title: string;
  description?: string;
  /** §13.3 — `Report ready` → `Download`, network error → `Retry`. Radix pauses the
   * auto-dismiss timer while the toast (including this action) has focus or hover. */
  action?: ToastAction;
}

interface ToastEntry extends ToastInput {
  id: number;
}

const DURATIONS: Record<ToastKind, number> = {
  success: 4000,
  warning: 6000,
  error: Infinity,
};

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={20} strokeWidth={1.75} className="text-success" />,
  warning: <AlertTriangle size={20} strokeWidth={1.75} className="text-warning" />,
  error: <XCircle size={20} strokeWidth={1.75} className="text-danger" />,
};

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  const toast = useCallback((input: ToastInput) => {
    setEntries((prev) => {
      const next = [...prev, { ...input, id: nextId++ }];
      // Maximum 3 at once (§5.10) — drop the oldest.
      return next.slice(-3);
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right">
        {children}
        {entries.map((entry) => (
          <RadixToast.Root
            key={entry.id}
            duration={DURATIONS[entry.kind]}
            onOpenChange={(open) => {
              if (!open) dismiss(entry.id);
            }}
            role={entry.kind === 'error' ? 'alert' : 'status'}
            aria-live={entry.kind === 'error' ? 'assertive' : 'polite'}
            className="flex w-side-panel items-start gap-3 rounded-lg border border-border bg-bg-surface p-4 shadow-pop"
          >
            <span className="mt-0.5 shrink-0">{ICONS[entry.kind]}</span>
            <div className="flex-1">
              <RadixToast.Title className="text-body-strong text-text">{entry.title}</RadixToast.Title>
              {entry.description && (
                <RadixToast.Description className="mt-0.5 text-card-sub text-text-muted">
                  {entry.description}
                </RadixToast.Description>
              )}
            </div>
            {entry.action && (
              <RadixToast.Action
                altText={entry.action.altText ?? entry.action.label}
                onClick={entry.action.onClick}
                className="shrink-0 rounded-md border border-border px-2 py-1 text-caption font-medium text-primary hover:bg-primary-soft"
              >
                {entry.action.label}
              </RadixToast.Action>
            )}
            <RadixToast.Close aria-label="Dismiss" className="shrink-0 rounded-md p-1 hover:bg-bg-subtle">
              <X size={16} strokeWidth={1.75} />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed top-topbar right-6 z-50 flex flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
