import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  formatDistance,
  formatEngineHours,
  formatEngineHoursLong,
  formatFuel,
  formatFuelWasted,
  formatGForce,
  formatMilesRemaining,
  formatMoney,
  formatMpg,
  formatNumber,
  formatOdometer,
  formatPercent,
  formatSpeed,
  formatTemperature,
  formatVoltage,
  formatWeight,
  isBlank,
  orDash,
  orNone,
  orNotAssigned,
  orUnassigned,
} from './index';

describe('§8.1 units — group thousands, never convert, never round', () => {
  it('formats every measurement the way the design draws it', () => {
    expect(formatDistance(993589)).toBe('993,589 mi');
    expect(formatSpeed(61)).toBe('61 mph');
    expect(formatSpeed(0)).toBe('0 mph');
    expect(formatFuel(62410)).toBe('62,410 gal');
    expect(formatMpg(6.4)).toBe('6.4');
    expect(formatEngineHours(1070.2)).toBe('1,070.2 h');
    expect(formatEngineHoursLong(1070.2)).toBe('1,070 h 12 m');
    expect(formatTemperature(79)).toBe('79 °C');
    expect(formatVoltage(13.9)).toBe('13.9 V');
    expect(formatPercent(78)).toBe('78%');
    expect(formatPercent(93.5)).toBe('93.5%');
    expect(formatWeight(21300)).toBe('21,300 lbs');
    expect(formatMoney(2184.3)).toBe('$2,184.30');
    expect(formatGForce(-0.42)).toBe('-0.42 g');
    expect(formatGForce(0.38)).toBe('0.38 g');
    expect(formatOdometer(993589)).toBe('993,589');
    expect(formatMilesRemaining(3100)).toBe('Due in 3,100 mi');
    expect(formatFuelWasted(2.4)).toBe('2.4 gal wasted');
    expect(formatNumber(1234.5678)).toBe('1,234.5678'); // §8.5 — the frontend never rounds
    expect(formatNumber(12, 2)).toBe('12.00');
  });

  it('renders a missing or non-finite number as an em dash', () => {
    const formatters = [
      formatDistance,
      formatSpeed,
      formatFuel,
      formatMpg,
      formatEngineHours,
      formatEngineHoursLong,
      formatTemperature,
      formatVoltage,
      formatPercent,
      formatWeight,
      formatMoney,
      formatGForce,
      formatOdometer,
      formatMilesRemaining,
      formatFuelWasted,
      formatNumber,
    ];
    for (const format of formatters) {
      expect(format(null)).toBe(EMPTY.dash);
      expect(format(undefined)).toBe(EMPTY.dash);
      expect(format(Number.NaN)).toBe(EMPTY.dash);
    }
  });
});

describe('§8.4 empty values', () => {
  it('uses the exact placeholder for each case', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(0)).toBe(false);
    expect(orDash(null, String)).toBe('—');
    expect(orDash(12, (v) => `${v}`)).toBe('12');
    expect(orUnassigned(null)).toBe('Unassigned');
    expect(orUnassigned('Marcus Webb')).toBe('Marcus Webb');
    expect(orNotAssigned(undefined)).toBe('Not assigned');
    expect(orNotAssigned('ELD-114')).toBe('ELD-114');
    expect(orNone('')).toBe('None');
    expect(orNone('2 defects')).toBe('2 defects');
    expect(EMPTY.notSubmitted).toBe('Not submitted');
  });
});
