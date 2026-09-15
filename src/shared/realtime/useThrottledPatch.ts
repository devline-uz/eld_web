// owner: web-realtime — glues the 200 ms throttle to `queryClient.setQueryData` (web/tz.md §7.2),
// so a screen wiring `telemetry.point` (or any future high-frequency event) patches the one query
// it cares about instead of invalidating the whole list.
//
// `updater` must be referentially stable (wrap it in `useCallback`) — it is a `useMemo`
// dependency, not read through a ref, per the project's react-hooks/refs rule. An unstable
// `updater` still works correctly call-by-call, it just restarts the throttle window every
// render instead of spanning it.
import { useEffect, useMemo } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { throttle } from './throttle';

/**
 * `patch(payload)` is throttled to `ms` (default 200 — §7.2); each call runs `updater(current,
 * payload)` and writes the result with `setQueryData`, never `invalidateQueries`.
 */
export function useThrottledPatch<TData, TPayload>(
  queryKey: QueryKey,
  updater: (current: TData | undefined, payload: TPayload) => TData,
  ms = 200,
): (payload: TPayload) => void {
  const queryClient = useQueryClient();
  const keySignature = JSON.stringify(queryKey);

  const throttled = useMemo(
    () =>
      throttle<TPayload>((payload) => {
        queryClient.setQueryData<TData>(queryKey, (current) => updater(current, payload));
      }, ms),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keySignature is queryKey's content equality; the array literal itself is a fresh reference every render and would defeat the memo
    [keySignature, ms, queryClient, updater],
  );

  useEffect(() => () => throttled.cancel(), [throttled]);

  return throttled;
}
