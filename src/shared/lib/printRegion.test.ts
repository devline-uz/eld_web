import { afterEach, describe, expect, it, vi } from 'vitest';
import { printRegion } from './printRegion';

afterEach(() => vi.restoreAllMocks());

describe('printRegion', () => {
  it('marks only the given element (and the body) while printing, and clears both afterwards', () => {
    const region = document.createElement('section');
    const other = document.createElement('nav');
    document.body.append(region, other);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(region).toHaveAttribute('data-print-target');
      expect(other).not.toHaveAttribute('data-print-target');
      expect(document.body).toHaveAttribute('data-printing');
    });

    printRegion(region);
    expect(print).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('afterprint'));
    expect(region).not.toHaveAttribute('data-print-target');
    expect(document.body).not.toHaveAttribute('data-printing');
    region.remove();
    other.remove();
  });

  it('marks the ancestor chain (not siblings) so the shell can be flattened, and clears it', () => {
    const shell = document.createElement('div');
    const main = document.createElement('main');
    const sidebar = document.createElement('aside');
    const region = document.createElement('section');
    main.append(region);
    shell.append(sidebar, main);
    document.body.append(shell);
    vi.spyOn(window, 'print').mockImplementation(() => {
      expect(shell).toHaveAttribute('data-print-ancestor');
      expect(main).toHaveAttribute('data-print-ancestor');
      expect(sidebar).not.toHaveAttribute('data-print-ancestor');
      expect(region).not.toHaveAttribute('data-print-ancestor');
    });

    printRegion(region);
    window.dispatchEvent(new Event('afterprint'));
    expect(shell).not.toHaveAttribute('data-print-ancestor');
    expect(main).not.toHaveAttribute('data-print-ancestor');
    shell.remove();
  });

  it('does nothing without an element', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    printRegion(null);
    expect(print).not.toHaveBeenCalled();
  });
});
