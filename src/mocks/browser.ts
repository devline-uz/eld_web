// The MSW browser worker — `npm run dev:mock` serves every request from the same handlers the
// tests use, so the panel runs with no backend. Loaded only behind `VITE_API_MOCK === 'true'`.
//
// The generated `GET /auth/me` fixture carries `permissions: {}`, which locks every screen. The
// browser worker alone overrides sign-in and `/auth/me` so each §6.7 demo account gets its real
// role matrix; the node server the tests use keeps the plain fixtures.
import { http } from 'msw';
import { setupWorker } from 'msw/browser';
import { endpoints } from '@/shared/api/endpoints';
import { ROLE_PERMISSIONS, type Role } from '@/shared/auth/permissions';
import { fail, ok, url } from './envelope';
import { fixture } from './fixtures.generated';
import { handlers } from './handlers';

interface DemoUser {
  role: Role;
  firstName: string;
  lastName: string;
}

const ADMIN_EMAIL = 'sarah.chen@universal-logistics.example';
const ADMIN_USER: DemoUser = { role: 'ADMIN', firstName: 'Sarah', lastName: 'Chen' };

const DEMO_USERS: Record<string, DemoUser> = {
  'sarah.chen@universal-logistics.example': { role: 'ADMIN', firstName: 'Sarah', lastName: 'Chen' },
  'mike.torres@universal-logistics.example': { role: 'FLEET_MANAGER', firstName: 'Mike', lastName: 'Torres' },
  'carlos.ramirez@universal-logistics.example': { role: 'DISPATCHER', firstName: 'Carlos', lastName: 'Ramirez' },
  'diane.foster@universal-logistics.example': { role: 'VIEWER', firstName: 'Diane', lastName: 'Foster' },
};

/** Survives a reload, so the boot-time `/auth/me` still knows who signed in. */
const EMAIL_KEY = 'onebook.mock.email';

function readEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeEmail(email: string): void {
  try {
    // eslint-disable-next-line no-restricted-properties -- dev:mock only; never in a real build
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    // Storage blocked — `/auth/me` falls back to the admin account.
  }
}

const mockSessionHandlers = [
  http.post(url(endpoints.auth.signIn), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
    if (body.password === 'wrong') {
      return fail(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
    }
    writeEmail((body.email ?? '').trim().toLowerCase());
    return ok(fixture('POST /api/auth/login'));
  }),

  http.get(url(endpoints.auth.me), ({ request }) => {
    if (!request.headers.get('authorization')) {
      return fail(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    const email = readEmail();
    // Google sign-in or an unknown email lands on the admin account.
    const known = DEMO_USERS[email];
    const user = known ?? ADMIN_USER;
    return ok({
      ...(fixture('GET /api/auth/me') as Record<string, unknown>),
      email: known ? email : ADMIN_EMAIL,
      firstName: user.firstName,
      lastName: user.lastName,
      carrierName: 'Universal Logistics',
      role: user.role,
      permissions: ROLE_PERMISSIONS[user.role],
    });
  }),
];

/** The shared B-6 fixture is a single row; the dashboard table needs enough rows to page through. */
const VIOLATION_EVENTS = [
  { severity: 'VIOLATION', type: 'DRIVING_11', event: '11-hour driving limit exceeded' },
  { severity: 'VIOLATION', type: 'SHIFT_14', event: '14-hour on-duty window exceeded' },
  { severity: 'WARNING', type: 'BREAK_30', event: '30-minute break due in 20 min' },
  { severity: 'WARNING', type: 'CYCLE_70', event: '70-hour cycle — 2h remaining' },
] as const;
const DRIVER_NAMES = ['John Smith', 'William Bond', 'Maria Lopez', 'Kevin Brown', 'Aisha Khan', null];

const mockViolations = Array.from({ length: 37 }, (_, i) => {
  const kind = VIOLATION_EVENTS[i % VIOLATION_EVENTS.length]!;
  const driverName = DRIVER_NAMES[i % DRIVER_NAMES.length] ?? null;
  const occurredAt = new Date(Date.now() - (i + 1) * 35 * 60_000).toISOString();
  return {
    id: `vio_mock_${i + 1}`,
    driverId: driverName ? `drv_${(i % 5) + 1}` : null,
    type: kind.type,
    status: 'OPEN',
    severity: kind.severity,
    driverName,
    vehicleId: `veh_${(i % 8) + 1}`,
    unitNumber: String(101 + (i % 8)),
    event: driverName ? kind.event : 'Unassigned driving · 1h 12m',
    locationLabel: i % 3 === 0 ? null : `${(i % 9) + 1}.2 mi W of Harrisburg, OH`,
    occurredAt,
    date: occurredAt.slice(0, 10),
  };
});

const mockViolationHandlers = [
  http.get(url(endpoints.violations.list), ({ request }) => {
    const search = new URL(request.url).searchParams;
    const limit = Math.min(200, Math.max(1, Number(search.get('limit') ?? '25')));
    const total = mockViolations.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(totalPages, Math.max(1, Number(search.get('page') ?? '1')));
    return ok({
      items: mockViolations.slice((page - 1) * limit, page * limit),
      total,
      page,
      limit,
      totalPages,
    });
  }),
];

// MSW is first-match-wins: the overrides go ahead of the shared handler set.
export const worker = setupWorker(...mockSessionHandlers, ...mockViolationHandlers, ...handlers);
