// owner: web-settings-admin — puts a 400/422's issues onto the form fields a Settings modal
// actually renders. Whatever is left is spelled out by `formErrorMessage` (shared/api/errors) in the
// modal's banner — before this, an issue on a field the modal did not render came back as the bare
// "Check the highlighted fields and try again." with nothing highlighted.
import { ApiError, formErrorMessage } from '@/shared/api/errors';

/**
 * `fields` maps a server issue path (`roleId`, `conditions.0.event`) to the form field that shows
 * it. An exact path wins, then its first segment. Returns the server paths it placed — pass them to
 * `formErrorMessage(error, placed, labels)` so only the rest reach the banner.
 */
export function placeServerFieldErrors<F extends string>(
  error: unknown,
  fields: Readonly<Record<string, F>>,
  place: (field: F, message: string) => void,
): string[] {
  if (!(error instanceof ApiError) || (error.status !== 400 && error.status !== 422)) return [];
  const placed: string[] = [];
  const taken = new Set<F>();
  for (const [path, message] of Object.entries(error.fieldErrors)) {
    const head = path.split('.')[0] ?? '';
    const field = Object.hasOwn(fields, path) ? fields[path] : Object.hasOwn(fields, head) ? fields[head] : undefined;
    if (!field) continue;
    placed.push(path);
    // The first issue per field is the one shown; later ones on the same field are still "placed".
    if (taken.has(field)) continue;
    taken.add(field);
    place(field, message);
  }
  return placed;
}

/**
 * The banner copy after `placeServerFieldErrors`: `null` when every issue already sits on a field
 * (the red fields are the feedback), otherwise `formErrorMessage` for whatever is left — the
 * unplaced issues spelled out, or the §14.3 copy for a non-validation failure.
 */
export function serverErrorBanner(
  error: unknown,
  placed: readonly string[],
  labels: Readonly<Record<string, string>> = {},
): string | null {
  if (
    placed.length > 0 &&
    error instanceof ApiError &&
    Object.keys(error.fieldErrors).every((path) => placed.includes(path))
  ) {
    return null;
  }
  return formErrorMessage(error, placed, labels);
}
