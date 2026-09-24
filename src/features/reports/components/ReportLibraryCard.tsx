// owner: web-reports-transfer — W-12 `Report library`: six rows exactly as drawn.
//
// B-14 (shipped 2026-09-24) — `RODS` and `IDLE_FUEL` are real job types. Their rows no longer
// redirect to the Activity report / sit inert (WD-042 superseded): each opens a small generate form
// and queues a PDF with `POST /reports/generate`, followed here to READY/FAILED (3 s policy) and
// announced with the `Report ready` toast. Generating is `reports` FULL, so for a read-only role the
// two rows are absent from the DOM (§12.2 — `Generate report` is removed, not disabled); WD-090.
import { useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Clock, FileText, Fuel, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthProvider';
import { usePermission } from '@/shared/auth/usePermission';
import type { PermissionKey, Role } from '@/shared/auth/permissions';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { useTrackedReport } from '../useReportJobs';
import { ActionAlert } from './ActionAlert';
import { GenerateLibraryReportModal, type LibraryReportType } from './GenerateLibraryReportModal';

interface LibraryItem {
  name: string;
  description: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  perm: PermissionKey;
  level?: 'READ' | 'FULL';
  blockedRoles?: Role[];
  /** Either a report screen, or a PDF job generated from the library itself. */
  target: { to: string } | { generate: LibraryReportType };
}

const LIBRARY_ITEMS: LibraryItem[] = [
  { name: 'IFTA mileage report', description: 'Quarterly fuel tax by jurisdiction', icon: FileText, target: { to: '/reports/ifta' }, perm: 'reports', blockedRoles: ['DISPATCHER'] },
  { name: 'FMCSA / DOT audit pack', description: 'Logs, DVIRs and unassigned driving', icon: ShieldCheck, target: { to: '/reports/fmcsa' }, perm: 'reportsTransfer' },
  { name: 'Activity report', description: 'Duty status totals per driver', icon: Clock, target: { to: '/reports/activity' }, perm: 'reports' },
  { name: 'DVIR report', description: 'Inspections and defect history', icon: ClipboardCheck, target: { to: '/reports/dvir' }, perm: 'reports', blockedRoles: ['DISPATCHER'] },
  { name: 'Driver logs (RODS)', description: 'Printable 8-day log sheets', icon: Users, target: { generate: 'RODS' }, perm: 'reports', level: 'FULL' },
  { name: 'Idle & fuel report', description: 'Idle time, fuel burn and MPG', icon: Fuel, target: { generate: 'IDLE_FUEL' }, perm: 'reports', level: 'FULL' },
];

export interface ReportLibraryCardProps {
  /** Carrier zone — the default range of a library-generated report. */
  timezone: string;
}

export function ReportLibraryCard({ timezone }: ReportLibraryCardProps) {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user } = useAuth();
  const role = user?.role;
  const [generating, setGenerating] = useState<LibraryReportType | null>(null);
  const job = useTrackedReport();
  const items = LIBRARY_ITEMS.filter((item) => can(item.perm, item.level) && !(role && item.blockedRoles?.includes(role)));

  return (
    <Card padded={false}>
      <div className="border-b border-border p-card">
        <SectionHeader title="Report library" />
      </div>
      <ul className="flex flex-col gap-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const { target } = item;
          return (
            <li key={item.name}>
              <button
                type="button"
                aria-haspopup={'generate' in target ? 'dialog' : undefined}
                onClick={() => {
                  if ('to' in target) navigate(target.to);
                  else setGenerating(target.generate);
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-bg-subtle"
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
      {job.error && (
        <div className="px-3 pb-3">
          <ActionAlert message={job.error} onDismiss={job.clearError} />
        </div>
      )}
      {generating && (
        <GenerateLibraryReportModal
          type={generating}
          timezone={timezone}
          onClose={() => setGenerating(null)}
          onQueued={(queued) => job.track(queued.reportId)}
        />
      )}
    </Card>
  );
}
