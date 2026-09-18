import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvRows } from './csv';

describe('parseCsv (WB-106)', () => {
  it('splits plain comma-separated rows', () => {
    expect(parseCsv('name,email\nAlice,a@x.com\nBob,b@x.com')).toEqual([
      { name: 'Alice', email: 'a@x.com' },
      { name: 'Bob', email: 'b@x.com' },
    ]);
  });

  it('keeps commas inside quoted fields intact', () => {
    const text = 'name,address,email\nAlice,"123 Main St, Suite 4",a@x.com';
    expect(parseCsv(text)).toEqual([{ name: 'Alice', address: '123 Main St, Suite 4', email: 'a@x.com' }]);
  });

  it('unescapes doubled quotes inside quoted fields', () => {
    const text = 'name,note\nAlice,"She said ""hi"" today"';
    expect(parseCsv(text)).toEqual([{ name: 'Alice', note: 'She said "hi" today' }]);
  });

  it('handles CRLF line endings', () => {
    const text = 'name,email\r\nAlice,a@x.com\r\nBob,b@x.com\r\n';
    expect(parseCsv(text)).toEqual([
      { name: 'Alice', email: 'a@x.com' },
      { name: 'Bob', email: 'b@x.com' },
    ]);
  });

  it('strips a leading UTF-8 BOM from the header row', () => {
    const text = '﻿name,email\nAlice,a@x.com';
    const rows = parseCsv(text);
    const [row] = rows;
    expect(row).toBeDefined();
    expect(Object.keys(row!)).toEqual(['name', 'email']);
    expect(row!.name).toBe('Alice');
  });

  it('preserves embedded newlines inside quoted fields', () => {
    const text = 'name,note\nAlice,"line one\nline two"';
    expect(parseCsvRows(text)[1]).toEqual(['Alice', 'line one\nline two']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
