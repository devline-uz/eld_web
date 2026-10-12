// QA dashboard lazy map — a background tab never intersects, so `fallbackMs` mounts the content
// anyway after the delay, or as soon as the tab becomes visible.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { LazyOnVisible } from './LazyOnVisible';

class SilentObserver {
  observe() {}
  disconnect() {}
}

describe('LazyOnVisible', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', SilentObserver);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the placeholder while the observer has not fired and no fallback is set', () => {
    render(<LazyOnVisible placeholder={<p>placeholder</p>}><p>content</p></LazyOnVisible>);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('placeholder')).toBeInTheDocument();
  });

  it('mounts the content after fallbackMs even if never intersected (background tab)', () => {
    render(
      <LazyOnVisible placeholder={<p>placeholder</p>} fallbackMs={1000}>
        <p>content</p>
      </LazyOnVisible>,
    );
    expect(screen.queryByText('content')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('mounts on visibilitychange to visible', () => {
    render(
      <LazyOnVisible placeholder={<p>placeholder</p>} fallbackMs={60_000}>
        <p>content</p>
      </LazyOnVisible>,
    );
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
