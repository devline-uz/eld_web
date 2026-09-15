// owner: web-auth-rbac — W-26 data layer: `/me/profile`, `/me/sessions`.
//
// Real endpoints (backend/src/modules/users/me.controller.ts):
//   GET/PATCH /me/profile · GET /me/sessions · DELETE /me/sessions/:id
// Gaps (web/backend-gaps.md): B-50 sessions have no `current`/location and leak `refreshHash`;
// B-51 profile has no avatar upload, no `jobTitle` on PATCH.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/queryKeys';
import { typedCachePolicy } from '@/shared/api/queryPolicy';

/** The live `GET /me/profile` row (UsersService.toView — secrets stripped server-side). */
export interface MyProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  phone: string | null;
  authProvider: 'PASSWORD' | 'GOOGLE';
  googleUid: string | null;
  role: { key: string; name: string };
  /** ⛔ GAP B-51 — not returned today; rendered only when present. */
  avatarUrl?: string | null;
}

/** The live `GET /me/sessions` row. `current` and `location` are GAP B-50 (optional). */
export interface MySession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  deviceLabel: string | null;
  lastSeenAt: string;
  expiresAt: string;
  current?: boolean;
  location?: string | null;
}

export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
  phone?: string;
}

export function useMyProfile() {
  return useQuery({
    queryKey: qk.profile,
    // TanStack's `signal` is not forwarded — jsdom's AbortSignal breaks Node fetch (WD-046).
    queryFn: () => client.get<MyProfile>(endpoints.me.profile),
    ...typedCachePolicy<MyProfile>('reference'),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      client.patch<MyProfile>(endpoints.me.profile, input),
    onSuccess: (profile) => {
      queryClient.setQueryData(qk.profile, profile);
    },
  });
}

/** Only the fields the UI reads — the raw row also carries `refreshHash` (B-50), dropped here. */
function toSession(row: MySession): MySession {
  return {
    id: row.id,
    userAgent: row.userAgent ?? null,
    ip: row.ip ?? null,
    deviceLabel: row.deviceLabel ?? null,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
    current: row.current,
    location: row.location ?? null,
  };
}

export function useMySessions() {
  return useQuery({
    queryKey: qk.sessions,
    queryFn: async () => (await client.get<MySession[]>(endpoints.me.sessions)).map(toSession),
    ...typedCachePolicy<MySession[]>('list'),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.delete<{ success: boolean }>(endpoints.me.session(id)),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<MySession[]>(qk.sessions, (rows) =>
        rows?.filter((row) => row.id !== id),
      );
    },
  });
}

/**
 * `Sign out everywhere` — there is no revoke-all endpoint (B-50), so every listed session is
 * revoked one by one with the real `DELETE /me/sessions/:id`. Sequential on purpose: a partial
 * failure stops at the first error and the list is refetched so it shows the truth.
 */
export function useRevokeAllSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await client.delete(endpoints.me.session(id));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.sessions }),
  });
}
