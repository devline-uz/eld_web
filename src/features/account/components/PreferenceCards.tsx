// owner: web-auth-rbac — W-26 `Notifications` and `Language & region` (web/tz.md §10 W-26: not
// drawn, "continued cards on this page"). The topbar Account menu (11.26) and the Notifications
// panel deep-link to `#notifications` and `#language`, so both anchors exist.
//
// `Language & region` saves through `GET/PUT /me/preferences` (B-11, shipped; PUT is a full
// replace, so the saved object is merged, never patched — the saved views and table columns in
// the same row survive). `Notifications` stays an honest empty state: the preferences DTO has no
// per-event channel matrix, so a checkbox grid would silently drop the choice (WD-061).
import { BellOff } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { toUserMessage } from '@/shared/api/errors';
import { useMyPreferences, useUpdateMyPreferences, type MyPreferences } from '@/shared/api/me';
import { BROWSER_TIMEZONE } from '@/shared/format';
import { Button } from '@/shared/ui/Button';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { TOAST_COPY } from '@/shared/ui/copy';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/Toast';

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
      id={`account-section-${id}`}
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

type Option = { value: string; label: string };

const LANGUAGES: Option[] = [{ value: 'en', label: 'English' }];
const TIME_ZONES: Option[] = [
  { value: 'America/New_York', label: 'America/New_York (Eastern)' },
  { value: 'America/Chicago', label: 'America/Chicago (Central)' },
  { value: 'America/Denver', label: 'America/Denver (Mountain)' },
  { value: 'America/Phoenix', label: 'America/Phoenix (Arizona)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific)' },
  { value: 'America/Anchorage', label: 'America/Anchorage (Alaska)' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (Hawaii)' },
];
const DATE_FORMATS: Option[] = [
  { value: 'MMM D, YYYY', label: 'MMM D, YYYY (Sep 24, 2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (09/24/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-09-24)' },
];
const DISTANCE_UNITS: Option[] = [
  { value: 'MILES', label: 'Miles' },
  { value: 'KM', label: 'Kilometers' },
];

type RegionValues = Required<Pick<MyPreferences, 'language' | 'timezone' | 'dateFormat' | 'distanceUnit'>>;

/** Server value, else the panel's defaults (English, the browser zone, `MMM D, YYYY`, miles). */
function regionFrom(prefs: MyPreferences): RegionValues {
  return {
    language: prefs.language || 'en',
    timezone: prefs.timezone || BROWSER_TIMEZONE(),
    dateFormat: prefs.dateFormat || 'MMM D, YYYY',
    distanceUnit: prefs.distanceUnit ?? 'MILES',
  };
}

/** A saved or browser value that is not in the list still shows (and round-trips) as itself. */
function withCurrent(options: Option[], value: string): Option[] {
  return options.some((o) => o.value === value) ? options : [{ value, label: value }, ...options];
}

function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-text-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-input w-full rounded-md border border-border bg-bg-surface px-3 text-body text-text disabled:bg-bg-subtle"
      >
        {withCurrent(options, value).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RegionForm({ prefs }: { prefs: MyPreferences }) {
  const { toast } = useToast();
  const update = useUpdateMyPreferences();
  const saved = regionFrom(prefs);
  const [draft, setDraft] = useState<RegionValues>(saved);
  const [banner, setBanner] = useState<string | null>(null);
  const dirty = (Object.keys(saved) as (keyof RegionValues)[]).some((k) => saved[k] !== draft[k]);
  const set = (key: keyof RegionValues) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  function save() {
    setBanner(null);
    // Full replace: everything else in the row (savedViews, tableColumns) is sent back unchanged.
    update.mutate(
      { ...prefs, ...draft },
      {
        onSuccess: () => toast({ kind: 'success', ...TOAST_COPY.settingsSaved }),
        onError: (error) => setBanner(toUserMessage(error)),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {banner ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
          {banner}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Language" value={draft.language} options={LANGUAGES} disabled={update.isPending} onChange={set('language')} />
        <SelectField label="Time zone" value={draft.timezone} options={TIME_ZONES} disabled={update.isPending} onChange={set('timezone')} />
        <SelectField label="Date format" value={draft.dateFormat} options={DATE_FORMATS} disabled={update.isPending} onChange={set('dateFormat')} />
        <SelectField label="Distance unit" value={draft.distanceUnit} options={DISTANCE_UNITS} disabled={update.isPending} onChange={set('distanceUnit')} />
      </div>
      <p className="text-caption text-text-muted">
        HOS logs always use the driver&apos;s home terminal time zone.
      </p>
      {dirty ? (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="lg" disabled={update.isPending} onClick={() => setDraft(saved)}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" loading={update.isPending} onClick={save}>
            Save changes
          </Button>
        </div>
      ) : null}
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
  const prefs = useMyPreferences();
  return (
    <AnchoredCard id="language" title="Language & region">
      {prefs.isPending ? (
        <LoadingState rows={2} />
      ) : prefs.isError ? (
        <ErrorState
          title="Could not load your preferences"
          description="Try again in a moment."
          onRetry={() => void prefs.refetch()}
        />
      ) : (
        <RegionForm prefs={prefs.data} />
      )}
    </AnchoredCard>
  );
}
