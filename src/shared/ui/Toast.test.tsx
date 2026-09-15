import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { ToastProvider, useToast } from './Toast';

function Fire({ withAction = false, onAction }: { withAction?: boolean; onAction?: () => void }) {
  const { toast } = useToast();
  useEffect(() => {
    toast({
      kind: 'success',
      title: 'Report ready',
      description: 'FMCSA audit pack · 24 MB',
      action: withAction ? { label: 'Download', onClick: onAction ?? (() => {}) } : undefined,
    });
    // fire once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

describe('<Toast> action slot (§13.3, WD-041)', () => {
  it('renders the action button with the given label when supplied', () => {
    render(
      <ToastProvider>
        <Fire withAction />
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('omits the action entirely when none is supplied (backward compatible)', () => {
    render(
      <ToastProvider>
        <Fire withAction={false} />
      </ToastProvider>,
    );
    expect(screen.getByText('Report ready')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('invokes onClick when the action is activated', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Fire withAction onAction={onAction} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('is reachable by keyboard (Tab) and activates on Enter', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <ToastProvider>
        <Fire withAction onAction={onAction} />
      </ToastProvider>,
    );
    const action = screen.getByRole('button', { name: 'Download' });
    action.focus();
    expect(action).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not auto-dismiss while the toast has focus (Radix pause-on-focus)', () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Fire withAction />
        </ToastProvider>,
      );
      const action = screen.getByRole('button', { name: 'Download' });
      act(() => {
        fireEvent.focus(action);
      });

      // Past the normal 4s success duration — still open because the viewport has focus.
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.getByText('Report ready')).toBeInTheDocument();

      // Move focus away — the timer resumes and the toast closes.
      act(() => {
        fireEvent.blur(action);
      });
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.queryByText('Report ready')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
