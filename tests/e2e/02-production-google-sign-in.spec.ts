// web/tz.md §18.1 scenario 2 — production mode: `Continue with Google` → Dashboard;
// an uninvited Gmail shows the USER_NOT_INVITED banner; a blocked popup falls back to
// signInWithRedirect.
import { test } from '@playwright/test';

test.fixme(
  'Continue with Google → Dashboard; USER_NOT_INVITED banner; blocked popup falls back to signInWithRedirect',
  async () => {
    // Needs: web-auth-rbac's production-mode Google sign-in (Firebase signInWithPopup) wired,
    // plus a Firebase emulator or a stubbed google auth response to run headlessly in CI.
  },
);
