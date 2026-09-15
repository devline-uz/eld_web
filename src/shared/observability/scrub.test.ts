import {
  FILTERED,
  isAuthUrl,
  isSensitiveKey,
  scrubBreadcrumb,
  scrubEvent,
  scrubString,
  scrubValue,
} from './scrub';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMSIsImVtYWlsIjoibWlrZSJ9.c2lnbmF0dXJlLXZhbHVl';
const API = 'https://eldapi.stackyard.uz/api';

describe('isSensitiveKey', () => {
  it.each([
    'accessToken',
    'refresh_token',
    'idToken',
    'Authorization',
    'cookie',
    'Set-Cookie',
    'password',
    'driverPin',
    'x-api-key',
    'APIKey',
    'AWSSecretKey',
    'email',
    'driverPhone',
    'cdlNumber',
    'licenseNumber',
    'vin',
    'lat',
    'lon',
    'lng',
    'latitude',
    'longitude',
    'coordinates',
    'X-Amz-Signature',
    'sessionId',
  ])('%s is sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(['id', 'unitNumber', 'status', 'code', 'shipping', 'mapping', 'spinner', 'traceId', 'url'])(
    '%s is not sensitive',
    (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    },
  );
});

describe('isAuthUrl', () => {
  it('matches backend auth endpoints and Firebase identity hosts', () => {
    expect(isAuthUrl(`${API}/auth/login`)).toBe(true);
    expect(isAuthUrl(`${API}/auth/google`)).toBe(true);
    expect(isAuthUrl(`${API}/auth?x=1`)).toBe(true);
    expect(isAuthUrl(`${API}/auth`)).toBe(true);
    expect(isAuthUrl('https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp')).toBe(true);
    expect(isAuthUrl('https://securetoken.googleapis.com/v1/token')).toBe(true);
  });
  it('does not match other URLs or non-strings', () => {
    expect(isAuthUrl(`${API}/vehicles`)).toBe(false);
    expect(isAuthUrl(`${API}/authors`)).toBe(false);
    expect(isAuthUrl(undefined)).toBe(false);
    expect(isAuthUrl(42)).toBe(false);
  });
});

describe('scrubString', () => {
  it('removes JWTs and bearer/basic credentials', () => {
    expect(scrubString(`token was ${JWT}`)).toBe(`token was ${FILTERED}`);
    expect(scrubString('Authorization: Bearer abc.def-123')).toBe(`Authorization: Bearer ${FILTERED}`);
    expect(scrubString('Basic dXNlcjpwYXNz==')).toBe(`Basic ${FILTERED}`);
    expect(scrubString('bearer abcdef123')).toBe(`bearer ${FILTERED}`);
    expect(scrubString('Bearer ok, token was refreshed')).toBe('Bearer ok, token was refreshed');
  });

  it('removes query-string secrets but keeps harmless params', () => {
    expect(scrubString(`${API}/vehicles?page=2&access_token=abc&limit=50`)).toBe(
      `${API}/vehicles?page=2&access_token=${FILTERED}&limit=50`,
    );
    expect(scrubString('/sign-in#id_token=xyz&state=s1')).toBe(
      `/sign-in#id_token=${FILTERED}&state=${FILTERED}`,
    );
    expect(scrubString('https://api.maptiler.com/tiles/1/2/3.pbf?key=MAPKEY')).toBe(
      `https://api.maptiler.com/tiles/1/2/3.pbf?key=${FILTERED}`,
    );
    expect(scrubString('refreshToken=r1;path=/')).toBe(`refreshToken=${FILTERED};path=/`);
    expect(scrubString(`${API}/drivers?q=smith&sort=name:asc`)).toBe(`${API}/drivers?q=smith&sort=name:asc`);
  });

  it('drops the whole query of a presigned URL', () => {
    const url =
      'http://127.0.0.1:19000/onebook-prod/dvir/p1.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AK%2F20260913&X-Amz-Date=20260913T000000Z&X-Amz-Signature=deadbeef';
    expect(scrubString(`GET ${url} 200`)).toBe(
      `GET http://127.0.0.1:19000/onebook-prod/dvir/p1.jpg?${FILTERED} 200`,
    );
  });

  it('masks emails', () => {
    expect(scrubString('USER_NOT_INVITED for mike.torres@universal-logistics.example')).toBe(
      'USER_NOT_INVITED for [email]',
    );
  });

  it('masks coordinate pairs', () => {
    expect(scrubString('LngLat(-87.623177, 41.881832)')).toBe('LngLat([coords])');
    expect(scrubString('at 39.9612,-82.9988 now')).toBe('at [coords] now');
  });

  it('masks phone numbers in E.164 and US formats, not dates or ids', () => {
    expect(scrubString('call +13125550100')).toBe('call [phone]');
    expect(scrubString('call (312) 555-0100')).toBe('call [phone]');
    expect(scrubString('call 312-555-0100 or 312.555.0100')).toBe('call [phone] or [phone]');
    expect(scrubString('call +1 614 555 0142')).toBe('call [phone]');
    expect(scrubString('on 2026-09-13 at 1726200000000')).toBe('on 2026-09-13 at 1726200000000');
  });

  it('masks VINs but not 17-char all-letter or all-digit tokens', () => {
    expect(scrubString('vehicle 1FUJGLDR5CLBP8834 offline')).toBe('vehicle [vin] offline');
    expect(scrubString('ABCDEFGHJKLMNPRST')).toBe('ABCDEFGHJKLMNPRST');
    expect(scrubString('12345678901234567')).toBe('12345678901234567');
  });

  it('masks CDL / licence numbers written in text, not plain words after "license"', () => {
    expect(scrubString('CDL #: D1234-5678 expired')).toBe(`CDL #: ${FILTERED} expired`);
    expect(scrubString('licence number S530-4417')).toBe(`licence number ${FILTERED}`);
    expect(scrubString('license expired today')).toBe('license expired today');
  });

  it('leaves ordinary text alone', () => {
    expect(scrubString('Could not load the fleet (503)')).toBe('Could not load the fleet (503)');
  });
});

describe('scrubValue', () => {
  it('passes primitives through and scrubs strings', () => {
    expect(scrubValue(3)).toBe(3);
    expect(scrubValue(null)).toBeNull();
    expect(scrubValue(undefined)).toBeUndefined();
    expect(scrubValue(true)).toBe(true);
    expect(scrubValue('a@b.io')).toBe('[email]');
  });

  it('replaces values under sensitive keys whatever their type, recursively, without mutating', () => {
    const input = {
      driver: { name: 'John', cdlNumber: 'S530', position: { lat: 41.8, lon: -87.6 } },
      list: [{ vin: '1FUJGLDR5CLBP8834' }, 'x@y.dev'],
      lat: 41.88,
    };
    const out = scrubValue(input);
    expect(out).toEqual({
      driver: { name: 'John', cdlNumber: FILTERED, position: FILTERED },
      list: [{ vin: FILTERED }, '[email]'],
      lat: FILTERED,
    });
    expect(input.driver.cdlNumber).toBe('S530');
  });

  it('cuts cycles and over-deep trees', () => {
    const cyclic: Record<string, unknown> = { name: 'a' };
    cyclic.self = cyclic;
    expect(scrubValue(cyclic)).toEqual({ name: 'a', self: '[Circular]' });

    let deep: Record<string, unknown> = { leaf: 1 };
    for (let i = 0; i < 20; i += 1) deep = { next: deep };
    const walk = (v: unknown, n: number): unknown =>
      n === 0 ? v : walk((v as Record<string, unknown>).next, n - 1);
    expect(walk(scrubValue(deep), 12)).toBe('[Truncated]');
  });
});

describe('scrubBreadcrumb', () => {
  it('keeps only method/url/status on auth fetch breadcrumbs', () => {
    const crumb = scrubBreadcrumb({
      category: 'fetch',
      message: 'POST login',
      data: { method: 'POST', url: `${API}/auth/login`, status_code: 200, request_body_size: 80, body: '{"password":"x"}' },
    });
    expect(crumb).toEqual({
      category: 'fetch',
      message: 'POST login',
      data: { method: 'POST', url: `${API}/auth/login`, status_code: 200 },
    });
  });

  it('strips presigned breadcrumbs down to method/url/status with the query gone', () => {
    const crumb = scrubBreadcrumb({
      category: 'xhr',
      data: { method: 'GET', url: '/bucket/a.pdf?X-Amz-Signature=s', response_body_size: 10 },
    });
    expect(crumb.data).toEqual({ method: 'GET', url: `/bucket/a.pdf?${FILTERED}` });
  });

  it('scrubs ordinary breadcrumb data and message; tolerates missing data', () => {
    const crumb = scrubBreadcrumb({
      category: 'console',
      message: `refresh with ${JWT}`,
      data: { arguments: ['user a@b.io', { accessToken: 't' }], url: `${API}/vehicles?token=t` },
    });
    expect(crumb).toEqual({
      category: 'console',
      message: `refresh with ${FILTERED}`,
      data: { arguments: ['user [email]', { accessToken: FILTERED }], url: `${API}/vehicles?token=${FILTERED}` },
    });
    expect(scrubBreadcrumb({ category: 'navigation', message: '/live-fleet' })).toEqual({
      category: 'navigation',
      message: '/live-fleet',
    });
  });
});

describe('scrubEvent', () => {
  it('scrubs request headers, cookies, query string and auth bodies', () => {
    const event = scrubEvent({
      message: 'boom for diane.foster@universal-logistics.example',
      request: {
        url: `${API}/auth/login?email=diane.foster@universal-logistics.example`,
        headers: { Authorization: `Bearer ${JWT}`, 'User-Agent': 'Chrome', Cookie: 'obk=1' },
        cookies: { obk: '1' },
        query_string: 'email=diane%40x.io&page=1',
        data: { email: 'diane.foster@universal-logistics.example', password: 'Onebook2026' },
      },
    });
    expect(event).toEqual({
      message: 'boom for [email]',
      request: {
        url: `${API}/auth/login?email=${FILTERED}`,
        headers: { Authorization: FILTERED, 'User-Agent': 'Chrome', Cookie: FILTERED },
        query_string: `email=${FILTERED}&page=1`,
        data: FILTERED,
      },
    });
  });

  it('scrubs non-auth request bodies field by field and handles bodiless requests', () => {
    const withBody = scrubEvent({
      request: { url: `${API}/drivers`, data: { firstName: 'John', phone: '+13125550100', cdlNumber: 'D1' } },
    });
    expect(withBody.request).toEqual({
      url: `${API}/drivers`,
      data: { firstName: 'John', phone: FILTERED, cdlNumber: FILTERED },
    });
    expect(scrubEvent({ request: { url: `${API}/vehicles` } }).request).toEqual({ url: `${API}/vehicles` });
  });

  it('keeps only user.id', () => {
    expect(scrubEvent({ user: { id: 'usr_1', email: 'a@b.io', ip_address: '1.2.3.4' } as { id: string } }).user).toEqual({
      id: 'usr_1',
    });
    expect(scrubEvent({ user: { email: 'a@b.io' } as { id?: string } }).user).toEqual({});
  });

  it('scrubs exception values, extra, contexts and every breadcrumb', () => {
    const event = scrubEvent({
      exception: { values: [{ type: 'Error', value: 'unit 1FUJGLDR5CLBP8834 at 41.881832, -87.623177' }] },
      extra: { componentStack: 'in DriverRow', refreshToken: 'r' },
      breadcrumbs: [
        { category: 'fetch', data: { method: 'POST', url: `${API}/auth/refresh`, request_body_size: 40 } },
        { category: 'ui.click', message: 'button[aria-label="Call +13125550100"]' },
      ],
    });
    expect(event).toEqual({
      exception: { values: [{ type: 'Error', value: 'unit [vin] at [coords]' }] },
      extra: { componentStack: 'in DriverRow', refreshToken: FILTERED },
      breadcrumbs: [
        { category: 'fetch', data: { method: 'POST', url: `${API}/auth/refresh` } },
        { category: 'ui.click', message: 'button[aria-label="Call [phone]"]' },
      ],
    });
  });
});
