// owner: web-hos-logs — W-08 card 1 of 3, `Available hours`.
//
// ⛔ GAP B-2 — the four clocks (drive / shift / cycle / break) come from the ELD's HOS engine, and
// `GET /drivers/:id/hos` is the only endpoint that exposes them. The panel deliberately does NOT
// recompute them from the daily totals: a shift or a 30-minute break straddles midnight, so a
// client-side approximation would put a wrong number on an inspector's screen. Until B-2 ships
// the card renders <ErrorState> in place (web/backend-gaps.md).
import { Card, SectionHeader } from '@/shared/ui/Card';
import { HosMeter } from '@/shared/ui/HosMeter';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { formatHosHours } from '@/shared/format';
import { useDriverHos } from '@/shared/api/drivers';
import { cycleRuleLabel } from '../grid';

export function AvailableHoursCard({ driverId }: { driverId: string }) {
  const query = useDriverHos(driverId);

  return (
    <Card>
      <SectionHeader title="Available hours" subtitle={cycleRuleLabel(query.data?.cycleLimitSec)} />
      <div className="mt-4">
        {query.isLoading ? (
          <LoadingState rows={4} />
        ) : query.isError || !query.data ? (
          <ErrorState
            title="Could not load available hours"
            description="The hours-of-service clocks did not respond. Your data is safe — try again in a moment."
            onRetry={() => void query.refetch()}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <HosMeter label="Drive" remainingSec={query.data.driveRemainingSec} limitSec={query.data.driveLimitSec} />
            <HosMeter
              label="Shift"
              remainingSec={query.data.shiftRemainingSec}
              limitSec={query.data.shiftLimitSec}
              ofHint={`of ${formatHosHours(query.data.shiftLimitSec)}`}
            />
            <HosMeter
              label="Cycle"
              remainingSec={query.data.cycleRemainingSec}
              limitSec={query.data.cycleLimitSec}
              ofHint={`of ${formatHosHours(query.data.cycleLimitSec)}`}
            />
            <HosMeter
              label="Break in"
              remainingSec={query.data.breakInSec}
              limitSec={query.data.breakLimitSec}
              ofHint={`of ${formatHosHours(query.data.breakLimitSec)} driving`}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
