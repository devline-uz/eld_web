import type { LucideIcon } from 'lucide-react';

/** One local palette entry — a page or an action, already filtered by permission. */
export interface PaletteCommand {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Permitted pages (sidebar + settings sub-nav). */
  pages: PaletteCommand[];
  /** Permitted static actions (`Request a log edit`, `Send FMCSA pack to inspector`, …). */
  actions: PaletteCommand[];
  canSearchDrivers: boolean;
  canSearchVehicles: boolean;
  /** Adds `Open HOS logs for <driver>` for the top driver hit. */
  canOpenHosLogs: boolean;
}
