import { describe, expect, it } from 'vitest';
import { escapeCsvField, parseCsv, parseCsvRows, toCsv } from './csv';

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

describe('toCsv / escapeCsvField (WB-135)', () => {
  it('leaves plain fields unquoted', () => {
    expect(escapeCsvField('Sarah Chen')).toBe('Sarah Chen');
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quotes fields containing a comma', () => {
    expect(escapeCsvField('Sep 19, 14:03:07')).toBe('"Sep 19, 14:03:07"');
  });

  it('quotes fields containing a double quote and doubles the inner quotes', () => {
    expect(escapeCsvField('Truck "Big Blue"')).toBe('"Truck ""Big Blue"""');
  });

  it('quotes fields containing CR or LF', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });

  it('round-trips through parseCsvRows with columns intact', () => {
    const rows = [
      ['timestamp', 'user', 'action', 'object', 'ip'],
      ['Sep 19, 14:03:07', 'Chen, Sarah', 'UPDATE', 'Truck "Big Blue"\nunit 12', '10.0.0.1'],
    ];
    const text = toCsv(rows);
    expect(text).toBe(
      'timestamp,user,action,object,ip\r\n"Sep 19, 14:03:07","Chen, Sarah",UPDATE,"Truck ""Big Blue""\nunit 12",10.0.0.1',
    );
    expect(parseCsvRows(text)).toEqual(rows);
  });
});

describe('escapeCsvField — formula injection (F3-06)', () => {
  it('prefixes a single quote to cells starting with = + - @ tab or CR', () => {
    expect(escapeCsvField('=HYPERLINK("http://evil.example","x")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"",""x"")"',
    );
    expect(escapeCsvField('+cmd|calc')).toBe("'+cmd|calc");
    expect(escapeCsvField('-2+3')).toBe("'-2+3");
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvField('\t=1')).toBe("'\t=1");
    expect(escapeCsvField('\r=1')).toBe('"\'\r=1"');
  });

  it('keeps negative numbers numeric and leaves other text alone', () => {
    expect(escapeCsvField(-12.5)).toBe('-12.5');
    expect(escapeCsvField('-12')).toBe('-12');
    expect(escapeCsvField('-0.75')).toBe('-0.75');
    expect(escapeCsvField('Sarah = admin')).toBe('Sarah = admin');
  });

  it('neutralises every cell of a toCsv export', () => {
    expect(toCsv([['driver'], ['=1+1'], ['@x']])).toBe("driver\r\n'=1+1\r\n'@x");
  });
});
