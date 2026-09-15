// owner: web-reports-transfer — W-12 `Report library`: six rows exactly as drawn.
//
// ⛔ Gap B-14 — `ReportType` has no `RODS` / `IDLE_FUEL`. Both rows stay in the list (never dropped):
// `Driver logs (RODS)` opens the Activity report, the v1 mapping in web/tz.md W-12; `Idle & fuel
// report` has no screen and no job type, so its row is inert (`aria-disabled`) — web/decisions.md
// WD-042.
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Clock, FileText, Fuel, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { usePermission } from '@/shared/auth/usePermission';
import type { PermissionKey, Role } from '@/shared/auth/permissions';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';

interface LibraryItem {
  name: string;
  description: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  to: string | null;
  perm: PermissionKey;
  blockedRoles?: Role[];
}

const LIBRARY_ITEMS: LibraryItem[] = [
  { name: 'IFTA mileage report', description: 'Quarterly fuel tax by jurisdiction', icon: FileText, to: '/reports/ifta', perm: 'reports', blockedRoles: ['DISPATCHER'] },
  { name: 'FMCSA / DOT audit pack', description: 'Logs, DVIRs and unassigned driving', icon: ShieldCheck, to: '/reports/fmcsa', perm: 'reportsTransfer' },
  { name: 'Activity report', description: 'Duty status totals per driver', icon: Clock, to: '/reports/activity', perm: 'reports' },
  { name: 'DVIR report', description: 'Inspections and defect history', icon: ClipboardCheck, to: '/reports/dvir', perm: 'reports', blockedRoles: ['DISPATCHER'] },
  { name: 'Driver logs (RODS)', description: 'Printable 8-day log sheets', icon: Users, to: '/reports/activity', perm: 'reports' },
  { name: 'Idle & fuel report', description: 'Idle time, fuel burn and MPG', icon: Fuel, to: null, perm: 'reports' },
];

export function ReportLibraryCard() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const role = user?.role;
  const items = LIBRARY_ITEMS.filter((item) => can(item.perm) && !(role && item.blockedRoles?.includes(role)));

  return (
    <Card padded={false}>
      <div className="border-b border-border p-card">
        <SectionHeader title="Report library" />
      </div>
      <ul className="flex flex-col gap-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const inert = item.to === null;
          return (
            <li key={item.name}>
              <button
                type="button"
                aria-disabled={inert || undefined}
                onClick={() => {
                  if (item.to) navigate(item.to);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left',
                  inert ? 'cursor-default' : 'hover:bg-bg-subtle',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bg-subtle text-text-secondary">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span className="flex-1">
                  <span className="block text-body-strong text-text">{item.name}</span>
                  <span className="block text-card-sub text-text-muted">{item.description}</span>
                </span>
                <ChevronRight size={16} strokeWidth={1.75} className="text-text-muted" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
