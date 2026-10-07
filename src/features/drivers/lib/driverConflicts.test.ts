import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { findCachedDriverConflicts, findDriverConflicts } from './driverConflicts';

const A = { id: 'a', username: 'jsmith', email: 'john@example.com', phone: '+1 (614) 555-1000', cdlNumber: 'W1234567', status: 'ACTIVE' };
const B = { id: 'b', username: 'mlee', email: 'mia@example.com', phone: '+16145552000', cdlNumber: 'X7654321', status: 'ACTIVE' };

describe('findDriverConflicts', () => {
  it.each([
    ['username (trimmed)', { username: '  jsmith ' }, 'username'],
    ['email (case + spaces)', { email: ' JOHN@Example.com ' }, 'email'],
    ['phone (other format)', { phone: '614.555.1000' }, 'phone'],
    ['phone (E.164)', { phone: '+16145551000' }, 'phone'],
    ['licence (case, spaces, dashes)', { cdlNumber: ' w-123 4567 ' }, 'cdlNumber'],
  ])('flags a duplicate %s', (_n, candidate, field) => {
    expect(findDriverConflicts(candidate, [A, B])).toEqual([field]);
  });

  it('username is case-sensitive like the server', () => {
    expect(findDriverConflicts({ username: 'JSMITH' }, [A])).toEqual([]);
  });

  it('empty values never conflict', () => {
    expect(findDriverConflicts({ username: '', email: ' ', phone: '', cdlNumber: undefined }, [{ ...A, email: '', phone: null }])).toEqual([]);
  });

  it('excludeId skips the edited driver, and an unchanged value is not re-checked', () => {
    expect(findDriverConflicts({ email: A.email, cdlNumber: A.cdlNumber }, [A, B], { excludeId: 'a' })).toEqual([]);
    expect(findDriverConflicts({ email: B.email }, [A, B], { excludeId: 'a', current: A })).toEqual(['email']);
    // legacy: the driver already shares the value with another one -> not blocked while unchanged
    expect(findDriverConflicts({ email: A.email }, [{ ...B, email: A.email }], { current: A })).toEqual([]);
  });

  it('terminated and deleted drivers hold nothing', () => {
    expect(findDriverConflicts({ email: A.email, cdlNumber: A.cdlNumber }, [{ ...A, status: 'TERMINATED' }])).toEqual([]);
    expect(findDriverConflicts({ email: A.email }, [{ ...A, deletedAt: '2026-01-01' }])).toEqual([]);
  });

  it('only checks the fields the candidate carries', () => {
    expect(findDriverConflicts({ email: A.email }, [A])).toEqual(['email']);
  });
});

describe('findCachedDriverConflicts', () => {
  it('reads every cached list page; no cached list means no pre-check', () => {
    const qc = new QueryClient();
    expect(findCachedDriverConflicts(qc, { email: A.email })).toEqual([]);
    qc.setQueryData(['drivers', { page: 1 }], { items: [A] });
    qc.setQueryData(['drivers', { page: 2 }], { items: [B] });
    qc.setQueryData(['drivers', 'a'], { id: 'a' });
    expect(findCachedDriverConflicts(qc, { email: B.email, phone: A.phone })).toEqual(['email', 'phone']);
  });
});
