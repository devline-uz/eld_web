// owner: web-api-client — W-26 account extras that shipped in backend Phase 13I (2026-09-24):
// B-11 preferences, B-50 revoke-all, B-51 avatar + `jobTitle`. The pre-existing profile/sessions
// reads stay in `features/account/api.ts`; these hooks are the typed path for everything new.
// Every call here is personal (no permission key) — backend `me.controller.ts`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';

/* ------------------------------------------------------------------ B-51 profile + avatar */

/** `UpdateMyProfileDto` — name/phone/jobTitle only; the role is never self-editable. */
export interface UpdateMyProfilePayload {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  phone?: string;
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateMyProfilePayload) => client.patch<Record<string, unknown>>(endpoints.me.profile, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.profile });
      void queryClient.invalidateQueries({ queryKey: qk.me });
    },
  });
}

/** Server-side validation: PNG/JPG, at least 256×256 (422 otherwise). The multipart field is `file`. */
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return client.upload<{ id: string; avatarUrl: string }>(endpoints.me.avatar, form);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.me });
    },
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.delete<{ id: string; avatarUrl: null }>(endpoints.me.avatar),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qkRoot.me });
    },
  });
}

/* ------------------------------------------------------------------ B-50 sessions */

/** `DELETE /me/sessions` — signs out every OTHER session in one call (the current one survives). */
export function useSignOutOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => client.delete<{ revoked: number }>(endpoints.me.sessions),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.sessions }),
  });
}

/* ------------------------------------------------------------------ B-11 preferences */

/** `PreferencesDto`. `savedViews` / `tableColumns` are opaque per-screen JSON owned by the UI. */
export interface MyPreferences {
  language?: string;
  /** Display preference only — HOS screens still use the driver's home terminal zone (§8.3). */
  timezone?: string;
  dateFormat?: string;
  distanceUnit?: 'MILES' | 'KM';
  savedViews?: Record<string, unknown>;
  tableColumns?: Record<string, unknown>;
}

export function useMyPreferences(enabled = true) {
  return useQuery({
    queryKey: qk.preferences,
    queryFn: ({ signal }) => client.get<MyPreferences>(endpoints.me.preferences, { signal }),
    enabled,
    ...typedCachePolicy<MyPreferences>('reference'),
  });
}

/** `PUT` is a full replace: send the merged object, not a patch. */
export function useUpdateMyPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: MyPreferences) => client.put<MyPreferences>(endpoints.me.preferences, prefs),
    onSuccess: (_data, sent) => queryClient.setQueryData(qk.preferences, sent),
  });
}
