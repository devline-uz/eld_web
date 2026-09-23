// owner: web-design-system — the exact copy tables from web/tz.md §13.2 and §13.3.
// Strings live here, typed by key, so no feature invents its own wording.

export interface EmptyStateCopy {
  title: string;
  description?: string;
  actions?: string[];
}

/** §13.2 — verbatim. */
export const EMPTY_STATE_COPY = {
  vehicles: {
    title: 'No vehicles yet',
    description: 'Add your first unit or import a CSV to start recording hours of service.',
    actions: ['Import CSV', 'Add vehicle'],
  },
  drivers: {
    title: 'No drivers yet',
    description: 'Add drivers so they can sign in to the mobile app and start logging hours.',
    actions: ['Import CSV', 'Add driver'],
  },
  liveFleet: {
    title: 'No units are reporting',
    description: 'Units appear here as soon as a driver connects to an ELD over Bluetooth.',
    actions: ['View vehicles'],
  },
  hosLogsDay: {
    title: 'No ELD records for this day',
    description: 'The driver may have been off duty or the app was not signed in.',
  },
  hosLogsNoDriver: {
    title: 'Select a driver to view their log',
  },
  dvir: {
    title: 'No inspections in this period',
    description: 'Drivers submit pre-trip and post-trip inspections from the mobile app.',
    actions: ['Change period'],
  },
  openDefects: {
    title: 'No open defects',
    description: 'Every reported defect has been corrected.',
  },
  safety: {
    title: 'No safety events',
    description: 'Harsh braking, acceleration and speeding events appear here as they are detected.',
  },
  // Not in §13.2 — W-10 `Coaching` / `Scorecards` tabs (WD-075).
  safetyCoaching: {
    title: 'No coaching sessions',
    description: 'Events marked as coached in the last 30 days appear here.',
  },
  safetyScorecard: {
    title: 'No scorecards yet',
    description: 'Driver scores appear here once drivers have logged miles in the scoring period.',
  },
  trips: {
    title: 'No active trips',
    description: 'Create a trip to dispatch a load to a driver.',
    actions: ['Create trip'],
  },
  unassignedLoads: {
    title: 'No loads waiting',
    description: 'Every load has a driver assigned.',
  },
  messages: {
    title: 'No conversations yet',
    description: 'Start a conversation with a driver or send a broadcast to the fleet.',
    actions: ['New'],
  },
  reports: {
    title: 'No reports generated yet',
    description: 'Generated reports are kept for 24 months.',
    actions: ['Generate report'],
  },
  auditLog: {
    title: 'No events match these filters',
    description: 'Try a wider date range or clear the filters.',
    actions: ['Reset filters'],
  },
  notifications: {
    title: 'You are all caught up',
    description: 'New violations, alerts and reports appear here.',
  },
  support: {
    title: 'No tickets yet',
    description: 'Open a ticket and our team replies within about four hours.',
    actions: ['New ticket'],
  },
} as const satisfies Record<string, EmptyStateCopy>;

export type EmptyStateKey = keyof typeof EMPTY_STATE_COPY;

/** Search results carry the query into the sentence — built, not looked up by key. */
export function searchEmptyState(query: string): Required<Pick<EmptyStateCopy, 'title' | 'description' | 'actions'>> {
  return {
    title: `Nothing matches "${query}"`,
    description: 'Check the spelling or try a unit number, VIN or username.',
    actions: ['Clear search'],
  };
}

export interface ToastCopy {
  title: string;
  description?: string;
}

/** §13.3 — verbatim. */
export const TOAST_COPY = {
  unitCreated: (unitNumber: string, eldSerial: string): ToastCopy => ({
    title: `Unit #${unitNumber} created`,
    description: `ELD ${eldSerial} paired and the driver was notified.`,
  }),
  unitDeleted: (unitNumber: string): ToastCopy => ({
    title: `Unit #${unitNumber} deleted`,
    description: 'Historical logs and DVIRs are still available for audits.',
  }),
  driverAdded: (email: string): ToastCopy => ({
    title: 'Driver added',
    description: `An invitation was sent to ${email}.`,
  }),
  importFinished: (created: number, updated: number, failed: number, total: number): ToastCopy => ({
    title: `${total} units imported`,
    description: `${created} created · ${updated} updated · ${failed} failed.`,
  }),
  editRequestSent: (driverName: string): ToastCopy => ({
    title: 'Edit request sent',
    description: `${driverName} must accept it in the mobile app before the log changes.`,
  }),
  certified: (days: number, driverName: string): ToastCopy => ({
    title: `${days} day${days === 1 ? '' : 's'} certified`,
    description: `Certified on behalf of ${driverName} · written to the audit log.`,
  }),
  segmentsAssigned: (count: number): ToastCopy => ({
    title: `${count} segment${count === 1 ? '' : 's'} assigned`,
    description: 'Hours were recalculated for the affected drivers.',
  }),
  transferSent: {
    title: 'Transfer sent',
    description: 'The file was accepted by the FMCSA endpoint.',
  },
  transferTestMode: {
    title: 'Transfer completed in test mode',
    description: 'The file was not sent to FMCSA. Download a copy for the officer.',
  },
  transferFailed: {
    title: 'Data transfer failed',
    description: 'The FMCSA endpoint returned 503. Retry or send by email.',
  },
  reportReady: (sizeLabel: string): ToastCopy => ({
    title: 'Report ready',
    description: `FMCSA audit pack · ${sizeLabel}`,
  }),
  logsUncertified: (count: number, dateRange: string): ToastCopy => ({
    title: `${count} logs still uncertified`,
    description: `Two drivers have not signed logs for ${dateRange}.`,
  }),
  forbidden: {
    title: 'You do not have permission to do that.',
  },
  networkError: {
    title: 'Could not reach the server',
    description: 'Check your connection and try again.',
  },
  settingsSaved: {
    title: 'Settings saved',
  },
  reconnected: {
    title: 'Reconnected',
    description: 'Live data resumed.',
  },
  /** W-03 bulk action — not in §13.3's table; named consistently with `unitDeleted`. */
  unitsSetInactive: (count: number): ToastCopy => ({
    title: `${count} unit${count === 1 ? '' : 's'} set inactive`,
    description: 'Historical logs and DVIRs are still available for audits.',
  }),
  /** W-03 bulk action, partial failure — the units that did change are named, the rest are not
   * claimed as done. */
  unitsSetInactiveFailed: (failed: number, total: number): ToastCopy => ({
    title: `${failed} of ${total} unit${total === 1 ? '' : 's'} could not be set inactive`,
    description: 'Those units are unchanged. Try again.',
  }),
  /** 11.1 · Create a geofence — not in §13.3's table; named consistently with `unitCreated`. */
  geofenceCreated: (name: string): ToastCopy => ({
    title: 'Geofence created',
    description: `${name} will start triggering arrival and departure events.`,
  }),
  /** WB-074 · W-09 Work orders tab row actions — not in §13.3's table; named consistently with
   * `unitDeleted`/`unitCreated`. */
  workOrderClosed: (number: string): ToastCopy => ({
    title: `Work order ${number} closed`,
    description: 'The unit and any attached defects were updated.',
  }),
  workOrderCancelled: (number: string): ToastCopy => ({
    title: `Work order ${number} cancelled`,
    description: 'No further work is scheduled against it.',
  }),
  workOrderUpdated: (number: string): ToastCopy => ({
    title: `Work order ${number} updated`,
  }),
  /** WB-074 · W-09 Schedules tab row actions — not in §13.3's table. */
  scheduleCompleted: (name: string): ToastCopy => ({
    title: `${name} marked complete`,
    description: 'The next due date was recalculated.',
  }),
  scheduleUpdated: (name: string): ToastCopy => ({
    title: `${name} updated`,
  }),
  scheduleDeleted: (name: string): ToastCopy => ({
    title: `${name} deleted`,
    description: 'Historical service records stay in place for audits.',
  }),
} as const;
