// WB-122 — the MY ACCOUNT sub-nav marks the section the URL hash names.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AccountLayout } from './AccountLayout';

function renderAt(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<p>page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  const nav = screen.getByRole('navigation', { name: 'My account' });
  return [...nav.querySelectorAll('ul a')] as HTMLAnchorElement[];
}

const current = (links: HTMLAnchorElement[]) =>
  links.filter((a) => a.getAttribute('aria-current') === 'location').map((a) => a.textContent);

describe('AccountLayout sub-nav (WB-122)', () => {
  it('highlights exactly the section in the hash', () => {
    const links = renderAt('/account#sessions');
    expect(current(links)).toEqual(['Active sessions']);
    const active = links.find((a) => a.textContent === 'Active sessions');
    expect(active?.className).toContain('bg-bg-nav-active');
    expect(links.find((a) => a.textContent === 'My profile')?.className).not.toContain('bg-bg-nav-active');
  });

  it('highlights My profile on a bare /account', () => {
    expect(current(renderAt('/account'))).toEqual(['My profile']);
  });

  it('falls back to My profile for a hash that names no section', () => {
    expect(current(renderAt('/account#nowhere'))).toEqual(['My profile']);
  });

  it('keeps native fragment anchors so a repeat click still scrolls (WB-082)', () => {
    const links = renderAt('/account#security');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '#profile',
      '#security',
      '#notifications',
      '#language',
      '#sessions',
    ]);
  });
});
