/**
 * CODE-010 — what an edit form sends for an optional field. `JSON.stringify` drops `undefined`
 * and a `PATCH` leaves an omitted field unchanged, so a field the user emptied used to be saved
 * with its old value ("Saved" toast, plate still there). The backend clears a field on `null`.
 *
 * - a non-empty value is sent as is;
 * - empty now but it had a value when the form opened -> `null` (clear it);
 * - empty before and after -> `undefined` (not sent, nothing to change).
 */
export function clearable<T extends string>(
  next: T | null | undefined,
  initial: string | null | undefined,
): T | null | undefined {
  if (next != null && next.trim() !== '') return next;
  return initial != null && initial.trim() !== '' ? null : undefined;
}
