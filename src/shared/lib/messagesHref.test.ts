import { describe, expect, it } from 'vitest';
import { messagesHref } from './messagesHref';

describe('messagesHref', () => {
  it('deep-links a driver and encodes the id', () => {
    expect(messagesHref('drv_1')).toBe('/messages?driverId=drv_1');
    expect(messagesHref('a b&c')).toBe('/messages?driverId=a+b%26c');
  });
  it('falls back to the plain page without a driver', () => {
    expect(messagesHref(null)).toBe('/messages');
    expect(messagesHref(undefined)).toBe('/messages');
    expect(messagesHref('')).toBe('/messages');
  });
});
