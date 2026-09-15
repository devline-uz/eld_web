// owner: web-auth-rbac — W-26 section anchors, in sub-nav order (app/navigation.ts ACCOUNT_NAV).
// The topbar Account menu (11.26) and the Notifications panel link to these ids.
export const ACCOUNT_SECTIONS = ['profile', 'security', 'notifications', 'language', 'sessions'] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];
