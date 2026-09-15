import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS 4 is CSS-first: every design token (web/tz.md §3) is declared on `:root`
 * and bound into the theme through `@theme` in `src/shared/ui/tokens.css`.
 * This file only pins the template sources, so a class name that exists solely in a
 * `.tsx` string constant is never tree-shaken away.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config;
