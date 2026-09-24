// WB-249 — the carrier profile query on its own: the sidebar organisation card mounts it on every
// screen, and importing it from `settingsAdmin.ts` hoisted that whole Settings module into the
// initial chunk. `settingsAdmin.ts` re-exports everything here, so feature imports are unchanged.
import { useQuery } from '@tanstack/react-query';
import { client } from './client';
import { endpoints } from './endpoints';
import { qk } from './queryKeys';
import { typedCachePolicy } from './queryPolicy';

export type HosRuleset =
  | 'US_70_8_PROPERTY'
  | 'US_60_7_PROPERTY'
  | 'US_70_8_PASSENGER'
  | 'US_60_7_PASSENGER';

export interface CarrierRow {
  id: string;
  name: string;
  dotNumber: string;
  mcNumber?: string | null;
  ein?: string | null;
  timezone: string;
  hosRuleset?: HosRuleset;
  distanceUnit?: 'MILES' | 'KILOMETERS';
  cycleRestart?: boolean;
  unassignedThresholdMin?: number;
  dvirRetentionMonths?: number;
  allowPersonalConveyance?: boolean;
  allowYardMove?: boolean;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  complianceEmail?: string | null;
  eldIdentifier?: string | null;
  eldRegistrationId?: string | null;
  erodsMode: 'TEST' | 'PRODUCTION';
}

export function useCarrier() {
  return useQuery({
    queryKey: qk.carrier,
    queryFn: ({ signal }) => client.get<CarrierRow>(endpoints.carrier.root, { signal }),
    ...typedCachePolicy<CarrierRow>('reference'),
  });
}
