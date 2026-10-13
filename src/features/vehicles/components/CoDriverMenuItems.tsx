// owner: web-vehicles-drivers — W-03 row `⋯` co-driver actions (B-7). Rendered inside the row's
// DropdownMenu.Content, which Radix mounts only while that menu is open — so the active-pairing
// lookup runs for the one unit whose menu is open (no per-row N+1, no 200-row page cap), and it
// shares the `qk.coDriverPairings({ vehicleId, active, limit: 1 })` cache entry with W-04.
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useCoDriverPairings, type CoDriverPairingRow, type VehicleTableRow } from '@/shared/api/vehicles';
import { NO_PRIMARY_DRIVER_CO_DRIVER_REASON } from '../lib/copy';

const ITEM_CLASS =
  'cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle data-[disabled]:cursor-not-allowed data-[disabled]:text-text-muted';

export function CoDriverMenuItems({
  row,
  onAssign,
  onEnd,
}: {
  row: VehicleTableRow;
  onAssign: (row: VehicleTableRow) => void;
  onEnd: (row: VehicleTableRow, pairing: CoDriverPairingRow) => void;
}) {
  const pairingQuery = useCoDriverPairings({ vehicleId: row.id, active: true, limit: 1 });
  const pairing = pairingQuery.data?.items[0] ?? null;

  if (pairing) {
    return (
      <DropdownMenu.Item onSelect={() => onEnd(row, pairing)} className={ITEM_CLASS}>
        End co-driver pairing
      </DropdownMenu.Item>
    );
  }

  // Until the lookup answers we cannot tell "assign" from "end", so the item waits disabled.
  const reason = !row.driver ? NO_PRIMARY_DRIVER_CO_DRIVER_REASON : undefined;
  const disabled = !row.driver || !pairingQuery.isSuccess;
  return (
    <DropdownMenu.Item
      disabled={disabled}
      aria-busy={row.driver && pairingQuery.isPending ? true : undefined}
      title={reason}
      onSelect={() => {
        if (!disabled) onAssign(row);
      }}
      className={ITEM_CLASS}
    >
      Assign co-driver
    </DropdownMenu.Item>
  );
}
