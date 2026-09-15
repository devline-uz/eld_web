// owner: web-auth-rbac — W-26 `Notifications` and `Language & region` (web/tz.md §10 W-26: not
// drawn, "continued cards on this page"). The topbar Account menu (11.26) and the Notifications
// panel deep-link to `#notifications` and `#language`, so both anchors exist.
//
// Nothing here can be saved: there is no `/me/preferences` (B-11). The cards state only what the
// panel really does today — no checkbox matrix or selector that would silently drop a choice
// (web/decisions.md WD-061).
import { BellOff } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { BROWSER_TIMEZONE } from '@/shared/format';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/states';

function AnchoredCard({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const titleId = `account-${id}-title`;
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="scroll-mt-page focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card padded={false}>
        <div className="border-b border-border px-card py-4">
          <SectionHeader title={<span id={titleId}>{title}</span>} subtitle={subtitle} />
        </div>
        <div className="p-card">{children}</div>
      </Card>
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        readOnly
        value={value}
        className="h-input w-full rounded-md border border-border bg-bg-subtle px-3 text-body text-text-secondary"
      />
    </div>
  );
}

export function NotificationsCard() {
  return (
    <AnchoredCard id="notifications" title="Notifications">
      <EmptyState
        icon={<BellOff size={24} strokeWidth={1.75} aria-hidden="true" />}
        title="Personal notification settings are not available yet"
        description="Alerts follow your organisation's alert rules and arrive in the app and by email."
      />
    </AnchoredCard>
  );
}

export function LanguageCard() {
  return (
    <AnchoredCard id="language" title="Language & region">
      <div className="grid grid-cols-2 gap-4">
        <ReadOnlyField label="Language" value="English" />
        <ReadOnlyField label="Time zone" value={BROWSER_TIMEZONE()} />
        <ReadOnlyField label="Date format" value="MMM D, YYYY" />
        <ReadOnlyField label="Distance unit" value="Miles" />
      </div>
    </AnchoredCard>
  );
}
