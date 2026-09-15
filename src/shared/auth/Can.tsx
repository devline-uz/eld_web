// owner: web-auth-rbac — <Can perm="vehicles" level="FULL">.
// A permission-less element is ABSENT from the DOM, never rendered disabled (web/tz.md §12.2).
import type { ReactNode } from 'react';
import { usePermission } from './usePermission';
import type { PermissionKey } from './permissions';

export function Can({
  perm,
  level = 'READ',
  children,
}: {
  perm: PermissionKey;
  level?: 'READ' | 'FULL';
  children: ReactNode;
}) {
  const { can } = usePermission();
  return can(perm, level) ? <>{children}</> : null;
}
