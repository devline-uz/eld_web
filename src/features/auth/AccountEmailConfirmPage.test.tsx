// B-84 — public landings of the web-user email-change links (confirm / cancel): act only on click,
// post the token anonymously, report success / already-used / expired / invalid, and end a panel
// session open in this browser once the server revoked every session.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import AccountEmailConfirmPage from './AccountEmailConfirmPage';

const auth = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/AuthProvider', () => ({ useAuth: () => auth.current }));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  auth.current = { isAuthenticated: false, signOut: vi.fn() };
});

function renderAt(search: string, mode: 'confirm' | 'cancel' = 'confirm') {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/account/email/${mode}${search}`]}>
        <AccountEmailConfirmPage mode={mode} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AccountEmailConfirmPage (/account/email/confirm)', () => {
  it('signed out: nothing happens on load; the click posts the token without a bearer and shows the new email', async () => {
    const seen: Array<{ token: unknown; auth: string | null }> = [];
    server.use(
      http.post(url(endpoints.auth.emailVerify), async ({ request }) => {
        seen.push({ token: ((await request.json()) as { token: unknown }).token, auth: request.headers.get('authorization') });
        return ok({ success: true, email: 'new@example.com', alreadyVerified: false });
      }),
    );
    const user = userEvent.setup();
    renderAt('?token=abc');
    expect(seen).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByText(/Your email is now new@example.com/)).toBeInTheDocument();
    expect(seen).toEqual([{ token: 'abc', auth: null }]);
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/sign-in');
    expect(auth.current.signOut).not.toHaveBeenCalled();
  });

  it('signed in: the server revoked every session, so the panel session here is ended too', async () => {
    auth.current = { isAuthenticated: true, signOut: vi.fn() };
    server.use(http.post(url(endpoints.auth.emailVerify), () => ok({ success: true, email: 'new@example.com', alreadyVerified: false })));
    const user = userEvent.setup();
    renderAt('?token=abc');
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your email is now new@example.com');
    expect(screen.getByRole('status')).toHaveTextContent('signed out everywhere');
    expect(auth.current.signOut).toHaveBeenCalledTimes(1);
  });

  it('an already-used link says so', async () => {
    server.use(http.post(url(endpoints.auth.emailVerify), () => ok({ success: true, email: 'new@example.com', alreadyVerified: true })));
    const user = userEvent.setup();
    renderAt('?token=abc');
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByRole('status')).toHaveTextContent('new@example.com was already confirmed');
  });

  it.each([
    ['TOKEN_EXPIRED', 401, 'This link has expired'],
    ['TOKEN_INVALID', 401, 'This link is not valid'],
    ['EMAIL_TAKEN', 409, 'Another user already has this email address'],
  ])('%s is shown as its own message and the button stays for a retry', async (code, status, text) => {
    server.use(http.post(url(endpoints.auth.emailVerify), () => fail(status, code, 'server says no')));
    const user = userEvent.setup();
    renderAt('?token=abc');
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: 'Confirm email' })).toBeInTheDocument();
  });

  it('a link without a token says so and offers no action', () => {
    renderAt('');
    expect(screen.getByRole('alert')).toHaveTextContent('This link is incomplete');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('AccountEmailConfirmPage cancel mode (/account/email/cancel)', () => {
  it('nothing happens on load; the click posts the token anonymously and reports a cancelled change', async () => {
    const seen: Array<{ token: unknown; auth: string | null }> = [];
    server.use(
      http.post(url(endpoints.auth.emailCancel), async ({ request }) => {
        seen.push({ token: ((await request.json()) as { token: unknown }).token, auth: request.headers.get('authorization') });
        return ok({ success: true, result: 'CANCELLED' });
      }),
    );
    const user = userEvent.setup();
    renderAt('?token=old-1', 'cancel');
    expect(screen.getByRole('heading', { name: 'Cancel the email change' })).toBeInTheDocument();
    expect(seen).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: "This wasn't me — cancel the change" }));
    expect(await screen.findByRole('status')).toHaveTextContent('The email change was cancelled');
    expect(seen).toEqual([{ token: 'old-1', auth: null }]);
    expect(auth.current.signOut).not.toHaveBeenCalled();
  });

  it('a revert inside the hold says the old email is back and ends a panel session here', async () => {
    auth.current = { isAuthenticated: true, signOut: vi.fn() };
    server.use(http.post(url(endpoints.auth.emailCancel), () => ok({ success: true, result: 'REVERTED' })));
    const user = userEvent.setup();
    renderAt('?token=old-1', 'cancel');
    await user.click(screen.getByRole('button', { name: "This wasn't me — cancel the change" }));
    expect(await screen.findByRole('status')).toHaveTextContent('your previous email is back');
    expect(auth.current.signOut).toHaveBeenCalledTimes(1);
  });

  it('a link that can no longer cancel shows its own message and keeps the button', async () => {
    server.use(http.post(url(endpoints.auth.emailCancel), () => fail(401, 'TOKEN_INVALID', 'server says no')));
    const user = userEvent.setup();
    renderAt('?token=old-1', 'cancel');
    await user.click(screen.getByRole('button', { name: "This wasn't me — cancel the change" }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This link can no longer cancel the change');
    expect(screen.getByRole('button', { name: "This wasn't me — cancel the change" })).toBeInTheDocument();
  });
});
