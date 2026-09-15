import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { Pagination } from './Pagination';

interface Row {
  id: string;
  unitNumber: string;
  odometer: number;
}

const rows: Row[] = [
  { id: '1', unitNumber: '#103', odometer: 82000 },
  { id: '2', unitNumber: '#101', odometer: 154000 },
  { id: '3', unitNumber: '#126', odometer: 12000 },
];

const columns: ColumnDef<Row, unknown>[] = [
  { id: 'unitNumber', header: 'UNIT #', accessorKey: 'unitNumber' },
  { id: 'odometer', header: 'ODOMETER', accessorKey: 'odometer', meta: { numeric: true } },
];

describe('<DataTable>', () => {
  it('sorts by clicking a column header', async () => {
    const user = userEvent.setup();
    render(<DataTable data={rows} columns={columns} caption="Vehicles" getRowId={(r) => r.id} />);

    const bodyRowsBefore = screen.getAllByRole('row').slice(1);
    expect(within(bodyRowsBefore[0]!).getByText('#103')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'UNIT #' }));
    const ascending = screen.getAllByRole('row').slice(1);
    expect(within(ascending[0]!).getByText('#101')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'UNIT #' }));
    const descending = screen.getAllByRole('row').slice(1);
    expect(within(descending[0]!).getByText('#126')).toBeInTheDocument();
  });

  it('renders no checkbox or "…" column when selectable/rowActions are omitted (§12.2 read-only)', () => {
    render(<DataTable data={rows} columns={columns} caption="Vehicles" getRowId={(r) => r.id} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Row actions' })).not.toBeInTheDocument();
  });

  it('supports row selection when selectable is true', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        caption="Vehicles"
        getRowId={(r) => r.id}
        selectable
        selection={[]}
        onSelectionChange={onSelectionChange}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all" in the header.
    await user.click(checkboxes[1]!);
    expect(onSelectionChange).toHaveBeenCalledWith(['1']);
  });

  it('renders the row "…" menu only when rowActions is supplied', () => {
    render(
      <DataTable
        data={rows}
        columns={columns}
        caption="Vehicles"
        getRowId={(r) => r.id}
        rowActions={() => <button>Delete</button>}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Row actions' })).toHaveLength(rows.length);
  });
});

describe('<Pagination>', () => {
  it('calls onPageChange when a page number is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={1}
        limit={10}
        total={35}
        totalPages={4}
        itemLabel="vehicles"
        onPageChange={onPageChange}
        onLimitChange={vi.fn()}
      />,
    );
    expect(screen.getByText('1–10 of 35 vehicles')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables the previous button on the first page', () => {
    render(
      <Pagination
        page={1}
        limit={10}
        total={35}
        totalPages={4}
        itemLabel="vehicles"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('calls onLimitChange when rows-per-page changes', async () => {
    const user = userEvent.setup();
    const onLimitChange = vi.fn();
    render(
      <Pagination
        page={1}
        limit={10}
        total={35}
        totalPages={4}
        itemLabel="vehicles"
        onPageChange={vi.fn()}
        onLimitChange={onLimitChange}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Rows per page:'), '25');
    expect(onLimitChange).toHaveBeenCalledWith(25);
  });
});
