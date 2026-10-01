// owner: web-perf — windowed <tbody> rows for long tables (web/tz.md §16.2: "virtualise only
// > 500 rows"). A plain `<table>` stays a plain table: the rows outside the window are replaced by
// two aria-hidden spacer rows, the table carries `aria-rowcount` and every rendered row its
// `aria-rowindex`, so assistive tech still hears "row 812 of 5000". Below the threshold nothing
// changes — every row renders and no scroll container is introduced.
import { useRef, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/** §16.2 — tables only window their rows above this many. */
export const VIRTUALIZE_ABOVE = 500;

/** Scroll container that bounds a virtualised table (the header sticks inside it). */
export const VIRTUAL_SCROLL_CLASS = 'max-h-[70vh] overflow-auto';
/** `<th>` classes that keep the header visible while the virtualised body scrolls under it. */
export const STICKY_HEAD_CLASS = 'sticky top-0 z-10 bg-bg-surface';

export type VirtualRow = { index: number; start: number };

export type VirtualRowsResult = {
  /** True when `count` is above the threshold and only a window of rows is rendered. */
  enabled: boolean;
  /** Attach to the scroll container that wraps the `<table>` (only needed when `enabled`). */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Row indexes to render, in order. When not `enabled`, every index `0…count-1`. */
  rows: VirtualRow[];
  /** Height of the spacer row above / below the rendered window, in CSS pixels. */
  padTop: number;
  padBottom: number;
  /** Pass as `ref` on each rendered `<tr>` (with `data-index`) to measure real row heights. */
  measureRow: ((node: Element | null) => void) | undefined;
};

export function useVirtualRows({
  count,
  estimateRowHeight,
  threshold = VIRTUALIZE_ABOVE,
  overscan = 12,
}: {
  count: number;
  estimateRowHeight: number;
  threshold?: number;
  overscan?: number;
}): VirtualRowsResult {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const enabled = count > threshold;
  // Same opt-out as DataTable's useReactTable: the virtualizer is read fresh every render.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: enabled ? count : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  });

  if (!enabled) {
    return {
      enabled,
      scrollRef,
      rows: Array.from({ length: count }, (_, index) => ({ index, start: index * estimateRowHeight })),
      padTop: 0,
      padBottom: 0,
      measureRow: undefined,
    };
  }
  const items = virtualizer.getVirtualItems();
  const first = items[0];
  const last = items[items.length - 1];
  return {
    enabled,
    scrollRef,
    rows: items.map((item) => ({ index: item.index, start: item.start })),
    padTop: first ? first.start : 0,
    // Nothing measured yet (first frame, hidden container): the spacer holds the full height so
    // the scroll container still gets its real size and the window fills on the next frame.
    padBottom: Math.max(0, virtualizer.getTotalSize() - (last ? last.end : 0)),
    measureRow: virtualizer.measureElement,
  };
}

/** Invisible full-width row that stands in for the rows outside the rendered window. */
export function SpacerRow({ height, colSpan }: { height: number; colSpan: number }) {
  if (height <= 0) return null;
  return (
    <tr aria-hidden="true" data-virtual-spacer="" style={{ height }}>
      <td colSpan={colSpan} className="border-0 p-0" />
    </tr>
  );
}
