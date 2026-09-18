// owner: web-auth-rbac — W-26 My profile (web/tz.md §10 W-26, §4.6, §6.8).
// Design: web/roles and screens/admin panel/Personal account — profile, security, sessions.jpg
//
// Route `/account`, every role, no permission key. One long page: the `MY ACCOUNT` sub-nav, the
// topbar Account menu (11.26) and the Notifications panel link to the section anchors
// `#profile`, `#security`, `#notifications`, `#language`, `#sessions` — the section is scrolled
// into view and focused on load. `Notifications` / `Language & region` are read-only until B-11.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDynamicSubtitle } from '@/app/layouts/Topbar';
import { isApiError } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthProvider';
import { ForbiddenState } from '@/shared/ui/states';
import { useMyProfile } from './api';
import { LanguageCard, NotificationsCard } from './components/PreferenceCards';
import { ProfileCard } from './components/ProfileCard';
import { SecurityCard } from './components/SecurityCard';
import { SessionsCard } from './components/SessionsCard';

export default function AccountPage() {
  const { user } = useAuth();
  const profile = useMyProfile();
  const location = useLocation();

  // `Sarah Chen · Admin · Universal Logistics Inc.` — the real name and role, never the mock's.
  const name = profile.data
    ? `${profile.data.firstName} ${profile.data.lastName}`.trim()
    : (user?.fullName ?? null);
  const subtitle =
    [name, profile.data?.role.name, user?.carrierName].filter(Boolean).join(' · ') || null;
  useDynamicSubtitle(subtitle);

  // Scroll + focus the anchored section; again once the profile has loaded, because the cards
  // above the anchor grow from their skeletons and would push it out of view.
  //
  // The section elements are NOT given `id="profile"` / `id="sessions"` etc. (matching the URL
  // hash exactly) — Chrome's own fragment navigation retries `getElementById(hash)` for a few
  // seconds after load until a match appears in the DOM, and fires its own native scroll the
  // moment `SessionsCard` etc. mount. That native scroll walks `<main>` AND `<html>` and, once it
  // interleaves with this effect, leaves `<html>` holding a scroll position it should never have
  // had — dragging the fixed Sidebar off-screen with it (web/bugs.md WB-052). The `account-section-`
  // prefix (below and in each card's own `id`) keeps the hash from ever matching a real id, so
  // only this effect scrolls, and only `#main-content` (the real scroll owner at `xl:` widths,
  // AppShell's `xl:overflow-y-auto`) ever moves; below `xl:`, where `<main>` does not scroll on
  // its own, this falls back to the native whole-page `scrollIntoView`.
  useEffect(() => {
    const id = location.hash.slice(1);
    const section = id ? document.getElementById(`account-section-${id}`) : null;
    if (!section) return;
    const container = document.getElementById('main-content');
    if (container && container.scrollHeight > container.clientHeight) {
      container.scrollTop += section.getBoundingClientRect().top - container.getBoundingClientRect().top;
    } else {
      section.scrollIntoView({ block: 'start' });
    }
    section.focus({ preventScroll: true });
    // `location.key` too (WB-082): navigating to the hash you are already on (the account menu,
    // the notifications panel) is a new history entry with the same hash, and must scroll again.
  }, [location.key, location.hash, profile.isPending]);

  if (isApiError(profile.error) && profile.error.isForbidden) {
    return <ForbiddenState screenName="My profile" />;
  }

  return (
    <div className="flex flex-col gap-card-gap">
      <ProfileCard query={profile} />
      <SecurityCard query={profile} />
      <NotificationsCard />
      <LanguageCard />
      <SessionsCard />
    </div>
  );
}
