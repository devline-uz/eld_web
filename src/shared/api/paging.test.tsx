// QA FE-014 — `usePagedQuery().items` must be the same array across re-renders when nothing
// changed, or every consumer's memo/effect keyed on it re-runs on each parent render.
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePagedQuery, type PageQueryOptions } from './paging';

type Row = { id: number };
const ROWS: Row[] = Array.from({ length: 30 }, (_, id) => ({ id }));
const page = (items: Row[]) => ({ items, page: 1, limit: 10, total: items.length, totalPages: 3 });
const options = (key: string, items: Row[]) =>
  ({ queryKey: [key], queryFn: async () => page(items) }) as unknown as PageQueryOptions<Row>;
const keepAll = (rows: Row[]) => rows;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('usePagedQuery (FE-014)', () => {
  it.each([false, true])('returns a stable items array across re-renders (useWindow: %s)', async (useWindow) => {
    const { result, rerender } = renderHook(
      () =>
        usePagedQuery<Row>({
          server: options('server', ROWS.slice(0, 10)),
          window: options('window', ROWS),
          useWindow,
          page: 1,
          limit: 10,
          filter: keepAll,
        }),
      { wrapper },
    );
    const empty = result.current.items;
    rerender();
    expect(result.current.items).toBe(empty);
    await waitFor(() => expect(result.current.items).toHaveLength(10));
    const loaded = result.current.items;
    rerender();
    expect(result.current.items).toBe(loaded);
  });
});
