// owner: web-vehicles-drivers — the `CreateDriverDto` / `UpdateDriverDto` limits (eld_backend
// modules/drivers/dto/drivers.dto.ts) the shared driver field rules do not carry, and the labels a
// 422 issue path is spelled out with when the form has no field of its own for it. A value past one
// of these limits used to go out and come back as a 422 the form never showed.
export const DRIVER_DTO_LIMITS = {
  firstName: 80,
  lastName: 80,
  /** `password: z.string().min(8).max(72)` — bcrypt's 72-byte ceiling. */
  password: 72,
  /** `homeTerminalName: z.string().trim().max(120).optional()` — optional on create. */
  homeTerminalName: 120,
  eldExemptReason: 200,
} as const;

export function tooLongMessage(label: string, max: number): string {
  return `${label} must be ${max} characters or fewer.`;
}

/** Backend issue path → the label the driver modals show for it. */
export const DRIVER_FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  username: 'Username',
  password: 'Password',
  email: 'Email address',
  phone: 'Phone number',
  cdlNumber: 'Driver licence number',
  cdlState: 'Issuing state',
  homeTerminalName: 'Home terminal',
  homeTerminalTimezone: 'Home terminal time zone',
  assignedVehicleId: 'Assigned unit',
  eldExemptReason: 'Exemption reason',
  hosRuleset: 'HOS ruleset',
  fleetManagerId: 'Fleet manager',
  allowPersonalConveyance: 'Personal conveyance',
  allowYardMove: 'Yard move',
  adverseDrivingEnabled: 'Adverse driving',
  shortHaulException: 'Short-haul exception',
  splitSleeperEnabled: 'Split sleeper',
  eldExempt: 'ELD exempt',
  sendInvitation: 'Send invitation',
  status: 'Status',
};
