# Testing the web panel

One page. See `web/tz.md` §18 for the full spec this implements.

## Running each level

| Command | Runs | Config |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit` over `src` **and** `tests` | `tsconfig.json` |
| `npm run lint` | ESLint, 0 warnings allowed | `eslint.config.js` |
| `npm run test:unit` | Vitest — unit, component, RBAC (jsdom) + coverage gate | `vitest.config.ts` |
| `npm run test:contract` | Vitest — MSW responses vs `openapi.json` (node env) | `vitest.contract.config.ts` |
| `npm run build` | `tsc` + `vite build` + bundle-budget check | `vite.config.ts`, `scripts/check-bundle-budget.mjs` |
| `npx playwright test` | The 16 E2E scenarios + visual pass | `playwright.config.ts` |

Playwright needs the dev API up on `:3002` (seeded dev DB) and will start the Vite dev server
on `:5173` itself (`reuseExistingServer: true` — safe to also run `npm run dev` yourself first).
Point it at a different target with `E2E_BASE_URL`.

`POST /auth/login` is rate-limited to 5 requests/60s per IP by the backend (`web/bugs.md`
WB-006). Only `01-dev-sign-in.spec.ts` calls it — that is scenario 1, the one spec whose job is
to exercise the real login UI, and it runs `serial` so its 4 logins can't race across workers.
Every other spec that needs to be signed in (`05-sidebar-by-role.spec.ts`) loads the storage
state `signInAndPersist()` writes to `tests/e2e/.auth/<role>.json` after each of those logins,
via `test.use({ storageState })`, instead of logging in again. `playwright.config.ts` declares
two projects — `e2e-sign-in` (just that one file) and `e2e` (everything else) with
`dependencies: ['e2e-sign-in']` — so the write always happens before the read regardless of
worker count. A full `npx playwright test` run makes exactly 4 `POST /auth/login` calls, well
under the limit; don't add a fifth by looping diagnostic curls against the same API while it's
running, and don't call `signInAsDev` from a second spec file.

Sign-in is a single step for every role (`web/decisions.md`
WD-067): every demo role, ADMIN included, signs in with the password form alone.

## What each gate means

- **Coverage** (`vitest.config.ts` → `test.coverage`): `shared/format/**` and
  `shared/auth/permissions.ts` must be **100%** (statements/branches/functions/lines) the
  moment either is exercised by any test; everything else must clear **80%** in aggregate.
  `coverage.all` is intentionally `false`: only files reached by at least one test are
  measured, so a `features/*` screen nobody has started yet cannot fail the build — the day a
  test imports it, it counts. This is documented as `WD-001` (see `web/decisions.md`) so it
  isn't mistaken for the gate being soft; per-glob thresholds still fail hard once a covered
  file dips under its bar.
- **RBAC fixture** (`tests/fixtures/rbacScreens.ts`, `tests/fixtures/rolePermissions.ts`): the
  single source of truth for "4 roles × 26 screens" — every feature agent's RBAC test asserts
  against `RBAC_SCREENS`/`ROLE_PERMISSIONS`, not against its own reading of §12.1. It was built
  from the actual file counts under `web/roles and screens/` (26/21/14/16), which outranks a
  literal reading of the §12.1 prose table — two design-vs-backend gaps that surfaced doing
  that cross-check are logged in `web/bugs.md`.
- **A11y** (`tests/setup/axe.ts` for Vitest, `tests/e2e/support/axe.ts` for Playwright): both
  wrap axe-core with the same rule set and the same gate — 0 `critical`, 0 `serious`. jsdom
  can't compute real contrast, so `color-contrast` is off in the Vitest wrapper only; the
  Playwright wrapper runs it for real.
- **E2E** (`tests/e2e/*.spec.ts`): scenarios 1, 3 and 5 from §18.1 are implemented and green.
  Scenarios 2, 4, 6–16 are `test.fixme` skeletons carrying the scenario text and the exact
  blocking reason (which feature/phase unblocks them) — every scenario is visible in the test
  list so none of them can be silently forgotten; nobody should delete a `fixme` without
  making it pass.
- **Bundle budget** (`scripts/check-bundle-budget.mjs`, run by `npm run build`): entry ≤ 220 KB
  gzip, any route chunk ≤ 90 KB, MapLibre ≤ 250 KB, Recharts ≤ 120 KB, total ≤ 1.2 MB. Fails the
  build, not a warning.

## Testing an authenticated screen

`tests/setup/render.tsx` wraps a component the same way the app does: `QueryClientProvider` →
`AuthProvider` → `MemoryRouter`. Vitest module mocks are **file-scoped**, so a role fixture
cannot live inside a shared helper — mock `@/shared/auth/AuthProvider` at the top of your own
test file and build the value from `tests/fixtures/mockAuth.ts`:

```ts
import { vi } from 'vitest';
import { buildMockAuthContext } from '../../tests/fixtures/mockAuth';

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/auth/AuthProvider')>()),
  useAuth: () => buildMockAuthContext('DISPATCHER'),
}));

// then, further down the same file:
import { renderWithProviders } from '../../tests/setup/render';
import { DriversPage } from './DriversPage';

test('dispatcher sees no + Add driver button', () => {
  const { queryByRole } = renderWithProviders(<DriversPage />, { route: '/drivers' });
  expect(queryByRole('button', { name: '+ Add driver' })).not.toBeInTheDocument();
});
```

For a11y, call `expectNoBlockingA11yViolations(container)` from `tests/setup/axe.ts` on the
rendered container of any screen/component test.

## Ownership

| Suite | Owner |
|---|---|
| `vitest.config.ts`, `vitest.contract.config.ts`, `playwright.config.ts`, coverage thresholds | `web-qa-a11y` (this file's author) |
| `tests/setup/**`, `tests/fixtures/**`, `tests/rbac/**`, `tests/e2e/**` | `web-qa-a11y` |
| `tests/contract/**`, MSW handlers under `src/mocks/**` | `web-api-client` |
| Per-screen unit/component/RBAC tests inside `src/features/**` | the feature agent that owns that screen |
| `src/shared/format/**` @ 100%, `src/shared/ui/**` component tests | `web-api-client`, `web-design-system` respectively |
| `src/shared/auth/permissions.ts` @ 100%, `AuthProvider` tests | `web-auth-rbac` |

Everyone runs `npm run test:unit` / `test:contract` / `npx playwright test` before calling a
screen done — the ⬜ acceptance list in the screen's own `web/tz.md` §10 entry is the verdict,
not a green terminal by itself.
