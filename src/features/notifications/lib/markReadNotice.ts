// WB-244 / B-56 — the "single mark-read is unavailable" notice is shown at most once per session
// (module scope = the SPA session), so clicking row after row never stacks toasts.
let shown = false;

/** True the first time only; every later call in the session returns false. */
export function claimMarkReadNotice(): boolean {
  if (shown) return false;
  shown = true;
  return true;
}

/** Test hook. */
export function resetMarkReadNotice(): void {
  shown = false;
}
