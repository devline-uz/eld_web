// owner: web-qa-a11y — the one render helper every screen/component test builds on
// (web/tz.md §18: Testing Library + jsdom). Wraps a component in the same provider stack as
// the real app: QueryClient → Auth → Router.
//
// Role fixture: to render as a specific role, mock `@/shared/auth/AuthProvider` in the
// *calling test file* (module mocks are file-scoped in Vitest, so this cannot be done inside
// a shared helper) using `buildMockAuthContext` from `tests/fixtures/mockAuth.ts`:
//
//   vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => ({
//     ...(await importOriginal<typeof import('@/shared/auth/AuthProvider')>()),
//     useAuth: () => buildMockAuthContext('DISPATCHER'),
//   }));
//
// See tests/README.md for the full pattern. Until AuthProvider is wired to a real /auth/me
// call (web-auth-rbac, in flight), rendering without that mock yields the unauthenticated
// placeholder context.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/shared/auth/AuthProvider';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Defaults to `/`. Use for deep-linkable screens (`/hos-logs?driverId=&date=`, …). */
  route?: string;
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient, ...options }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const client = queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient: client };
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
