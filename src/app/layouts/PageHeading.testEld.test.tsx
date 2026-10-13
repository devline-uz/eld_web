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
});
