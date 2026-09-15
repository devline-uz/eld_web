// Provider composition — web/tz.md §2.2, §6.4.
// Order is load-bearing: Theme → Query → Auth (needs the query client) → Toast (RealtimeProvider
// calls useToast() for the offline/reconnect banners, so it must be nested *inside* Toast, not
// the other way around — see web/bugs.md WB-0xx) → Realtime.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { defaultQueryClientOptions } from '@/shared/api/cache';
import { AuthProvider } from '@/shared/auth/AuthProvider';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';
import { ToastProvider } from '@/shared/ui';

/**
 * §6.4 defaults live in `shared/api/cache.ts` next to the policy table, so a screen can declare
 * `...cachePolicy('live')` instead of repeating magic numbers. Retries belong to `client.ts`
 * (GET twice, 1 s then 3 s — §6.2 rule 7); TanStack must not multiply them.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: defaultQueryClientOptions });
}

/** v1 is light-only; `Appearance` in the account menu is disabled (11.26). */
function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <RealtimeProvider>{children}</RealtimeProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
