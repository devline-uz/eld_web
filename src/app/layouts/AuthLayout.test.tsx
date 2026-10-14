// AuthLayout — the public brand panel (sign-in and the driver email links) names the product only.
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';

function renderAt(path: string, layout = <AuthLayout />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={layout}>
          <Route path="/sign-in" element={<p>Sign-in card</p>} />
          <Route path="/driver-email/confirm" element={<p>Driver link card</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthLayout brand panel', () => {
  it.each([
    ['/sign-in', 'Sign-in card'],
    ['/driver-email/confirm', 'Driver link card'],
  ])('%s shows the OneBook ELD brand, never a panel role, and renders the page', (path, card) => {
    renderAt(path);
    const brand = screen.getByRole('complementary', { name: 'OneBook ELD' });
    expect(within(brand).getByText('OneBook ELD')).toBeInTheDocument();
    expect(within(brand).getByText('Electronic logging device')).toBeInTheDocument();
    expect(brand).not.toHaveTextContent(/Fleet Manager/i);
    expect(within(screen.getByRole('main')).getByText(card)).toBeInTheDocument();
  });

  it('takes a per-route subtitle', () => {
    renderAt('/driver-email/confirm', <AuthLayout subtitle="Driver account" />);
    const brand = screen.getByRole('complementary', { name: 'OneBook ELD' });
    expect(within(brand).getByText('Driver account')).toBeInTheDocument();
    expect(within(brand).queryByText('Electronic logging device')).toBeNull();
  });
});
