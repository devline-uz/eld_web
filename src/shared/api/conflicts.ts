// owner: web-api-client — which unique field a 409 collided on.
//
// The backend still answers most uniqueness conflicts with a generic `CONFLICT` (backend_tasks.md
// B-97, B-100), so a form cannot simply pin every 409 on one field — that is how a duplicate VIN
// told the user the *unit number* was taken, and a duplicate email blamed the *username*. This
// reads every hint a 409 may carry, strongest first, and answers `null` when the conflict cannot
// be attributed (the caller then says "That value is already in use." instead of guessing).
import type { ApiError } from './errors';

export interface ConflictRule<F extends string> {
  /** The form field the conflict is shown on. */
  field: F;
  /** Matched against the upper-cased error code, e.g. `/VIN/` for `VIN_TAKEN`. */
  code: RegExp;
  /** Matched against lower-cased `details.field`, `details.target` entries and field-error keys. */
  hint: RegExp;
  /** Matched against the error message text — the weakest signal, tried last. */
  message: RegExp;
}

/**
 * The first rule that matches, tried in tiers across all rules: a specific code, then
 * `details.field`, a Prisma-style `details.target`, field-keyed details, then the message text.
 * Rule order breaks ties inside a tier, so list the more specific field first.
 */
export function conflictField<F extends string>(error: ApiError, rules: readonly ConflictRule<F>[]): F | null {
  const code = error.code.toUpperCase();
  const byCode = rules.find((r) => r.code.test(code));
  if (byCode) return byCode.field;

  const { field, target } = error.details as { field?: unknown; target?: unknown };
  const hints = [field, ...(Array.isArray(target) ? target : [target]), ...Object.keys(error.fieldErrors)]
    .filter((h): h is string => typeof h === 'string')
    .map((h) => h.toLowerCase());
  const byHint = rules.find((r) => hints.some((h) => r.hint.test(h)));
  if (byHint) return byHint.field;

  const byMessage = rules.find((r) => r.message.test(error.message));
  return byMessage ? byMessage.field : null;
}
