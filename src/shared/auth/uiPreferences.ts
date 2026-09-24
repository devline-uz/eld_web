// owner: web-auth-rbac — per-user UI preferences for any screen: table column layouts (11.24
// Table settings) and saved views. Source of truth is `GET/PUT /me/preferences` (B-11, shipped),
// buckets `tableColumns[screen]` and `savedViews[screen]` (arrays, `PreferencesDto`).
//
// Fallback: every write is mirrored to `localStorage['obk.pref.<userId>.<bucket>.<screen>']`, and
// that copy is read whenever the server row is not available (still loading, request failed) or
// has no entry for the screen yet — so a layout chosen before B-11 or while offline still shows.
// It lives in `shared/auth` because it is keyed by the signed-in user and this is the one module
// allowed to write localStorage (eslint `no-restricted-properties`, web/decisions.md WD-092).
//
// `PUT` is a full replace. Writes are therefore serialised through one promise chain and each one
// merges into the freshest cached row; no `PUT` is sent while the row itself failed to load, since
// sending a partial object would wipe the user's other preferences.
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useMyPreferences, useUpdateMyPreferences, type MyPreferences } from '@/shared/api/me';
import { qk } from '@/shared/api/queryKeys';
import { useAuth } from './AuthProvider';

export type PreferenceBucket = 'savedViews' | 'tableColumns';

export function preferenceStorageKey(userId: string, bucket: PreferenceBucket, screen: string): string {
  return `obk.pref.${userId}.${bucket}.${screen}`;
}

function readLocal<T>(key: string | null): T[] | null {
  if (!key) return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string | null, value: unknown[] | null): void {
  if (!key) return;
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    // Private mode / quota — the server copy is still written.
  }
}

/** Server entry for `screen`, when the row is loaded and holds an array for it. */
function serverEntry<T>(prefs: MyPreferences | undefined, bucket: PreferenceBucket, screen: string): T[] | null {
  const entry = prefs?.[bucket]?.[screen];
  return Array.isArray(entry) ? (entry as T[]) : null;
}

/** Pure merge used by every write: `null` removes the screen's entry. */
export function mergePreference(
  prefs: MyPreferences,
  bucket: PreferenceBucket,
  screen: string,
  value: unknown[] | null,
): MyPreferences {
  const next: Record<string, unknown> = { ...(prefs[bucket] ?? {}) };
  if (value) next[screen] = value;
  else delete next[screen];
  return { ...prefs, [bucket]: next };
}

let writeChain: Promise<unknown> = Promise.resolve();

export interface UiPreference<T> {
  value: T[];
  /** Saves locally at once, then to the server; resolves when the server write settled. */
  setValue: (next: T[]) => Promise<void>;
  /** Drops the screen's entry everywhere, so `fallback` shows again. */
  reset: () => Promise<void>;
  /** The last server write failed — the choice is kept in this browser only. */
  syncFailed: boolean;
}

export function useUiPreference<T>(
  bucket: PreferenceBucket,
  screen: string,
  fallback: readonly T[],
): UiPreference<T> {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const prefs = useMyPreferences(isAuthenticated);
  const update = useUpdateMyPreferences();
  const key = user ? preferenceStorageKey(user.id, bucket, screen) : null;
  const [local, setLocal] = useState<{ key: string | null; value: T[] | null }>(() => ({
    key,
    value: readLocal<T>(key),
  }));
  const [syncFailed, setSyncFailed] = useState(false);
  // A user switch (sign-out → sign-in as someone else) re-reads that user's own copy.
  const localValue = local.key === key ? local.value : readLocal<T>(key);

  const save = useCallback(
    (next: T[] | null) => {
      setLocal({ key, value: next });
      writeLocal(key, next);
      const run = writeChain.then(async () => {
        const current = queryClient.getQueryData<MyPreferences>(qk.preferences);
        if (!current) return; // row never loaded — a full replace would wipe it
        const merged = mergePreference(current, bucket, screen, next);
        queryClient.setQueryData(qk.preferences, merged);
        try {
          await update.mutateAsync(merged);
          setSyncFailed(false);
        } catch {
          setSyncFailed(true);
        }
      });
      writeChain = run.catch(() => undefined);
      return run;
    },
    [key, bucket, screen, queryClient, update],
  );

  return {
    value: serverEntry<T>(prefs.data, bucket, screen) ?? localValue ?? [...fallback],
    setValue: save,
    reset: () => save(null),
    syncFailed,
  };
}
