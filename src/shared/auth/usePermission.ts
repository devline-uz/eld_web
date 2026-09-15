// owner: web-auth-rbac — can('vehicles', 'FULL') (web/tz.md §6.9).
import { useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { hasPermission, type PermissionKey } from './permissions';

export function usePermission() {
  const { permissions } = useAuth();
  const can = useCallback(
    (key: PermissionKey, level: 'READ' | 'FULL' = 'READ') => hasPermission(permissions, key, level),
    [permissions],
  );
  return { can, permissions };
}
