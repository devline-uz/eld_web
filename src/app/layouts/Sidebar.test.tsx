// WB-173 / WB-174 — §3's collapsed 64px sidebar had no control at all, and the organisation card
// printed a hardcoded `DOT #1234567 · 69 units` that belonged to no carrier in particular.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { Sidebar } from './Sidebar';

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../tests/fixtures/mockAuth');
  return { ...actual, useAuth: () => buildMockAuthContext('ADMIN') };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  window.localStorage.clear();
  server.use(
    http.get(url(endpoints.carrier.root), () => ok({ id: 'carrier', name: 'Northway Freight', dotNumber: '7654321' })),
    http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 1, total: 24, totalPages: 24 })),
  );
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  window.localStorage.clear();
});
afterAll(() => server.close());

function renderSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sidebar', () => {
  it('reads the carrier and the real unit count instead of the hardcoded line', async () => {
    renderSidebar();
    expect(await screen.findByText('DOT #7654321 · 24 units')).toBeInTheDocument();
    expect(screen.getByText('Northway Freight')).toBeInTheDocument();
    expect(screen.queryByText(/DOT #1234567/)).toBeNull();
  });

  it('leaves out the part that did not load rather than guessing it', async () => {
    server.use(http.get(url(endpoints.carrier.root), () => ok({ id: 'carrier', name: 'Northway Freight', dotNumber: null })));
    renderSidebar();
    expect(await screen.findByText('24 units')).toBeInTheDocument();
    expect(screen.queryByText(/DOT #/)).toBeNull();
  });

  it('signs the organisation card with the Devline logo under the company name', async () => {
    const user = userEvent.setup();
    renderSidebar();
    const name = await screen.findByText('Northway Freight');
    const logo = screen.getByRole('img', { name: 'Powered by Devline' });
    // Under the company name, not above it.
    expect(name.compareDocumentPosition(logo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(logo).toHaveTextContent(/Powered by/i);
    expect(logo).toHaveTextContent('evline');

    // Collapsed rail: only the "D" tile, still named for assistive tech.
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const mark = screen.getByRole('img', { name: 'Powered by Devline' });
    expect(mark).not.toHaveTextContent(/Powered by/i);
    expect(mark.querySelector('svg')).not.toBeNull();
  });

  it('collapses to the 64px state and remembers the choice', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSidebar();

    const aside = screen.getByRole('complementary');
    expect(aside).toHaveClass('w-sidebar');
    expect(screen.getByText('OneBook ELD')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(aside).toHaveClass('w-sidebar-collapsed');
    expect(screen.queryByText('OneBook ELD')).toBeNull();
    // The nav links keep their accessible names while only the icon is drawn.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();

    const expand = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    unmount();

    renderSidebar();
    await waitFor(() => expect(screen.getByRole('complementary')).toHaveClass('w-sidebar-collapsed'));
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('complementary')).toHaveClass('w-sidebar');
  });
});
