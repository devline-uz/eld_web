import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from './states';
import { EMPTY_STATE_COPY } from './copy';

describe('<EmptyState>', () => {
  it('renders the exact §13.2 Vehicles copy and both actions', () => {
    const onImport = vi.fn();
    const onAdd = vi.fn();
    render(
      <EmptyState
        title={EMPTY_STATE_COPY.vehicles.title}
        description={EMPTY_STATE_COPY.vehicles.description}
        actions={[
          { label: 'Import CSV', onClick: onImport, variant: 'secondary' },
          { label: 'Add vehicle', onClick: onAdd, variant: 'primary' },
        ]}
      />,
    );
    expect(screen.getByText('No vehicles yet')).toBeInTheDocument();
    expect(
      screen.getByText('Add your first unit or import a CSV to start recording hours of service.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add vehicle' })).toBeInTheDocument();
  });

  it('renders without actions when none are supplied', () => {
    render(<EmptyState title={EMPTY_STATE_COPY.hosLogsNoDriver.title} />);
    expect(screen.getByText('Select a driver to view their log')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// web/tests/STATES-AUDIT.md — the shared skeleton, in-card error and full-page forbidden
// primitives every screen's own `isLoading` / `isError` / `can()` branch renders through. A
// screen that switches on those three flags and reaches for these three components (grep-
// verified across every feature in web/tests/STATES-AUDIT.md) inherits this coverage rather
// than needing an identical per-screen assertion.
describe('<LoadingState>', () => {
  it('is a skeleton, never a spinner: `aria-busy`, no visible text, animated placeholder rows', () => {
    const { container } = render(<LoadingState rows={3} />);
    expect(screen.getByText('Loading')).toHaveClass('sr-only');
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
  });
});

describe('<ErrorState>', () => {
  it('is role="alert" and calls onRetry from its Retry button', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders without a Retry button when no onRetry is supplied', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});

describe('<ForbiddenState>', () => {
  it('names the screen in its sentence and has no Retry button', () => {
    render(<ForbiddenState screenName="Roles & permissions" />);
    expect(screen.getByText('You do not have access to this page')).toBeInTheDocument();
    expect(screen.getByText(/Roles & permissions/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
