// D-163 — records a replaced (signed-out, offline) device sent late: badge, "Not counted",
// the `Needs review` filter with its count, and "Re-enter as a new record" for hosEdit FULL only.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/shared/ui/Toast';
import { RECORD_ORIGIN, RECORD_STATUS, type LogEventView } from '@/shared/api/hosLogs';
import { LogEventsCard, type LogEventsReviewFilter } from './LogEventsCard';

const perm = vi.hoisted(() => ({ full: true }));
vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => perm.full }) }));
vi.mock('@/shared/auth/Can', () => ({ Can: ({ children }: { children: ReactNode }) => (perm.full ? children : null) }));

const base: LogEventView = {
  id: 'a1',
  eventType: 1,
  eventCode: 4,
  eventSequenceId: 1,
  eventDateTime: '2026-09-10T12:00:00.000Z',
  recordStatus: RECORD_STATUS.active,
  recordOrigin: RECORD_ORIGIN.automatic,
  status: 'ON',
  locationName: 'Columbus, OH',
  totalVehicleMiles: null,
  annotation: null,
  comment: null,
  supersedesId: null,
  editedById: null,
  editorType: null,
  editReason: null,
  vehicleId: null,
  reviewReason: null,
  reviewDeviceLabel: null,
};
const active = base;
const inertFlagged: LogEventView = {
  ...base,
  id: 'f1',
  eventDateTime: '2026-09-10T13:00:00.000Z',
  recordStatus: RECORD_STATUS.proposed,
  recordOrigin: RECORD_ORIGIN.driver,
  status: 'OFF',
  reviewReason: 'REPLACED_DEVICE',
  reviewDeviceLabel: 'Pixel 7',
};
const activeFlagged: LogEventView = {
  ...base,
  id: 'f2',
  eventDateTime: '2026-09-10T14:00:00.000Z',
  status: 'D',
  reviewReason: 'REPLACED_DEVICE',
  reviewDeviceLabel: 'Pixel 7',
};

function renderCard(opts: { review?: Partial<LogEventsReviewFilter>; showAll?: boolean; onReenter?: (e: LogEventView) => void } = {}) {
  const onToggle = vi.fn();
  const review: LogEventsReviewFilter = {
    active: false,
    onToggle,
    count: 2,
    events: [],
    isLoading: false,
    isError: false,
    onRetry: () => {},
    ...opts.review,
  };
  render(
    <ToastProvider>
      <LogEventsCard
        events={[active, inertFlagged, activeFlagged]}
        timezone="America/New_York"
        isLoading={false}
        isError={false}
        onRetry={() => {}}
        showAllRecords={opts.showAll ?? false}
        onToggleShowAll={() => {}}
        pendingEditCount={0}
        highlightedEventId={null}
        onRequestEdit={() => {}}
        onReenter={opts.onReenter}
        review={review}
        onViewAll={() => {}}
      />
    </ToastProvider>,
  );
  return { onToggle };
}

const rowOf = (id: string) => document.querySelector(`[data-row-id="${id}"]`) as HTMLElement | null;

beforeEach(() => {
  perm.full = true;
});

describe('LogEventsCard — replaced device records (D-163)', () => {
  it('badges a flagged active record with the agreed tooltip; the default view still hides the inert one', () => {
    renderCard();
    const row = rowOf('f2')!;
    const badge = within(row).getByText('Replaced device');
    expect(badge.closest('[title]')).toHaveAttribute(
      'title',
      'Sent from Pixel 7 after the driver signed in on another device. Needs review.',
    );
    expect(within(row).queryByText('Not counted')).not.toBeInTheDocument();
    expect(rowOf('f1')).toBeNull();
    expect(within(rowOf('a1')!).queryByText('Replaced device')).not.toBeInTheDocument();
  });

  it('marks the inert record "Not counted", muted and never painted as a proposal', () => {
    renderCard({ showAll: true });
    const row = rowOf('f1')!;
    expect(within(row).getByText('Replaced device')).toBeInTheDocument();
    expect(within(row).getByText('Not counted')).toBeInTheDocument();
    expect(row.className).toContain('opacity-70');
    expect(row.className).not.toContain('bg-info-soft');
  });

  it('falls back to "a replaced device" when the label is missing', () => {
    renderCard({ review: { active: true, events: [{ ...activeFlagged, reviewDeviceLabel: null }] } });
    expect(within(rowOf('f2')!).getByText('Replaced device').closest('[title]')).toHaveAttribute(
      'title',
      'Sent from a replaced device after the driver signed in on another device. Needs review.',
    );
  });

  it('shows the count on the Needs review control and toggles the filter', async () => {
    const { onToggle } = renderCard();
    const button = screen.getByRole('button', { name: /Needs review/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(within(button).getByText('2')).toBeInTheDocument();
    await userEvent.setup().click(button);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('hides the count when the day has no flagged records', () => {
    renderCard({ review: { count: 0 } });
    const button = screen.getByRole('button', { name: /Needs review/ });
    expect(within(button).queryByText('0')).not.toBeInTheDocument();
  });

  it('with the filter on lists the server-filtered records of every status, inert ones included', () => {
    renderCard({ review: { active: true, events: [inertFlagged, activeFlagged] } });
    expect(screen.getByRole('button', { name: /Needs review/ })).toHaveAttribute('aria-pressed', 'true');
    expect(rowOf('f1')).not.toBeNull();
    expect(rowOf('f2')).not.toBeNull();
    expect(rowOf('a1')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Show superseded and proposed records' })).toBeDisabled();
  });

  it('with the filter on and nothing flagged shows its own empty state', () => {
    renderCard({ review: { active: true, events: [], count: 0 } });
    expect(screen.getByText('No records need review')).toBeInTheDocument();
  });

  it('with the filter on, a failing request shows the error inside the card', () => {
    renderCard({ review: { active: true, isError: true } });
    expect(screen.getByText('Could not load log events')).toBeInTheDocument();
  });

  it('offers "Re-enter as a new record" on the inert record only (hosEdit FULL)', async () => {
    const onReenter = vi.fn();
    renderCard({ review: { active: true, events: [inertFlagged, activeFlagged] }, onReenter });
    const user = userEvent.setup();
    await user.click(within(rowOf('f1')!).getByRole('button', { name: 'Row actions' }));
    await user.click(screen.getByText('Re-enter as a new record'));
    expect(onReenter).toHaveBeenCalledWith(inertFlagged);
  });

  it('the active flagged record keeps the normal edit flow and no re-enter item', async () => {
    renderCard({ review: { active: true, events: [activeFlagged] }, onReenter: vi.fn() });
    await userEvent.setup().click(within(rowOf('f2')!).getByRole('button', { name: 'Row actions' }));
    expect(screen.getByText('Request an edit')).toBeInTheDocument();
    expect(screen.queryByText('Re-enter as a new record')).not.toBeInTheDocument();
  });

  it('read-only roles see the badge and the filter but no row actions in the DOM', () => {
    perm.full = false;
    renderCard({ review: { active: true, events: [inertFlagged] }, onReenter: vi.fn() });
    expect(within(rowOf('f1')!).getByText('Replaced device')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Needs review/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Row actions' })).not.toBeInTheDocument();
    expect(screen.queryByText('Re-enter as a new record')).not.toBeInTheDocument();
  });
});
