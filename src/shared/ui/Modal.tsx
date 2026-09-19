import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';

// owner: web-design-system — §5.9. Focus trap, Esc closes, focus returns to the trigger
// (all from Radix Dialog); dirty forms route through 11.30 Discard changes first.

export type ModalSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'w-[460px]',
  md: 'w-[640px]',
  lg: 'w-[720px]',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: ModalSize;
  /** When true, closing (Esc / overlay / X) is routed through the discard-changes confirm. */
  isDirty?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  isDirty = false,
  footer,
  children,
}: ModalProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestClose() {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  }

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-bg-overlay" />
          <Dialog.Content
            onEscapeKeyDown={(e) => {
              if (isDirty) {
                e.preventDefault();
                requestClose();
              }
            }}
            onPointerDownOutside={(e) => {
              if (isDirty) {
                e.preventDefault();
                requestClose();
              }
            }}
            className={cn(
              'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-96px)] -translate-x-1/2 -translate-y-1/2 flex-col',
              'rounded-xl bg-bg-surface shadow-modal outline-none',
              SIZE_CLASSES[size],
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-card">
              <div>
                <Dialog.Title className="text-[17px] font-semibold leading-6 text-text">{title}</Dialog.Title>
                {subtitle && <Dialog.Description className="mt-0.5 text-card-sub text-text-muted">{subtitle}</Dialog.Description>}
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="Close"
                  onClick={(e) => {
                    e.preventDefault();
                    requestClose();
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-bg-subtle"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-card">{children}</div>
            {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border p-card">{footer}</div>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <DiscardChangesDialog
        open={confirmOpen}
        onKeepEditing={() => setConfirmOpen(false)}
        onDiscard={() => {
          setConfirmOpen(false);
          onClose();
        }}
      />
    </>
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  isDirty?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

/** Right-hand drawer, 380px, full height (§5.9) — Filters, DVIR detail. */
export function Drawer({ open, onClose, title, subtitle, isDirty = false, footer, children }: DrawerProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestClose() {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(next) => !next && requestClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-bg-overlay" />
          <Dialog.Content
            onEscapeKeyDown={(e) => {
              if (isDirty) {
                e.preventDefault();
                requestClose();
              }
            }}
            className="fixed inset-y-0 right-0 z-50 flex w-side-panel flex-col bg-bg-surface shadow-modal outline-none"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-card">
              <div>
                <Dialog.Title className="text-[17px] font-semibold leading-6 text-text">{title}</Dialog.Title>
                {subtitle && <Dialog.Description className="mt-0.5 text-card-sub text-text-muted">{subtitle}</Dialog.Description>}
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="Close"
                  onClick={(e) => {
                    e.preventDefault();
                    requestClose();
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-bg-subtle"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-card">{children}</div>
            {footer && <div className="flex shrink-0 items-center gap-2 border-t border-border p-card">{footer}</div>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <DiscardChangesDialog
        open={confirmOpen}
        onKeepEditing={() => setConfirmOpen(false)}
        onDiscard={() => {
          setConfirmOpen(false);
          onClose();
        }}
      />
    </>
  );
}

/** 11.30 — mandatory even though it is not in the design files. */
export function DiscardChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onKeepEditing()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg-overlay" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-bg-surface p-card shadow-modal outline-none">
          <Dialog.Title className="text-[17px] font-semibold text-text">Discard changes?</Dialog.Title>
          <Dialog.Description className="mt-1 text-body text-text-muted">Your edits will be lost.</Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" size="lg" onClick={onKeepEditing}>
              Keep editing
            </Button>
            <Button variant="danger" size="lg" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface ConfirmDeleteProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Repeats what survives deletion (§5.9 destructive confirms). */
  description: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDelete({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  loading = false,
}: ConfirmDeleteProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-text-secondary">{description}</p>
    </Modal>
  );
}
