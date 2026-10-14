// owner: web-auth-rbac — W-00 "Forgot password?" (customer request 2026-10-12), dev auth only.
// The whole flow through SignInPage against the default MSW handlers (src/mocks/handlers/auth.ts:
// any `@universal-logistics.example` address exists, the code is `123456`, `000000` is wrong).
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/server';
import { fail, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ToastProvider } from '@/shared/ui/Toast';
import type * as FirebaseModule from '@/shared/auth/firebase';
import SignInPage from './SignInPage';

vi.hoisted(() => {
  vi.stubEnv('VITE_AUTH_MODE', 'dev');
});

vi.mock('@/shared/auth/firebase', async (importOriginal) => {
  const actual = await importOriginal<typeof FirebaseModule>();
  return { ...actual, consumeGoogleRedirectResult: async () => null, signInWithGoogle: vi.fn() };
});

const auth = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/AuthProvider', () => ({ useAuth: () => auth.current }));

const EMAIL = 'sarah.chen@universal-logistics.example';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  auth.current = {
    isAuthenticated: false,
    signInWithPassword: vi.fn(async () => ({ status: 'authenticated' })),
    signInWithGoogleToken: vi.fn(async () => ({ status: 'authenticated' })),
  };
});

function renderSignIn() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/sign-in']}>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

async function openReset(user: ReturnType<typeof userEvent.setup>, email = '') {
  if (email) await user.type(screen.getByRole('textbox', { name: 'Email' }), email);
  await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
  return screen.findByRole('heading', { name: 'Reset password' });
}

async function reachCodeStep(user: ReturnType<typeof userEvent.setup>) {
  await openReset(user, EMAIL);
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  return screen.findByRole('heading', { name: 'Check your email' });
}

describe('W-00 · Forgot password?', () => {
  it('sits directly under the Sign in button inside the email/password form', () => {
    renderSignIn();
    const form = screen.getByRole('form', { name: 'Developer sign-in' });
    const buttons = within(form).getAllByRole('button').map((b) => b.textContent);
    const signIn = buttons.indexOf('Sign in');
    expect(signIn).toBeGreaterThanOrEqual(0);
    expect(buttons[signIn + 1]).toBe('Forgot password?');
  });

  it('opens the email step with the typed email, and Back to sign in returns', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await openReset(user, EMAIL);
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(EMAIL);
    expect(screen.queryByRole('heading', { name: 'Sign in to your account' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument();
  });

  it('validates the email before calling the server', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await openReset(user);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('shows "No account found with this email" for an unknown address', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await openReset(user, 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('No account found with this email.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument();
  });

  it('sends the email trimmed', async () => {
    let sent: unknown;
    server.use(
      http.post(url(endpoints.auth.passwordResetCode), async ({ request }) => {
        sent = ((await request.json()) as { email: unknown }).email;
        return fail(404, 'NOT_FOUND', 'No account found with this email.');
      }),
    );
    const user = userEvent.setup();
    renderSignIn();
    await openReset(user, '  Nobody@Example.com ');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('No account found with this email.')).toBeInTheDocument();
    expect(sent).toBe('Nobody@Example.com');
  });

  it('maps 429 to a banner with the retry time', async () => {
    server.use(
      http.post(url(endpoints.auth.passwordResetCode), () =>
        fail(429, 'RATE_LIMITED', 'Slow down.', { retryAfterSec: 42 }),
      ),
    );
    const user = userEvent.setup();
    renderSignIn();
    await openReset(user, EMAIL);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 42 seconds.');
  });

  it('B-84 — inside the email-change hold no code is sent and the banner says why', async () => {
    server.use(
      http.post(url(endpoints.auth.passwordResetCode), () =>
        fail(409, 'EMAIL_CHANGE_ON_HOLD', 'held', { holdUntil: '2026-10-16T08:00:00.000Z' }),
      ),
    );
    const user = userEvent.setup();
    renderSignIn();
    await openReset(user, EMAIL);
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The email on this account was changed recently');
    expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument();
  });

  it('goes to the code step, with Resend code on a cooldown', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await reachCodeStep(user);
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Verification code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend code in 1:00|Resend code in 0:5\d/ })).toBeDisabled();
  });

  it('refuses a confirmation that does not match, without calling the server', async () => {
    const confirm = vi.fn();
    server.use(
      http.post(url(endpoints.auth.passwordResetCodeConfirm), () => {
        confirm();
        return fail(500, 'INTERNAL_ERROR', 'should not be called');
      }),
    );
    const user = userEvent.setup();
    renderSignIn();
    await reachCodeStep(user);
    await user.type(screen.getByRole('textbox', { name: 'Verification code' }), '123456');
    await user.type(screen.getByLabelText('New password'), 'N3wPassword!');
    await user.type(screen.getByLabelText('Confirm new password'), 'Different1!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('enforces the password policy client-side', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await reachCodeStep(user);
    await user.type(screen.getByRole('textbox', { name: 'Verification code' }), '123456');
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 8 characters.');
  });

  it('shows the server message for a wrong code under the code field', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await reachCodeStep(user);
    await user.type(screen.getByRole('textbox', { name: 'Verification code' }), '000000');
    await user.type(screen.getByLabelText('New password'), 'N3wPassword!');
    await user.type(screen.getByLabelText('Confirm new password'), 'N3wPassword!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Incorrect code. 4 attempts left.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  });

  it('resets the password, toasts, and returns to sign in with the email prefilled', async () => {
    let body: unknown;
    server.use(
      http.post(url(endpoints.auth.passwordResetCodeConfirm), async ({ request }) => {
        body = await request.json();
        return new Response(JSON.stringify({ data: { success: true }, traceId: 't', timestamp: 'now' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const user = userEvent.setup();
    renderSignIn();
    await reachCodeStep(user);
    await user.type(screen.getByRole('textbox', { name: 'Verification code' }), '123456');
    await user.type(screen.getByLabelText('New password'), 'N3wPassword!');
    await user.type(screen.getByLabelText('Confirm new password'), 'N3wPassword!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument();
    expect(body).toEqual({ email: EMAIL, code: '123456', newPassword: 'N3wPassword!' });
    await waitFor(() => expect(screen.getByText('Password updated')).toBeInTheDocument());
    expect(screen.getByText('Sign in with your new password.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(EMAIL);
  });
});
