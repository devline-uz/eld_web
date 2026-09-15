import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HosMeter } from './HosMeter';
import { hosTone } from './ProgressBar';

// web/tz.md §3.5 — >25% success · 10–25% warning · <10% or 0 danger.
describe('hosTone (§3.5 thresholds)', () => {
  it('is success above 25% remaining', () => {
    expect(hosTone(11 * 3600 * 0.5, 11 * 3600)).toBe('success');
  });

  it('is warning between 10% and 25% remaining', () => {
    expect(hosTone(11 * 3600 * 0.2, 11 * 3600)).toBe('warning');
  });

  it('is danger below 10% remaining', () => {
    expect(hosTone(11 * 3600 * 0.05, 11 * 3600)).toBe('danger');
  });

  it('is danger at exactly 0 remaining', () => {
    expect(hosTone(0, 11 * 3600)).toBe('danger');
  });
});

describe('<HosMeter>', () => {
  it('renders HH:MM tabular value and the label', () => {
    render(<HosMeter label="Drive left · 11h" remainingSec={3600} limitSec={11 * 3600} />);
    expect(screen.getByText('01:00')).toBeInTheDocument();
    expect(screen.getByText('Drive left · 11h')).toBeInTheDocument();
  });

  it('shows "limit exceeded" when remaining is 0', () => {
    render(<HosMeter label="Drive left" remainingSec={0} limitSec={11 * 3600} />);
    expect(screen.getByText('limit exceeded')).toBeInTheDocument();
  });

  it('does not show "limit exceeded" when time remains', () => {
    render(<HosMeter label="Drive left" remainingSec={3600} limitSec={11 * 3600} />);
    expect(screen.queryByText('limit exceeded')).not.toBeInTheDocument();
  });
});
