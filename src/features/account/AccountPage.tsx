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
  useEffect(() => {
    const id = location.hash.slice(1);
    const section = id ? document.getElementById(id) : null;
    if (!section) return;
    section.scrollIntoView({ block: 'start' });
    section.focus({ preventScroll: true });
  }, [location.hash, profile.isPending]);

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
