// owner: web-auth-rbac — where the user was headed when RequireAuth sent them to /sign-in
// (web/bugs.md WB-081). The value comes from history state (or sessionStorage across a Google
// `signInWithRedirect` round trip), so it is untrusted: only a same-origin, in-app path is ever
// accepted. `//host`, `/\host`, `https://…`, `javascript:` and anything that resolves off-origin
// are refused — this is an open-redirect surface.

const RETURN_TO_STORAGE_KEY = 'obk.returnTo';
/** Paths that must never be a post-sign-in destination (they would loop or dead-end). */
const EXCLUDED_PREFIXES = ['/sign-in'];

export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048) return null;
  // A single leading slash; no protocol-relative `//` and no backslash (browsers read `\` as `/`).
  if (value[0] !== '/' || value[1] === '/' || value.includes('\\')) return null;
  for (let i = 0; i < value.length; i += 1) {
    // Control characters: the URL parser strips tab/newline, which could turn `/\t/x` into `//x`.
    if (value.charCodeAt(i) < 0x20 || value.charCodeAt(i) === 0x7f) return null;
  }
  let url: URL;
  try {
    url = new URL(value, window.location.origin);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  const path = url.pathname;
  if (EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return null;
  }
  return `${path}${url.search}${url.hash}`;
}

/** Survives the `signInWithRedirect` page navigation, which drops history state. */
export function rememberReturnPath(value: unknown): void {
  const safe = safeReturnPath(value);
  try {
    if (safe) window.sessionStorage.setItem(RETURN_TO_STORAGE_KEY, safe);
  } catch {
    /* storage disabled — the user lands on the dashboard instead */
  }
}

export function forgetReturnPath(): void {
  try {
    window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
  } catch {
    /* nothing to forget */
  }
}

/** Reads the path stored before a redirect round trip (pure — safe in a state initializer). */
export function readRememberedReturnPath(): string | null {
  try {
    return safeReturnPath(window.sessionStorage.getItem(RETURN_TO_STORAGE_KEY));
  } catch {
    return null;
  }
}
