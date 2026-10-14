import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeading } from './Topbar';

describe('PageHeading — TEST ELD chip (pt30_pt40/tz.md §10.1)', () => {
  it('renders the chip only while test mode is enabled', () => {
    const { rerender } = render(<PageHeading fallbackTitle="Fleet" role="ADMIN" testEld />);
    expect(screen.getByText('TEST ELD')).toBeInTheDocument();
    rerender(<PageHeading fallbackTitle="Fleet" role="ADMIN" />);
    expect(screen.queryByText('TEST ELD')).toBeNull();
  });

  it('LIVE-030: the chip never wraps and the title keeps its full text as a tooltip', () => {
    render(<PageHeading fallbackTitle="Fleet Dashboard" role="ADMIN" testEld />);
    expect(screen.getByText('TEST ELD').className).toMatch(/whitespace-nowrap/);
    expect(screen.getByText('TEST ELD').className).toMatch(/shrink-0/);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('title', 'Fleet Dashboard');
  });
});
