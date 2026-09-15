// owner: web-dashboard-fleet — a thin typing bridge over `cachePolicy()` (shared/api/cache.ts).
// `cachePolicy()` is written against an untyped `unknown` query so one function serves every
// screen; spreading its return value straight into a fully-typed `useQuery<TData>()` call trips
// TS2769 on `refetchInterval`'s `Query<TData>` parameter (contravariance through TanStack's
// internal `persister` type). Narrowing the return type here — once — is the fix; the runtime
// value is unchanged, only the compile-time shape is asserted back to the caller's `TData`.
import type { UseQueryOptions } from '@tanstack/react-query';
import { cachePolicy, type CachePolicyName } from './cache';

export function typedCachePolicy<TData>(name: CachePolicyName): Partial<UseQueryOptions<TData, Error>> {
  return cachePolicy(name) as Partial<UseQueryOptions<TData, Error>>;
}
