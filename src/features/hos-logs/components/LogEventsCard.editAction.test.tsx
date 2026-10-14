// QA CODE-027 — "Request an edit" is offered only on a live duty-status record.
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/shared/ui/Toast';
import { RECORD_ORIGIN, RECORD_STATUS, type LogEventView } from '@/shared/api/hosLogs';
import { LogEventsCard } from './LogEventsCard';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock('@/shared/auth/Can', () => ({ Can: ({ children }: { children: ReactNode }) => children }));

const row = (id: string, recordStatus: number, status: LogEventView['status'] = 'ON'): LogEventView => ({
  id,
  eventType: status ? 1 : 2,
  eventCode: 1,
  eventSequenceId: 1,
  eventDateTime: '2026-09-10T12:00:00.000Z',
  recordStatus,
  recordOrigin: RECORD_ORIGIN.automatic,
  status,
  locationName: null,
  totalVehicleMiles: null,
  annotation: null,
  comment: null,
  supersedesId: null,
  editedById: null,
  editorType: null,
  editReason: null,
  vehicleId: null,
});

async function menuFor(event: LogEventView) {
  const onRequestEdit = vi.fn();
  render(
    <ToastProvider>
      <LogEventsCard
        events={[event]}
        timezone="America/New_York"
        isLoading={false}
        isError={false}
        onRetry={() => {}}
        showAllRecords
        onToggleShowAll={() => {}}
        pendingEditCount={0}
        highlightedEventId={null}
        onRequestEdit={onRequestEdit}
        onViewAll={() => {}}
      />
    </ToastProvider>,
  );
  await userEvent.setup().click(screen.getByRole('button', { name: 'Row actions' }));
  return onRequestEdit;
}

describe('LogEventsCard — edit action (QA CODE-027)', () => {
  it('offers "Request an edit" on an active duty-status record', async () => {
    const onRequestEdit = await menuFor(row('1', RECORD_STATUS.active));
    await userEvent.setup().click(screen.getByText('Request an edit'));
    expect(onRequestEdit).toHaveBeenCalled();
  });

  it.each([
    ['a retired original', row('2', RECORD_STATUS.superseded)],
    ['a pending proposal', row('3', RECORD_STATUS.proposed)],
    ['a rejected proposal', row('4', RECORD_STATUS.rejected)],
    ['a non-duty event', row('5', RECORD_STATUS.active, null)],
  ])('hides it on %s', async (_label, event) => {
    await menuFor(event);
    expect(screen.queryByText('Request an edit')).not.toBeInTheDocument();
    expect(screen.getByText('View full record')).toBeInTheDocument();
  });
});
