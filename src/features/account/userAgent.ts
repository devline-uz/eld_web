// owner: web-auth-rbac — W-26 `DEVICE` column (`MacBook Pro · Chrome 129`).
// The backend stores the raw User-Agent only; the label is derived for display and never sent
// back. A stored `deviceLabel` always wins. Unknown agents fall back to the raw string.

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/(\d+)[\d.]* .*Safari\//, 'Safari'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/Windows/, 'Windows PC'],
  [/CrOS/, 'Chromebook'],
  [/Linux/, 'Linux'],
];

export const UNKNOWN_DEVICE = 'Unknown device';

export function deviceLabel(userAgent: string | null, stored?: string | null): string {
  if (stored && stored.trim()) return stored.trim();
  if (!userAgent || !userAgent.trim()) return UNKNOWN_DEVICE;

  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1];
  let browser: string | undefined;
  for (const [re, name] of BROWSERS) {
    const match = re.exec(userAgent);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  if (!system && !browser) return userAgent.trim();
  return [system, browser].filter(Boolean).join(' · ');
}
