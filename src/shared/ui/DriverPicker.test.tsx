import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as Dialog from '@radix-ui/react-dialog';
import { DriverPicker, type PickerOption } from './DriverPicker';

const options: PickerOption[] = [
  { id: '1', name: 'Carlos Ramirez', context: 'Dallas' },
  { id: '2', name: 'Sarah Chen', context: 'Austin' },
];

describe('DriverPicker', () => {
  it('filters case-insensitively and has a scrollable list', async () => {
    const user = userEvent.setup();
    render(<DriverPicker options={options} onSelect={() => {}} placeholder="Select a driver" />);
    await user.click(screen.getByText('Select a driver'));
    expect(screen.getByRole('list').className).toContain('overflow-y-auto');
    await user.type(screen.getByPlaceholderText('Search'), 'cHEn');
    expect(screen.queryByText('Carlos Ramirez')).toBeNull();
    expect(screen.getByText('Sarah Chen')).toBeTruthy();
  });

  it('portals into the dialog so focus trap does not block typing', async () => {
    const user = userEvent.setup();
    render(
      <Dialog.Root open>
        <Dialog.Content>
          <Dialog.Title>t</Dialog.Title>
          <Dialog.Description>d</Dialog.Description>
          <DriverPicker options={options} onSelect={() => {}} placeholder="Select a driver" />
        </Dialog.Content>
      </Dialog.Root>,
    );
    await user.click(screen.getByText('Select a driver'));
    const input = screen.getByPlaceholderText('Search');
    expect(input.closest('[role="dialog"]')).not.toBeNull();
    await user.type(input, 'carl');
    expect(input).toHaveFocus();
    expect(screen.queryByText('Sarah Chen')).toBeNull();
  });
});
