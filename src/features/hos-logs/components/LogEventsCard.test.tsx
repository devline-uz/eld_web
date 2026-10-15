// WB-256 — a long RODS day renders a growing window of event rows, never all of them at once.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/shared/ui/Toast';
import { RECORD_ORIGIN, RECORD_STATUS, type LogEventView } from '@/shared/api/hosLogs';
import { LogEventsCard } from './LogEventsCard';
import { VIRTUALIZE_ABOVE } from '@/shared/ui/virtualRows';
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

  it('FE-013: View all events lifts the window and scrolls the list into view, even when already showing all records', async () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      // FE-25: the smallest day that is still windowed (one row past the threshold). Rendering and
      // then re-rendering all 2,000 rows timed out (20 s) under full-suite load.
      const total = VIRTUALIZE_ABOVE + 1;
      renderCard(total);
      expect(bodyRows()).toHaveLength(EVENT_WINDOW);
      await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'View all events' }));
      expect(bodyRows()).toHaveLength(total);
      expect(scroll).toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  }, 60_000);

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

describe('LogEventsCard — the record carried in over midnight', () => {
  // QA: the grid showed 24:00 of driving from a record opened two days earlier while this table
  // said "No ELD records for this day". The carried-in record is now the day's first row.
  const carried: LogEventView = {
    ...event(0),
    id: 'carried-1',
    eventCode: 3,
    status: 'D',
    eventDateTime: '2026-10-08T07:44:00.000Z',
  };

  function renderWithCarry(events: LogEventView[]) {
    return render(
      <ToastProvider>
        <LogEventsCard
          events={events}
          carriedIn={carried}
          timezone="America/New_York"
          isLoading={false}
          isError={false}
          onRetry={() => {}}
          showAllRecords={false}
          onToggleShowAll={() => {}}
          pendingEditCount={0}
          highlightedEventId={null}
          onRequestEdit={() => {}}
          onViewAll={() => {}}
        />
      </ToastProvider>,
    );
  }

  it('shows the carried status with its date instead of the empty state', () => {
    renderWithCarry([]);
    expect(screen.queryByText('No ELD records for this day')).not.toBeInTheDocument();
    const row = document.querySelector('[data-row-id="carried-1"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(within(row).getByText('Oct 8, 03:44:00')).toBeInTheDocument();
    expect(within(row).getByText('Carried over from the previous day')).toBeInTheDocument();
    // The subtitle still counts only the records of this day.
    expect(screen.getByText(/^0 events today/)).toBeInTheDocument();
  });

  it('puts it before the records of the day', () => {
    renderWithCarry([event(5)]);
    expect(bodyRows().map((row) => row.getAttribute('data-row-id'))).toEqual(['carried-1', 'ev-5']);
  });
});
