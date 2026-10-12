// QA FE-004 — two clicks in the same tick on `Create work order` sent two POST /work-orders.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ToastProvider } from '@/shared/ui/Toast';
import { CreateWorkOrderModal } from './CreateWorkOrderModal';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CreateWorkOrderModal', () => {
  it('FE-004: a same-tick double click creates one work order', async () => {
    let posts = 0;
    server.use(
      http.post(url(endpoints.workOrders.create), async () => {
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return ok({ id: 'wo_1', number: 'WO-1' });
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CreateWorkOrderModal vehicleId="veh_1" onClose={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Brake repair'), { target: { value: 'Brake repair' } });
    const submit = screen.getByRole('button', { name: 'Create work order' });
    // Both clicks inside one batch: the second runs before `isPending` re-renders the button.
    act(() => {
      submit.click();
      submit.click();
    });
    await vi.waitFor(() => expect(posts).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(posts).toBe(1);
  });
});
