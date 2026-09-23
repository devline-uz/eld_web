// owner: web-dvir-safety — toast copy for W-09 actions that `shared/ui/copy.ts` (§13.3) has no
// verbatim sentence for.
import type { ToastCopy } from '@/shared/ui/copy';

export const DVIR_TOAST_COPY = {
  /** Header `Export` — the active tab's rows were written to a CSV file. */
  exported: (count: number, fileName: string): ToastCopy => ({
    title: 'Export ready',
    description: `${count} ${count === 1 ? 'row' : 'rows'} saved to ${fileName}.`,
  }),
  /** Header `Export` — building or saving the file failed. */
  exportFailed: (reason: string): ToastCopy => ({
    title: 'Export failed',
    description: reason,
  }),
};
