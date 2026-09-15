// `Keyboard shortcuts` (11.26 → `?`). Lists only shortcuts the shell really implements.
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: '⌘K / Ctrl K', description: 'Open or close the command palette' },
  { keys: '↑ ↓', description: 'Move through command palette results' },
  { keys: 'Enter', description: 'Open the selected result' },
  { keys: 'Esc', description: 'Close a dialog, panel or menu' },
  { keys: '?', description: 'Show keyboard shortcuts' },
];

export function KeyboardShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      size="sm"
      footer={
        <Button variant="secondary" size="lg" onClick={onClose}>
          Close
        </Button>
      }
    >
      <dl className="flex flex-col divide-y divide-border">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.keys} className="flex items-center justify-between gap-4 py-2">
            <dt className="text-body text-text-secondary">{shortcut.description}</dt>
            <dd>
              <kbd className="rounded-sm border border-border bg-bg-subtle px-1.5 font-sans text-caption text-text">
                {shortcut.keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
