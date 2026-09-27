// QA fix — the W-16 `+ New` driver list offers ACTIVE drivers only (`GET /drivers?status=ACTIVE`).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { NewConversationModal } from './NewConversationModal';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

describe('NewConversationModal — driver list', () => {
  it('requests and shows ACTIVE drivers only', async () => {
    const statuses: (string | null)[] = [];
    server.use(
      http.get(url(endpoints.drivers.list), ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        statuses.push(status);
        const all = [
          { id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', homeTerminalName: 'Columbus, OH' },
          { id: 'drv_2', username: 'otimer', firstName: 'Old', lastName: 'Timer', status: 'INACTIVE', homeTerminalName: 'Columbus, OH' },
        ];
        const items = status ? all.filter((d) => d.status === status) : all;
        return ok({ items, page: 1, limit: 50, total: items.length, totalPages: 1 });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <NewConversationModal onClose={vi.fn()} onCreated={vi.fn()} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/John Smith/)).toBeInTheDocument();
    expect(screen.queryByText(/Old Timer/)).not.toBeInTheDocument();
    expect(statuses.every((s) => s === 'ACTIVE')).toBe(true);
  });
});
