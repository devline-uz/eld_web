// LIVE-007 — the read/delivered tooltip uses the carrier zone, not the browser's.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageTicks } from './MessageTicks';

vi.mock('@/shared/auth/AuthProvider', () => ({
  useOptionalAuth: () => ({ user: { id: 'usr_1', homeTerminalTimezone: 'America/Denver' } }),
}));

describe('MessageTicks', () => {
  it('renders the read time in the carrier zone (2026-10-13T21:15Z is 15:15 in Denver)', () => {
    render(<MessageTicks message={{ deliveredAt: '2026-10-13T21:10:00Z', readAt: '2026-10-13T21:15:54Z' }} />);
    const tick = screen.getByRole('img');
    expect(tick.getAttribute('aria-label')).toMatch(/^Read Oct 13(, 2026)?, 15:15$/);
  });

  it('renders the delivered time in the carrier zone', () => {
    render(<MessageTicks message={{ deliveredAt: '2026-10-13T21:10:00Z', readAt: null }} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/^Delivered Oct 13(, 2026)?, 15:10$/);
  });
});
