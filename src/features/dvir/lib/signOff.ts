import type { DefectStatus, RepairStatus } from '@/shared/api/dvir';

/**
 * QA CODE-035 — mirrors the backend sign-off rule (`signOffBlockReason` in
 * `eld_backend/src/modules/service/dvir-admin.service.ts`): a §396.11 sign-off certifies the
 * defects as repaired, deferred or not needing repair, so it is never `PENDING`, and `REPAIRED`
 * needs at least one defect and none still open. Returns why the sign-off is blocked, or `null`.
 */
export function signOffBlockReason(defects: ReadonlyArray<{ status: DefectStatus }>, repairStatus: RepairStatus): string | null {
  if (repairStatus === 'PENDING') return 'Choose Repaired, Deferred or Not required — a sign-off cannot stay pending.';
  if (repairStatus === 'REPAIRED') {
    if (defects.length === 0) return 'This DVIR lists no defects — sign it off as Not required.';
    if (defects.some((d) => d.status === 'OPEN' || d.status === 'IN_PROGRESS')) {
      return 'Resolve or defer every open defect before signing off as Repaired.';
    }
  }
  return null;
}
