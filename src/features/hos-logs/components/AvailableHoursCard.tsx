// owner: web-hos-logs — W-08 card 1 of 3, `Available hours`.
//
// ⛔ GAP B-2 — the four clocks (drive / shift / cycle / break) come from the ELD's HOS engine, and
// `GET /drivers/:id/hos` is the only endpoint that exposes them. The panel deliberately does NOT
// recompute them from the daily totals: a shift or a 30-minute break straddles midnight, so a
// client-side approximation would put a wrong number on an inspector's screen. Until B-2 ships
// the card renders <ErrorState> in place (web/backend-gaps.md).
import { Card, SectionHeader } from '@/shared/ui/Card';
import { HosMeter } from '@/shared/ui/HosMeter';
import { EldStaleNotice } from '@/shared/ui/EldStale';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { formatHosHours, hosClockNotes } from '@/shared/format';
import { useDriverHos, type DriverHosResponse } from '@/shared/api/drivers';
import { cycleRuleLabel } from '../grid';

function AvailableHoursMeters({ clocks }: { clocks: DriverHosResponse }) {
  // A clock at 00:00 is "limit exceeded" only while the driver is driving; otherwise it names
  // what the driver needs before driving again (10-hour break, cycle, 30-minute break).
  const notes = hosClockNotes(clocks);
  return (
    <div className="flex flex-col gap-4">
      <HosMeter
        label="Drive"
        remainingSec={clocks.driveRemainingSec}
        limitSec={clocks.driveLimitSec}
        zeroNote={notes.drive}
      />
      <HosMeter
        label="Shift"
        remainingSec={clocks.shiftRemainingSec}
        limitSec={clocks.shiftLimitSec}
        ofHint={`of ${formatHosHours(clocks.shiftLimitSec)}`}
        zeroNote={notes.shift}
      />
      <HosMeter
        label="Cycle"
        remainingSec={clocks.cycleRemainingSec}
        limitSec={clocks.cycleLimitSec}
        ofHint={`of ${formatHosHours(clocks.cycleLimitSec)}`}
        zeroNote={notes.cycle}
      />
      <HosMeter
        label="Break in"
        remainingSec={clocks.breakInSec}
        limitSec={clocks.breakLimitSec}
        ofHint={`of ${formatHosHours(clocks.breakLimitSec)} driving`}
        zeroNote={notes.break}
      />
    </div>
  );
}

export function AvailableHoursCard({ driverId }: { driverId: string }) {
  const query = useDriverHos(driverId);

  return (
    <Card>
      <SectionHeader title="Available hours" subtitle={cycleRuleLabel(query.data?.cycleLimitSec, query.data?.hosRuleset)} />
      <div className="mt-4">
        {query.isLoading ? (
          <LoadingState rows={4} />
        ) : !query.data ? (
          <ErrorState
            title="Could not load available hours"
            description="The hours-of-service clocks did not respond. Your data is safe — try again in a moment."
            onRetry={() => void query.refetch()}
          />
        ) : query.data.isStale ? (
          // BUG-002 — a status stuck open for days is a lost ELD, not four clocks at 00:00.
          <EldStaleNotice dutyStatus={query.data.dutyStatus} statusSince={query.data.statusSince} computedAt={query.data.computedAt} />
        ) : (
          <AvailableHoursMeters clocks={query.data} />
        )}
      </div>
    </Card>
  );
}
