// owner: web-realtime — the throttle glued to `setQueryData`, never `invalidateQueries`.
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useThrottledPatch } from './useThrottledPatch';

const KEY = ['vehicles', 'v1', 'telemetry'] as const;

function Probe({ onPatch }: { onPatch: (patch: (n: number) => void) => void }) {
  const { data } = useQuery({ queryKey: KEY, queryFn: () => 0, initialData: 0 });
  const patch = useThrottledPatch<number, number>(KEY, (_current, payload) => payload);
  onPatch(patch);
  return <div data-testid="value">{data}</div>;
}

describe('useThrottledPatch', () => {
  it('patches with setQueryData rather than invalidating the query', () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    let patch: (n: number) => void = () => undefined;

    render(
      <QueryClientProvider client={queryClient}>
        <Probe onPatch={(p) => (patch = p)} />
      </QueryClientProvider>,
    );

    patch(42);
    expect(queryClient.getQueryData(KEY)).toBe(42);
    expect(invalidateSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('throttles a burst to the latest value', () => {
    vi.useFakeTimers();
    const queryClient = new QueryClient();
    let patch: (n: number) => void = () => undefined;

    render(
      <QueryClientProvider client={queryClient}>
        <Probe onPatch={(p) => (patch = p)} />
      </QueryClientProvider>,
    );

    act(() => {
      patch(1);
      patch(2);
      patch(3);
    });
    expect(queryClient.getQueryData(KEY)).toBe(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(queryClient.getQueryData(KEY)).toBe(3);

    vi.useRealTimers();
  });
});
