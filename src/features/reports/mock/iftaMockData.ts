// owner: web-reports-transfer — W-12 IFTA DEMO DATA (not app logic).
//
// A small US fleet the IFTA page falls back to while `GET /reports/ifta/summary` has nothing to
// show (empty rows or a failed request). Wired in `./useIftaMock.ts`; switched by `VITE_IFTA_MOCK`
// (see that file). To remove the demo entirely: delete this `mock/` folder and point the hook
// imports in `IftaReportPage.tsx` back at `@/shared/api/reports` / `@/shared/api/vehicles`.
//
// The summary is BUILT from per-unit, per-jurisdiction trips (not hard-coded totals), so every
// filter the screen sends — quarter, jurisdiction, vehicle group — narrows the same numbers the
// way the backend does (D-107), and `totals` / `kpis` are always the sums of the rows. Numbers
// are seeded by quarter + unit + state, so they are stable across renders and page loads.
// The current quarter is scaled to the share of it that has elapsed ("Q4 to date").
import type { IftaFilters, IftaJurisdictionOption, IftaJurisdictionRow, IftaSummary } from '@/shared/api/reports';
import type { VehicleGroupRow } from '@/shared/api/vehicles';
import { previousQuarters } from '../reportMeta';

/** Every mock id starts with this. */
export const MOCK_ID_PREFIX = 'mock-';

/* ---------------------------------------------------------------- jurisdictions */

interface StateProfile {
  name: string;
  /** IFTA diesel rate, USD per gallon (approximate 2026 rates incl. surcharges). */
  rate: number;
  /** Share of miles that is taxable (the rest: exempt / off-highway / trip-permit miles). */
  taxable: number;
  /** Where drivers prefer to fuel: > 1 cheap-tax states, < 1 expensive ones. */
  fuelSkew: number;
}

const STATES: Record<string, StateProfile> = {
  AL: { name: 'Alabama', rate: 0.32, taxable: 0.985, fuelSkew: 1.1 },
  AR: { name: 'Arkansas', rate: 0.285, taxable: 0.985, fuelSkew: 1.15 },
  AZ: { name: 'Arizona', rate: 0.26, taxable: 0.975, fuelSkew: 1.1 },
  CA: { name: 'California', rate: 1.04, taxable: 0.96, fuelSkew: 0.45 },
  FL: { name: 'Florida', rate: 0.405, taxable: 0.955, fuelSkew: 0.85 },
  GA: { name: 'Georgia', rate: 0.372, taxable: 0.98, fuelSkew: 1.1 },
  IL: { name: 'Illinois', rate: 0.743, taxable: 0.95, fuelSkew: 0.55 },
  IN: { name: 'Indiana', rate: 0.61, taxable: 0.95, fuelSkew: 0.6 },
  KY: { name: 'Kentucky', rate: 0.284, taxable: 0.985, fuelSkew: 1.1 },
  LA: { name: 'Louisiana', rate: 0.2, taxable: 0.98, fuelSkew: 1.2 },
  MO: { name: 'Missouri', rate: 0.295, taxable: 0.985, fuelSkew: 1.2 },
  MS: { name: 'Mississippi', rate: 0.18, taxable: 0.985, fuelSkew: 1.15 },
  NM: { name: 'New Mexico', rate: 0.21, taxable: 0.98, fuelSkew: 1.2 },
  OH: { name: 'Ohio', rate: 0.47, taxable: 0.955, fuelSkew: 0.75 },
  OK: { name: 'Oklahoma', rate: 0.19, taxable: 0.94, fuelSkew: 1.5 },
  PA: { name: 'Pennsylvania', rate: 0.741, taxable: 0.95, fuelSkew: 0.5 },
  TN: { name: 'Tennessee', rate: 0.27, taxable: 0.985, fuelSkew: 1.25 },
  TX: { name: 'Texas', rate: 0.2, taxable: 0.975, fuelSkew: 1.45 },
};

/** `GET /reports/ifta/jurisdictions` fallback — every state the demo fleet drives, name order. */
export const MOCK_IFTA_JURISDICTIONS: IftaJurisdictionOption[] = Object.entries(STATES)
  .map(([code, s]) => ({ code, name: s.name, country: 'US' as const }))
  .sort((a, b) => a.name.localeCompare(b.name));

/* ---------------------------------------------------------------- groups + units */

const GROUP_SEED: [id: string, name: string, description: string, color: string | null][] = [
  [`${MOCK_ID_PREFIX}grp-otr`, 'Long Haul — I-40', 'Cross-country CA ↔ TN dry van', null],
  [`${MOCK_ID_PREFIX}grp-se`, 'Southeast Regional', 'Gulf coast and Florida reefers', null],
  [`${MOCK_ID_PREFIX}grp-mw`, 'Midwest Dedicated', 'Chicago — Pittsburgh lanes', null],
];

/** Lanes as `[state, share of the unit's miles]` — shares add up to ~1. */
type Lane = [string, number][];
const LANES: Record<string, Lane> = {
  i40: [['CA', 0.12], ['AZ', 0.17], ['NM', 0.18], ['TX', 0.08], ['OK', 0.17], ['AR', 0.13], ['TN', 0.15]],
  sw: [['CA', 0.22], ['AZ', 0.3], ['NM', 0.16], ['TX', 0.32]],
  gulf: [['TX', 0.34], ['LA', 0.17], ['MS', 0.1], ['AL', 0.1], ['GA', 0.11], ['FL', 0.18]],
  i75: [['FL', 0.24], ['GA', 0.26], ['TN', 0.18], ['KY', 0.14], ['OH', 0.1], ['IN', 0.08]],
  mw: [['IL', 0.26], ['IN', 0.24], ['OH', 0.3], ['PA', 0.2]],
  mwSouth: [['IL', 0.2], ['MO', 0.22], ['OK', 0.16], ['TX', 0.24], ['AR', 0.18]],
};

interface MockUnit {
  unitNumber: string;
  groupId: string;
  lane: Lane;
  /** Miles in a full, average quarter. */
  quarterMiles: number;
  mpg: number;
}

const UNIT_SEED: [unit: string, group: number, lane: keyof typeof LANES, miles: number, mpg: number][] = [
  ['T-101', 0, 'i40', 33_400, 6.6],
  ['T-104', 0, 'i40', 31_900, 6.8],
  ['T-117', 0, 'sw', 29_800, 6.4],
  ['T-122', 0, 'i40', 34_100, 7.1],
  ['T-130', 0, 'sw', 30_600, 6.5],
  ['T-205', 1, 'gulf', 27_300, 6.2],
  ['T-211', 1, 'i75', 28_900, 6.7],
  ['T-218', 1, 'gulf', 26_400, 6.3],
  ['T-224', 1, 'i75', 29_500, 6.9],
  ['T-302', 2, 'mw', 24_800, 6.4],
  ['T-309', 2, 'mwSouth', 28_200, 6.6],
  ['T-315', 2, 'mw', 25_700, 6.1],
  ['T-321', 2, 'mwSouth', 27_600, 6.8],
];

const UNITS: MockUnit[] = UNIT_SEED.map(([unitNumber, group, lane, quarterMiles, mpg]) => ({
  unitNumber,
  groupId: GROUP_SEED[group]![0],
  lane: LANES[lane]!,
  quarterMiles,
  mpg,
}));

/** `GET /vehicle-groups` fallback — the demo fleet's three groups. */
export const MOCK_VEHICLE_GROUPS: VehicleGroupRow[] = GROUP_SEED.map(([id, name, description, color]) => ({
  id,
  name,
  description,
  color,
  vehicleCount: UNITS.filter((u) => u.groupId === id).length,
  createdAt: '2025-11-03T15:00:00.000Z',
  updatedAt: '2026-06-18T15:00:00.000Z',
}));

/* ---------------------------------------------------------------- helpers */

/** FNV-1a — a stable 32-bit seed from a string. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic noise in `[1 - spread, 1 + spread]`. */
function jitter(key: string, spread: number): number {
  return 1 + ((hash(key) % 10_000) / 10_000 - 0.5) * 2 * spread;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Seasonal freight volume — Q1 slow, Q3 peak. */
const SEASON = [0.93, 1.01, 1.05, 0.98];
/** Seasonal fuel economy — winter blend and idling cost MPG, summer gains a little. */
const SEASON_MPG = [0.95, 1, 1.02, 0.98];

/** Share of the quarter that has happened (1 for past quarters, 0 for future ones). */
function elapsedShare(quarter: string, now = Date.now()): number {
  const year = Number(quarter.slice(0, 4));
  const q = Number(quarter.slice(-1));
  const start = Date.UTC(year, (q - 1) * 3, 1);
  const end = Date.UTC(year, q * 3, 1);
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/** Units in the selected group. A real group id (groups from the API) gets a stable subset. */
function unitsFor(groupId: string | undefined): MockUnit[] {
  if (!groupId) return UNITS;
  const own = UNITS.filter((u) => u.groupId === groupId);
  if (own.length) return own;
  const pick = hash(groupId) % 3;
  return UNITS.filter((_, i) => i % 3 === pick);
}

interface Leg {
  state: string;
  miles: number;
  taxableMiles: number;
  /** Gallons burned driving this leg (for the row MPG). */
  burnedGal: number;
  /** Gallons bought in this state. */
  fuelGal: number;
}

/** One unit's miles and fuel purchases per state for one quarter. */
function unitLegs(unit: MockUnit, quarter: string): Leg[] {
  const q = Number(quarter.slice(-1));
  const share = elapsedShare(quarter);
  if (share === 0) return [];
  const mpg = unit.mpg * (SEASON_MPG[q - 1] ?? 1) * jitter(`${quarter}|${unit.unitNumber}|mpg`, 0.03);
  const miles = unit.quarterMiles * (SEASON[q - 1] ?? 1) * jitter(`${quarter}|${unit.unitNumber}`, 0.07) * share;
  const legs = unit.lane.map(([state, part]) => {
    const profile = STATES[state]!;
    const legMiles = miles * part * jitter(`${quarter}|${unit.unitNumber}|${state}`, 0.12);
    const burned = legMiles / mpg;
    return {
      state,
      miles: legMiles,
      taxableMiles: legMiles * profile.taxable,
      burnedGal: burned,
      fuelGal: burned * profile.fuelSkew * jitter(`${quarter}|${unit.unitNumber}|${state}|fuel`, 0.15),
    };
  });
  // Gallons bought over the quarter equal gallons burned — they are only bought in other states.
  const burned = legs.reduce((sum, l) => sum + l.burnedGal, 0);
  const bought = legs.reduce((sum, l) => sum + l.fuelGal, 0);
  return legs.map((l) => ({ ...l, fuelGal: (l.fuelGal * burned) / bought }));
}

interface Totals {
  miles: number;
  taxableMiles: number;
  burnedGal: number;
  fuelGal: number;
}

/** Per-state sums for a set of units over one quarter. */
function aggregate(units: MockUnit[], quarter: string): Map<string, Totals> {
  const byState = new Map<string, Totals>();
  for (const unit of units) {
    for (const leg of unitLegs(unit, quarter)) {
      const t = byState.get(leg.state) ?? { miles: 0, taxableMiles: 0, burnedGal: 0, fuelGal: 0 };
      t.miles += leg.miles;
      t.taxableMiles += leg.taxableMiles;
      t.burnedGal += leg.burnedGal;
      t.fuelGal += leg.fuelGal;
      byState.set(leg.state, t);
    }
  }
  return byState;
}

function fleetMpgOf(byState: Map<string, Totals>): number | null {
  let miles = 0;
  let fuel = 0;
  for (const t of byState.values()) {
    miles += t.miles;
    fuel += t.fuelGal;
  }
  return fuel > 0 ? miles / fuel : null;
}

/** ~118 gal per fill-up across a 150-gal saddle-tank tractor. */
const GAL_PER_RECEIPT = 118;

/* ---------------------------------------------------------------- summary */

/**
 * The `IftaSummary` the backend would answer for these filters (D-107): `jurisdiction` keeps one
 * row and scopes miles / gallons / receipts; fleet MPG stays fleet-wide; `vehicleGroupId` narrows
 * the units. Tax due = (taxable miles ÷ fleet MPG − gallons bought there) × rate — negative is a
 * credit, exactly as on the IFTA return.
 */
export function buildIftaMockSummary(filters: IftaFilters): IftaSummary {
  const { quarter, jurisdiction, vehicleGroupId } = filters;
  const units = unitsFor(vehicleGroupId);
  const byState = aggregate(units, quarter);
  const fleetMpg = fleetMpgOf(byState);
  const prevQuarter = previousQuarters(quarter, 2)[1] ?? quarter;
  const fleetMpgPrev = fleetMpgOf(aggregate(units, prevQuarter));

  const allRows: IftaJurisdictionRow[] = [...byState.entries()]
    .map(([state, t]) => {
      const totalMiles = Math.round(t.miles);
      const taxableMiles = Math.round(t.taxableMiles);
      const fuelGal = Math.round(t.fuelGal);
      const taxableGal = fleetMpg ? taxableMiles / fleetMpg : 0;
      return {
        jurisdiction: state,
        totalMiles,
        taxableMiles,
        fuelGal,
        // Miles per gallon burned in the state (fuel bought there is skewed by tax-driven fueling).
        mpg: t.burnedGal > 0 ? round1(t.miles / t.burnedGal) : null,
        taxDueUsd: round2((taxableGal - fuelGal) * STATES[state]!.rate),
      };
    })
    .sort((a, b) => b.totalMiles - a.totalMiles);

  const code = jurisdiction?.toUpperCase();
  const rows = code ? allRows.filter((r) => r.jurisdiction === code) : allRows;
  const totalMiles = rows.reduce((s, r) => s + r.totalMiles, 0);
  const taxableMiles = rows.reduce((s, r) => s + r.taxableMiles, 0);
  const fuelGal = rows.reduce((s, r) => s + (r.fuelGal ?? 0), 0);
  const taxDueUsd = round2(rows.reduce((s, r) => s + (r.taxDueUsd ?? 0), 0));
  const mpg = fleetMpg === null ? null : round1(fleetMpg);

  return {
    quarter,
    unitCount: units.length,
    kpis: {
      totalMiles,
      taxableMiles,
      taxablePct: totalMiles > 0 ? round1((taxableMiles / totalMiles) * 100) : null,
      fuelGal,
      receiptCount: Math.round(fuelGal / GAL_PER_RECEIPT),
      fleetMpg: mpg,
      fleetMpgPrev: fleetMpgPrev === null ? null : round1(fleetMpgPrev),
    },
    rows,
    totals: { totalMiles, taxableMiles, fuelGal, mpg, taxDueUsd: rows.length ? taxDueUsd : null },
  };
}
