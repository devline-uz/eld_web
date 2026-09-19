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
});
