// owner: web-qa-a11y — builds an `AuthContextValue` for a demo role, used to mock
// `@/shared/auth/AuthProvider` in RBAC / permission-gated component tests. See
// tests/README.md "Testing an authenticated screen" for the vi.mock pattern — module mocks
// are file-scoped in Vitest, so this factory is called from inside each test file's own
// `vi.mock('@/shared/auth/AuthProvider', ...)`, never from a shared setup file.
import type { AuthContextValue, AuthUser } from '@/shared/auth/AuthProvider';
import type { Role } from '@/shared/auth/permissions';
import { ROLE_PERMISSIONS, DEMO_ACCOUNTS } from './rolePermissions';

const DISPLAY_NAME: Record<Role, string> = {
  ADMIN: 'Sarah Chen',
  FLEET_MANAGER: 'Mike Torres',
  DISPATCHER: 'Carlos Ramirez',
  VIEWER: 'Diane Foster',
};

export function buildMockUser(role: Role, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: `usr_${role.toLowerCase()}`,
    fullName: DISPLAY_NAME[role],
    email: DEMO_ACCOUNTS[role].email,
    role,
    avatarUrl: null,
    carrierName: 'Universal Logistics Inc.',
    homeTerminalTimezone: 'America/New_York',
    ...overrides,
  };
}

export function buildMockAuthContext(
  role: Role,
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    status: 'authenticated',
    isAuthenticated: true,
    user: buildMockUser(role),
    permissions: ROLE_PERMISSIONS[role],
    signOut: () => undefined,
    signInWithPassword: async () => ({ status: 'authenticated' }),
    signInWithGoogleToken: async () => ({ status: 'authenticated' }),
    ...overrides,
  };
}
