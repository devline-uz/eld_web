import { describe, expect, it } from 'vitest';
import { toTrailerPayloads } from './trailerRows';

describe('toTrailerPayloads', () => {
  it('maps CSV rows to import payloads, trimming and dropping blank VINs', () => {
    expect(toTrailerPayloads([{ number: ' T-1 ', vin: '' }, { number: 'T-2', vin: '1jjv532w7yl123456' }])).toEqual([
      { number: 'T-1' },
      { number: 'T-2', vin: '1JJV532W7YL123456' },
    ]);
  });
});
