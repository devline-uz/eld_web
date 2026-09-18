// Route guards — web/tz.md §9, §6.9. The order is fixed and never varies:
//   isAuthenticated → can(perm)
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import { RouteFallback } from './layouts/RouteFallback';

/** 1 — signed in? Otherwise /sign-in, remembering where the user was headed. */
export function RequireAuth() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <RouteFallback />;
  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search + location.hash }} />;
  }
  return <Outlet />;
}
