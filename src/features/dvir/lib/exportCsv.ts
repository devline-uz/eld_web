// owner: web-dvir-safety — W-09 header `Export`. There is no server-side export for any of the
// four lists, so the file is the rows the active tab is showing, as CSV like every other table
// export in the panel (Vehicles selection, Safety, Audit log). Timestamps stay ISO-8601 UTC.
import { toCsv } from '@/shared/lib/csv';
import type {
  DefectTableRow,
  DvirTableRow,
  ScheduleTableRow,
  WorkOrderTableRow,
} from '@/shared/api/dvir';

type Cell = string | number | null | undefined;

const driverName = (row: DvirTableRow): string =>
  row.driver ? `${row.driver.firstName} ${row.driver.lastName}` : '';

export function dvirsCsv(rows: readonly DvirTableRow[]): string {
  return toCsv([
    ['submittedAt', 'unit', 'driver', 'type', 'condition', 'repairStatus', 'defects', 'odometerMi', 'location'],
    ...rows.map((r): Cell[] => [
      r.submittedAt,
      r.vehicle?.unitNumber,
      driverName(r),
      r.type,
      r.vehicleCondition,
      r.repairStatus,
      r.defects.map((d) => d.category).join('; '),
      r.odometerMi,
      r.locationName,
    ]),
  ]);
}

export function defectsCsv(rows: readonly DefectTableRow[]): string {
  return toCsv([
    ['reportedAt', 'unit', 'part', 'category', 'severity', 'status', 'outOfService', 'description'],
    ...rows.map((r): Cell[] => [
      r.createdAt,
      r.vehicle?.unitNumber,
      r.part,
      r.category,
      r.severity,
      r.status,
      r.outOfService ? 'yes' : 'no',
      r.description,
    ]),
  ]);
}

export function workOrdersCsv(rows: readonly WorkOrderTableRow[]): string {
  return toCsv([
    ['number', 'unit', 'title', 'priority', 'status', 'vendor', 'costUsd', 'openedAt', 'dueAt', 'closedAt'],
    ...rows.map((r): Cell[] => [
      r.number,
      r.vehicle?.unitNumber,
      r.title,
      r.priority,
      r.status,
      r.vendor,
      r.costUsd === null ? null : String(r.costUsd),
      r.openedAt,
      r.dueAt,
      r.closedAt,
    ]),
  ]);
}

export function schedulesCsv(rows: readonly ScheduleTableRow[]): string {
  return toCsv([
    ['name', 'unit', 'intervalMi', 'intervalDays', 'lastServiceMi', 'lastServiceAt', 'nextDueMi', 'nextDueAt', 'dueState'],
    ...rows.map((r): Cell[] => [
      r.name,
      r.vehicle?.unitNumber,
      r.intervalMi,
      r.intervalDays,
      r.lastServiceMi,
      r.lastServiceAt,
      r.nextDueMi,
      r.nextDueAt,
      r.due.state,
    ]),
  ]);
}
