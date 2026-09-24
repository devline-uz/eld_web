// owner: web-auth-rbac — W-26 profile photo pre-check (B-51). The server re-validates; this only
// saves a round trip and gives the exact reason before a 5 MB upload starts.
import { AVATAR_MIME_TYPES } from '@/shared/api/me';

/** B-51 limits, mirrored from `users.service.ts` (`AVATAR_MAX_BYTES`, 256 px minimum). */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIN_PX = 256;
export const AVATAR_COPY = {
  type: 'Choose a PNG or JPG image.',
  size: 'The photo must be 5 MB or smaller.',
  small: 'The image must be a PNG or JPG of at least 256 × 256 pixels.',
} as const;

/** Pixel size of an image file, or `null` when the browser cannot tell (the server decides). */
async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/** The client-side pre-check — `null` when the file may be sent. */
export async function avatarProblem(file: File): Promise<string | null> {
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) return AVATAR_COPY.type;
  if (file.size > AVATAR_MAX_BYTES) return AVATAR_COPY.size;
  const size = await imageSize(file);
  if (size && (size.width < AVATAR_MIN_PX || size.height < AVATAR_MIN_PX)) return AVATAR_COPY.small;
  return null;
}
