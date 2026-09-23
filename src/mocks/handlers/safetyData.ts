// W-10 Safety — `GET /safety/events` and `GET /safety/scorecard`.
//
// The generated examples carry one event with NO `occurredAt` and one score row, so W-10's 30-day
// window (`SafetyPage.tsx:304`) dropped every row: the Events and Coaching tabs read 0 and the
// KPI tiles read 0 (mock-layer audit, 2026-09-23). These seeds are 46 events spread over the last 29 days in every
// status (COACHED included) and 12 ranked drivers, all on driver ids that exist in `/drivers`, so
// the client-side name join in `shared/api/safety.ts` resolves instead of printing
// "undefined undefined".
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import type { DriverScoreRow, SafetyEventRow } from '@/shared/api/safety';
import { ok, serverPage, url } from '../envelope';
import { SAFETY_EVENTS, SCORECARD, SCORECARD_PERIOD } from './mockState';

export const safetyDataHandlers = [
  http.get(url(endpoints.safety.events), ({ request }) => {
    const search = new URL(request.url).searchParams;
    const from = search.get('from');
    const to = search.get('to');
    const type = search.get('type');
    const inWindow = SAFETY_EVENTS.filter(
      (e) =>
        (!from || e.occurredAt >= from) &&
        (!to || e.occurredAt <= `${to}T23:59:59.999Z`) &&
        (!type || e.type === type),
    );
    return ok(serverPage<SafetyEventRow>(inWindow, request, ['locationName']));
  }),

  http.get(url(endpoints.safety.scorecard), () =>
    ok({
      items: SCORECARD as DriverScoreRow[],
      periodStart: SCORECARD_PERIOD.periodStart,
      periodEnd: SCORECARD_PERIOD.periodEnd,
    }),
  ),
];
