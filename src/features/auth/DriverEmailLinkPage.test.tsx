// Driver email change — public landings of the emailed links: act only on click, post the token
// anonymously, and say what happened.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import DriverEmailLinkPage, { type DriverEmailLinkMode } from './DriverEmailLinkPage';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAt(mode: DriverEmailLinkMode, search: string) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/driver-email/${mode}${search}`]}>
        <DriverEmailLinkPage mode={mode} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Driver email change link pages', () => {
  it('confirm: nothing happens on load; the click posts the token without a bearer and shows the new email', async () => {
    const seen: Array<{ token: unknown; auth: string | null }> = [];
    server.use(
      http.post(url(endpoints.auth.driverEmailConfirm), async ({ request }) => {
        seen.push({ token: ((await request.json()) as { token: unknown }).token, auth: request.headers.get('authorization') });
        return ok({ success: true, email: 'new@example.com' });
      }),
    );
    const user = userEvent.setup();
    renderAt('confirm', '?token=abc');
    expect(seen).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Confirm email' }));
    expect(await screen.findByText(/Your email is now new@example.com/)).toBeInTheDocument();
    expect(seen).toEqual([{ token: 'abc', auth: null }]);
  });

  it('cancel: a revert inside the hold window is reported as such; an invalid link shows the server reason', async () => {
    server.use(http.post(url(endpoints.auth.driverEmailCancel), () => ok({ success: true, result: 'REVERTED' })));
    const user = userEvent.setup();
    const { unmount } = renderAt('cancel', '?token=t');
    await user.click(screen.getByRole('button', { name: /This wasn't me/ }));
    expect(await screen.findByText(/previous email is back/)).toBeInTheDocument();
    unmount();

    server.use(
      http.post(url(endpoints.auth.driverEmailCancel), () =>
        fail(401, 'TOKEN_INVALID', 'This link can no longer cancel the change. Contact your carrier.'),
      ),
    );
    renderAt('cancel', '?token=t');
    await user.click(screen.getByRole('button', { name: /This wasn't me/ }));
    expect(await screen.findByText('This link can no longer cancel the change. Contact your carrier.')).toBeInTheDocument();
  });

  it('verify: the click posts the token anonymously; a repeat click reports already verified; expiry is explained', async () => {
    const seen: Array<{ token: unknown; auth: string | null }> = [];
    server.use(
      http.post(url(endpoints.auth.driverEmailVerify), async ({ request }) => {
        seen.push({ token: ((await request.json()) as { token: unknown }).token, auth: request.headers.get('authorization') });
        return ok({ success: true, email: 'jsmith@example.com', alreadyVerified: false });
      }),
    );
    const user = userEvent.setup();
    const { unmount } = renderAt('verify', '?token=v1');
    expect(seen).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByRole('status')).toHaveTextContent('jsmith@example.com is verified');
    expect(seen).toEqual([{ token: 'v1', auth: null }]);
    unmount();

    server.use(http.post(url(endpoints.auth.driverEmailVerify), () => ok({ success: true, email: 'jsmith@example.com', alreadyVerified: true })));
    const second = renderAt('verify', '?token=v1');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByRole('status')).toHaveTextContent('was already verified');
    second.unmount();

    server.use(http.post(url(endpoints.auth.driverEmailVerify), () => fail(401, 'TOKEN_EXPIRED', 'Token expired.')));
    renderAt('verify', '?token=v1');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This link has expired');
  });

  it('a link without a token says so and offers no action', () => {
    renderAt('confirm', '');
    expect(screen.getByRole('alert')).toHaveTextContent('This link is incomplete');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
