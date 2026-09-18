// owner: web-reports-transfer — the `from`/`to` day keys every ranged report keeps in the URL
// (§9: `/reports/*` restores its full state from the URL). Default: month to date in the carrier zone.
import { useSearchParams } from 'react-router-dom';
import { monthStartKey, todayKey } from './reportMeta';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A half-specified deep link keeps the half it names (web/bugs.md WB-102): `?from=` alone runs to
 * today, `?to=` alone starts on that month's first day. Only a missing/invalid pair falls back to
 * month to date.
 */
export function resolveRange(rawFrom: string, rawTo: string, today: string): { from: string; to: string } {
  const hasFrom = DAY_RE.test(rawFrom);
  const hasTo = DAY_RE.test(rawTo);
  const from = hasFrom ? rawFrom : hasTo ? monthStartKey(rawTo) : monthStartKey(today);
  const to = hasTo ? rawTo : hasFrom && rawFrom > today ? rawFrom : today;
  return from <= to ? { from, to } : { from: monthStartKey(today), to: today };
}

export function useReportRange(timezone: string) {
  const [params, setParams] = useSearchParams();
  const today = todayKey(timezone);
  const rawFrom = params.get('from') ?? '';
  const rawTo = params.get('to') ?? '';
  const { from, to } = resolveRange(rawFrom, rawTo, today);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  return {
    from,
    to,
    params,
    setRange: (nextFrom: string, nextTo: string) => update({ from: nextFrom, to: nextTo }),
    setParam: (key: string, value: string | null) => update({ [key]: value }),
    update,
  };
}
