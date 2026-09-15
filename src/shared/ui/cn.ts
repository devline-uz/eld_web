import clsx from 'clsx';

export type ClassValue = Parameters<typeof clsx>[number];

/** Tiny className combinator — no design literals here, only ever class *names*. */
export function cn(...values: ClassValue[]): string {
  return clsx(...values);
}
