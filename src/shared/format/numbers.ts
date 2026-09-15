// web/tz.md §8.1 / §8.5 — the backend already returns imperial and already rounded. The frontend
// never converts and never rounds: it groups thousands and adds the unit.
import { EMPTY, isBlank } from './empty';

type Num = number | null | undefined;

const LOCALE = 'en-US';

const isFiniteNumber = (value: Num): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Thousands grouping only — no rounding (§8.5). */
export function formatNumber(value: Num, fractionDigits?: number): string {
  if (!isFiniteNumber(value)) return EMPTY.dash;
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits ?? 20,
  });
}

/** `993,589 mi` */
export const formatDistance = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value)} mi` : EMPTY.dash;

/** `61 mph` — integers only, as delivered. */
export const formatSpeed = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value)} mph` : EMPTY.dash;

/** `62,410 gal` */
export const formatFuel = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value)} gal` : EMPTY.dash;

/** `6.4` — one decimal, arrives ready-made. */
export const formatMpg = (value: Num): string =>
  isFiniteNumber(value) ? formatNumber(value, 1) : EMPTY.dash;

/** `1070.2 h` — the table form. */
export const formatEngineHours = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value, 1)} h` : EMPTY.dash;

/** `1,070 h 12 m` — the KPI form. */
export function formatEngineHoursLong(value: Num): string {
  if (!isFiniteNumber(value)) return EMPTY.dash;
  const whole = Math.trunc(value);
  const minutes = Math.round((value - whole) * 60);
  return `${formatNumber(whole)} h ${String(minutes).padStart(2, '0')} m`;
}

/** `79 °C` */
export const formatTemperature = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value)} °C` : EMPTY.dash;

/** `13.9 V` */
export const formatVoltage = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value, 1)} V` : EMPTY.dash;

/** `78%` — the backend sends the percentage, including `93.5`. */
export const formatPercent = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value)}%` : EMPTY.dash;

/** `21,300 lbs` */
export const formatWeight = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value)} lbs` : EMPTY.dash;

/** `$2,184.30` — right-aligned by the table, always two decimals. */
export const formatMoney = (value: Num): string =>
  isFiniteNumber(value) ? `$${formatNumber(value, 2)}` : EMPTY.dash;

/** `-0.42 g` / `0.38 g` — signed, two decimals. */
export const formatGForce = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value, 2)} g` : EMPTY.dash;

/** `993,589` — an odometer reading without the unit (the column header carries it). */
export const formatOdometer = (value: Num): string => formatNumber(value);

/** `Due in 3,100 mi` (the date half is added by formatDueBy). */
export const formatMilesRemaining = (value: Num): string =>
  isFiniteNumber(value) ? `Due in ${formatNumber(value)} mi` : EMPTY.dash;

/** `2.4 gal wasted` */
export const formatFuelWasted = (value: Num): string =>
  isFiniteNumber(value) ? `${formatNumber(value, 1)} gal wasted` : EMPTY.dash;

export { isBlank };
