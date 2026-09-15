import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

function Fixture({ isDirty, onClose }: { isDirty: boolean; onClose: () => void }) {
  return (
    <>
      <button>Trigger</button>
      <Modal open title="Add vehicle" isDirty={isDirty} onClose={onClose}>
        <input aria-label="Unit number" />
        <button>Save</button>
      </Modal>
    </>
  );
}

describe('<Modal> focus trap and dirty close (§5.9, 11.30)', () => {
  it('traps focus inside the dialog — Tab cycles without reaching the outside trigger', async () => {
    const user = userEvent.setup();
    render(<Fixture isDirty={false} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    // Everything focusable while tabbing stays within the dialog.
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('Esc closes a clean form immediately', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Fixture isDirty={false} onClose={onClose} />);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('Esc on a dirty form opens the discard-changes confirm instead of closing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Fixture isDirty={true} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('"Keep editing" dismisses the confirm and leaves the form open', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Fixture isDirty={true} onClose={onClose} />);
    await user.keyboard('{Escape}');
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Add vehicle' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
