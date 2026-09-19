import { describe, expect, it } from 'vitest';
import * as filter from './inputFilters';

describe('inputFilters', () => {
  it('phone drops letters and symbols but keeps phone punctuation', () => {
    expect(filter.phone('+1 (614) 555-0188')).toBe('+1 (614) 555-0188');
    expect(filter.phone('abc+99 8x90*12#3')).toBe('99 890123');
    expect(filter.phone('+998 90 123+45')).toBe('+998 90 12345');
    expect(filter.phone('1'.repeat(30))).toHaveLength(filter.PHONE_MAX_LENGTH);
  });

  it('digits keeps digits only, up to the limit', () => {
    expect(filter.digits('MC-12a34', 8)).toBe('1234');
    expect(filter.digits('123456789', 8)).toBe('12345678');
  });

  it('mcNumber keeps an optional MC- prefix and digits', () => {
    expect(filter.mcNumber('MC-892014')).toBe('MC-892014');
    expect(filter.mcNumber('mc892014x')).toBe('MC-892014');
    expect(filter.mcNumber('m')).toBe('M');
    expect(filter.mcNumber('892a014')).toBe('892014');
  });

  it('ein and usZip place the hyphen themselves', () => {
    expect(filter.ein('12a3456789999')).toBe('12-3456789');
    expect(filter.ein('12')).toBe('12');
    expect(filter.usZip('43215x1234')).toBe('43215-1234');
    expect(filter.usZip('4321')).toBe('4321');
  });

  it('caPostal keeps letters and digits in their A1A 1A1 slots', () => {
    expect(filter.caPostal('m5v2t6')).toBe('M5V 2T6');
    expect(filter.caPostal('55mm')).toBe('M');
  });

  it('city allows letters and place-name punctuation only', () => {
    expect(filter.city("Coeur d'Alene 42!")).toBe("Coeur d'Alene ");
    expect(filter.city('Toshkent')).toBe('Toshkent');
  });

  it('email strips whitespace', () => {
    expect(filter.email(' ops @acme.com ')).toBe('ops@acme.com');
  });

  it('time24 formats HH:MM:SS and refuses digits that cannot fit their slot', () => {
    expect(filter.time24('142658')).toBe('14:26:58');
    expect(filter.time24('14:26:58')).toBe('14:26:58');
    expect(filter.time24('1')).toBe('1');
    expect(filter.time24('143')).toBe('14:3');
    expect(filter.time24('25:99')).toBe('2');
    expect(filter.time24('2359599')).toBe('23:59:59');
    expect(filter.time24('ab12cd')).toBe('12');
  });

  it('decimal keeps one point and caps both sides', () => {
    expect(filter.decimal('1079.4', 6, 1)).toBe('1079.4');
    expect(filter.decimal('1a0.7.9', 6, 1)).toBe('10.7');
    expect(filter.decimal('12345678', 6, 1)).toBe('123456');
    expect(filter.decimal('5.', 6, 1)).toBe('5.');
  });
});
