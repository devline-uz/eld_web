import { describe, expect, it } from 'vitest';
import { cleanup, createEvent, fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nonNegativeIntInputProps, sanitizeNonNegativeInt } from './nonNegativeIntInput';

describe('sanitizeNonNegativeInt', () => {
  it('clamps anything negative to 0 and keeps whole numbers only', () => {
    expect(sanitizeNonNegativeInt('')).toBe('');
    expect(sanitizeNonNegativeInt('-5')).toBe('0');
    expect(sanitizeNonNegativeInt('-0')).toBe('0');
    expect(sanitizeNonNegativeInt('12.9')).toBe('12');
    expect(sanitizeNonNegativeInt('abc')).toBe('');
    expect(sanitizeNonNegativeInt(' 42 ')).toBe('42');
  });
});

describe('nonNegativeIntInputProps', () => {
  const renderInput = (defaultValue = '') => {
    cleanup();
    const { container } = render(<input aria-label="n" defaultValue={defaultValue} {...nonNegativeIntInputProps} />);
    return container.querySelector('input') as HTMLInputElement;
  };

  it('sets min=0, step=1 and a numeric keypad', () => {
    const input = renderInput();
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('step', '1');
    expect(input).toHaveAttribute('inputmode', 'numeric');
  });

  it('rejects -, +, e and . keystrokes', async () => {
    const user = userEvent.setup();
    const input = renderInput();
    await user.type(input, '-+e.7');
    expect(input.value).toBe('7');
  });

  it('blocks ArrowDown / PageDown at 0 or blank, allows it above 0', () => {
    for (const [value, blocked] of [['', true], ['0', true], ['1', false]] as const) {
      const input = renderInput(value);
      for (const key of ['ArrowDown', 'PageDown']) {
        const ev = createEvent.keyDown(input, { key });
        fireEvent(input, ev);
        expect(ev.defaultPrevented).toBe(blocked);
      }
    }
  });

  it('blocks paste and drop of non-digit (e.g. negative) text', () => {
    const input = renderInput();
    const paste = (text: string) => {
      const ev = createEvent.paste(input, { clipboardData: { getData: () => text } });
      fireEvent(input, ev);
      return ev.defaultPrevented;
    };
    const drop = (text: string) => {
      const ev = createEvent.drop(input, { dataTransfer: { getData: () => text } });
      fireEvent(input, ev);
      return ev.defaultPrevented;
    };
    expect(paste('-100')).toBe(true);
    expect(paste('1e3')).toBe(true);
    expect(paste('100')).toBe(false);
    expect(drop('-100')).toBe(true);
    expect(drop('100')).toBe(false);
  });

  it('drops focus on wheel so scrolling cannot step the value', () => {
    const input = renderInput('0');
    input.focus();
    expect(input).toHaveFocus();
    fireEvent.wheel(input, { deltaY: 100 });
    expect(input).not.toHaveFocus();
  });
});
