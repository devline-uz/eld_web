// WB-175 — `/404` was still the `PagePlaceholder` scaffold ("— · not implemented yet") with no
// way back to the app.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/', '/no-such-page']} initialIndex={1}>
      <Routes>
        <Route path="/" element={<p>Dashboard</p>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('NotFoundPage', () => {
  it('names the missing path and never claims the product is unfinished', () => {
    renderPage();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is served at \/no-such-page/)).toBeInTheDocument();
    expect(screen.queryByText(/not implemented yet/)).toBeNull();
  });

  it('offers a way back to the dashboard', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Open dashboard' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('offers Go back as well', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeEnabled();
  });
});
