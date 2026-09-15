import { describe, expect, it } from 'vitest';
import { UNKNOWN_DEVICE, deviceLabel } from './userAgent';

describe('deviceLabel', () => {
  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      'Mac · Chrome 129',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'iPhone · Safari 17',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
      'Windows PC · Edge 128',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0', 'Linux · Firefox 130'],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/127.0 Mobile Safari/537.36 OPR/83', 'Android · Opera 83'],
    ['Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)', 'Chromebook'],
    ['curl/8.5.0', 'curl/8.5.0'],
  ])('%s → %s', (ua, expected) => {
    expect(deviceLabel(ua)).toBe(expected);
  });

  it('prefers a stored device label and falls back for a missing agent', () => {
    expect(deviceLabel('curl/8.5.0', '  MacBook Pro  ')).toBe('MacBook Pro');
    expect(deviceLabel(null)).toBe(UNKNOWN_DEVICE);
    expect(deviceLabel('   ', '')).toBe(UNKNOWN_DEVICE);
  });
});
