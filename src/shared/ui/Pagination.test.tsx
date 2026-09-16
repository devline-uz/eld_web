// §5.6 <Pagination> — the states a caller's `page` can be in when a list shrinks under it, and the
// label/select pairing when one screen draws two tables.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

function renderPagination(props: Partial<React.ComponentProps<typeof Pagination>> = {}) {
  const onPageChange = vi.fn();
  const onLimitChange = vi.fn();
  render(
    <Pagination
      page={1}
      limit={10}
      total={35}
      totalPages={4}
      itemLabel="vehicles"
      onPageChange={onPageChange}
      onLimitChange={onLimitChange}
      {...props}
    />,
  );
  return { onPageChange, onLimitChange };
}

describe('<Pagination> out-of-range page', () => {
  it('reads the last page, not `41–3 of 3`, when the list shrank under the open page', () => {
    renderPagination({ page: 5, total: 3, totalPages: 1 });
    expect(screen.getByText('1–3 of 3 vehicles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('steps back from the last real page, never from the stale one', async () => {
    const { onPageChange } = renderPagination({ page: 9, total: 25, totalPages: 3 });
    expect(screen.getByText('21–25 of 25 vehicles')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('keeps one current page button and both arrows disabled for an empty list', () => {
    renderPagination({ page: 1, total: 0, totalPages: 0 });
    expect(screen.getByText('0–0 of 0 vehicles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('still pages normally when `page` is in range', async () => {
    const { onPageChange } = renderPagination({ page: 2 });
    expect(screen.getByText('11–20 of 35 vehicles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});

describe('<Pagination> rows-per-page label', () => {
  it('pairs each label with its own select when two tables share a screen', async () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <>
        <Pagination page={1} limit={10} total={35} totalPages={4} itemLabel="defects" onPageChange={vi.fn()} onLimitChange={first} />
        <Pagination page={1} limit={10} total={35} totalPages={4} itemLabel="work orders" onPageChange={vi.fn()} onLimitChange={second} />
      </>,
    );
    const selects = screen.getAllByLabelText('Rows per page:') as HTMLSelectElement[];
    expect(selects).toHaveLength(2);
    expect(selects[0]!.id).not.toBe(selects[1]!.id);
    await userEvent.selectOptions(selects[1]!, '50');
    expect(second).toHaveBeenCalledWith(50);
    expect(first).not.toHaveBeenCalled();
  });
});
