// owner: web-auth-rbac — W-00 under `VITE_AUTH_MODE=production` (Q-1): Google is the only way in.
// Its own file because the auth mode is fixed when the module is evaluated, which is exactly what
// lets the production build tree-shake the password form away (E2E scenario 3 greps `dist/`).
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type * as FirebaseModule from '@/shared/auth/firebase';
import SignInPage from './SignInPage';

vi.hoisted(() => {
  vi.stubEnv('VITE_AUTH_MODE', 'production');
});

vi.mock('@/shared/auth/AuthProvider', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    signInWithPassword: vi.fn(),
    signInWithGoogleToken: vi.fn(),
  }),
}));

vi.mock('@/shared/auth/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseModule>()),
  signInWithGoogle: vi.fn(),
  consumeGoogleRedirectResult: vi.fn(async () => null),
}));

describe('W-00 · production mode', () => {
  it('offers Google and nothing else — no password form anywhere in the tree', () => {
    render(
      <MemoryRouter initialEntries={['/sign-in']}>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Developer sign-in' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Development mode/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Demo accounts/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('Developer sign-in');
  });
});
