// WB-256 — a long RODS day renders a growing window of event rows, never all of them at once.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/shared/ui/Toast';
import { RECORD_ORIGIN, RECORD_STATUS, type LogEventView } from '@/shared/api/hosLogs';
import { LogEventsCard } from './LogEventsCard';
import { EVENT_WINDOW, eventWindowSize } from '../eventWindow';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => false }) }));
vi.mock('@/shared/auth/Can', () => ({ Can: () => null }));

const event = (i: number): LogEventView => ({
  id: `ev-${i}`,
  eventType: 1,
  eventCode: 1,
  eventSequenceId: i,
  eventDateTime: new Date(Date.UTC(2026, 8, 10, 0, 0, i)).toISOString(),
  recordStatus: RECORD_STATUS.active,
  recordOrigin: RECORD_ORIGIN.automatic,
  status: 'ON',
  locationName: `Place ${i}`,
  totalVehicleMiles: null,
  annotation: null,
  comment: null,
  supersedesId: null,
  editedById: null,
  editorType: null,
  editReason: null,
  vehicleId: null,
});

function renderCard(count: number, highlightedEventId: string | null = null) {
  return render(
    <ToastProvider>
      <LogEventsCard
        events={Array.from({ length: count }, (_, i) => event(i))}
        timezone="America/New_York"
        isLoading={false}
        isError={false}
        onRetry={() => {}}
        showAllRecords={false}
        onToggleShowAll={() => {}}
        pendingEditCount={0}
        highlightedEventId={highlightedEventId}
        onRequestEdit={() => {}}
        onViewAll={() => {}}
      />
    </ToastProvider>,
  );
}

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').filter((r) => r.hasAttribute('data-row-id'));

describe('LogEventsCard windowing', () => {
  it('eventWindowSize: all rows up to the threshold, a step window above, grown to the highlight', () => {
    expect(eventWindowSize(500, EVENT_WINDOW, -1)).toBe(500);
    expect(eventWindowSize(2000, EVENT_WINDOW, -1)).toBe(EVENT_WINDOW);
    expect(eventWindowSize(2000, EVENT_WINDOW, 260)).toBe(2 * EVENT_WINDOW);
    expect(eventWindowSize(2000, 4000, -1)).toBe(2000);
  });

  it('renders every row at or below the threshold', () => {
    renderCard(40);
    expect(bodyRows()).toHaveLength(40);
    expect(screen.queryByRole('button', { name: 'Show more events' })).not.toBeInTheDocument();
  });

  it('renders a window of a 2,000-event day and grows it on Show more events', async () => {
    renderCard(2000);
    expect(bodyRows()).toHaveLength(EVENT_WINDOW);
    expect(screen.getByText('Showing 250 of 2,000 events')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show more events' }));
    expect(bodyRows()).toHaveLength(2 * EVENT_WINDOW);
  });

  it('always includes the row highlighted from the grid', () => {
    renderCard(2000, 'ev-1234');
    expect(document.querySelector('[data-row-id="ev-1234"]')).not.toBeNull();
    expect(bodyRows()).toHaveLength(1250);
  });
});
