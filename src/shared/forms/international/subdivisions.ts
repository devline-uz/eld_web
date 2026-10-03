// ISO 3166-2 first-level subdivisions for the countries whose carriers pick from a list, and
// what each country calls that level. Every other country gets a free-text field under its own
// label. Stored value = the subdivision code without the country prefix (`OH`, `ON`, `TO`), so
// the existing US rows (`state: 'OH'`) keep working unchanged.
//
// A full ISO 3166-2 dataset (every country) costs ~60 KB gzip against a ~170 KB total-bundle
// headroom (web/decisions.md WD-103), so only these lists ship; adding a country is one entry.
import { US_STATES } from '../usStates';
import type { CountryCode } from './countries';

export interface Subdivision {
  code: string;
  /** Omitted where the code itself is what users pick by (USPS state codes). */
  name?: string;
}

const named = (entries: Record<string, string>): Subdivision[] =>
  Object.entries(entries).map(([code, name]) => ({ code, name }));

export const SUBDIVISIONS: Partial<Record<CountryCode, readonly Subdivision[]>> = {
  US: US_STATES.map((code) => ({ code })),
  CA: named({
    AB: 'Alberta',
    BC: 'British Columbia',
    MB: 'Manitoba',
    NB: 'New Brunswick',
    NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia',
    NT: 'Northwest Territories',
    NU: 'Nunavut',
    ON: 'Ontario',
    PE: 'Prince Edward Island',
    QC: 'Quebec',
    SK: 'Saskatchewan',
    YT: 'Yukon',
  }),
  MX: named({
    AGU: 'Aguascalientes',
    BCN: 'Baja California',
    BCS: 'Baja California Sur',
    CAM: 'Campeche',
    CHP: 'Chiapas',
    CHH: 'Chihuahua',
    CMX: 'Ciudad de México',
    COA: 'Coahuila',
    COL: 'Colima',
    DUR: 'Durango',
    GUA: 'Guanajuato',
    GRO: 'Guerrero',
    HID: 'Hidalgo',
    JAL: 'Jalisco',
    MEX: 'México',
    MIC: 'Michoacán',
    MOR: 'Morelos',
    NAY: 'Nayarit',
    NLE: 'Nuevo León',
    OAX: 'Oaxaca',
    PUE: 'Puebla',
    QUE: 'Querétaro',
    ROO: 'Quintana Roo',
    SLP: 'San Luis Potosí',
    SIN: 'Sinaloa',
    SON: 'Sonora',
    TAB: 'Tabasco',
    TAM: 'Tamaulipas',
    TLA: 'Tlaxcala',
    VER: 'Veracruz',
    YUC: 'Yucatán',
    ZAC: 'Zacatecas',
  }),
  AU: named({
    ACT: 'Australian Capital Territory',
    NSW: 'New South Wales',
    NT: 'Northern Territory',
    QLD: 'Queensland',
    SA: 'South Australia',
    TAS: 'Tasmania',
    VIC: 'Victoria',
    WA: 'Western Australia',
  }),
  UZ: named({
    AN: 'Andijon',
    BU: 'Buxoro',
    FA: 'Farg‘ona',
    JI: 'Jizzax',
    NG: 'Namangan',
    NW: 'Navoiy',
    QA: 'Qashqadaryo',
    QR: 'Qoraqalpog‘iston',
    SA: 'Samarqand',
    SI: 'Sirdaryo',
    SU: 'Surxondaryo',
    TK: 'Toshkent (city)',
    TO: 'Toshkent (region)',
    XO: 'Xorazm',
  }),
};

const LABELS: Partial<Record<CountryCode, string>> = {
  US: 'State',
  CA: 'Province',
  MX: 'State',
  AU: 'State',
  BR: 'State',
  IN: 'State',
  DE: 'State',
  GB: 'Region/County',
  IE: 'County',
  UZ: 'Region',
  KZ: 'Region',
  FR: 'Region',
  IT: 'Province',
  ES: 'Province',
  CN: 'Province',
  JP: 'Prefecture',
};

/** `US` → `State`, `CA` → `Province`, `UZ` → `Region`; anything unlisted gets the neutral label. */
export function subdivisionLabel(country: CountryCode): string {
  return LABELS[country] ?? 'State / Province / Region';
}

/** The pick list, or `undefined` when the country takes free text. */
export function subdivisionsOf(country: CountryCode): readonly Subdivision[] | undefined {
  return SUBDIVISIONS[country];
}

export function subdivisionOptionLabel(subdivision: Subdivision): string {
  return subdivision.name ?? subdivision.code;
}

/** Whether `code` is on `country`'s pick list. */
export function isSubdivisionOf(code: string, country: CountryCode): boolean {
  return Boolean(SUBDIVISIONS[country]?.some((s) => s.code === code));
}
