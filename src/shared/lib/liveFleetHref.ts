/** W-02 deep link — `Track on map` (Vehicles row menu, Unit profile) opens Live Fleet with that
 * unit selected via `?unit=<vehicleId>`; `LiveFleetPage` selects it (the map flies to it and the
 * list scrolls to it) and drops the param when the detail card is closed. No id ⇒ the plain page. */
export function liveFleetHref(vehicleId?: string | null): string {
  return vehicleId ? `/live-fleet?${new URLSearchParams({ unit: vehicleId }).toString()}` : '/live-fleet';
}
