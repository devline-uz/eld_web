// web/tz.md §11 + §14.2 — the form schemas behind react-hook-form, field for field with the
// backend DTOs. `mode: 'onBlur'`, revalidate on change (§14.1) is set by the form, not here.
import { z } from 'zod';
import * as f from './fields';
import { LIMITS, VALIDATION_MESSAGES as M } from './messages';

/** 11.2 · Add vehicle */
export const vehicleSchema = z.object({
  unitNumber: f.unitNumber(),
  vin: f.vin(),
  make: f.requiredString(),
  model: f.requiredString(),
  year: f.vehicleYear(),
  licensePlate: z.string().trim().max(20).optional(),
  licenseState: z.string().trim().length(2).optional(),
  odometer: f.odometer().optional(),
  deviceId: z.string().trim().optional(),
});
export type VehicleFormValues = z.infer<typeof vehicleSchema>;

/** 11.5 · Calibrate odometer */
export const calibrateOdometerSchema = z.object({
  odometer: f.odometer(),
  reason: f.editReason(),
});
export type CalibrateOdometerValues = z.infer<typeof calibrateOdometerSchema>;

/** 11.4 · Assign driver to unit */
export const assignDriverSchema = z.object({
  driverId: f.requiredString(),
  effectiveAt: z.string().optional(),
});

/**
 * 11.8 · Add driver (Q-3 — every driver account is created here).
 * `Email address` is required and unique; the password is the mobile-app password.
 */
export const driverSchema = z.object({
  firstName: f.requiredString(),
  lastName: f.requiredString(),
  email: f.email(),
  username: f.username(),
  password: f.driverPassword(),
  cdlNumber: f.cdlNumber(),
  cdlState: z.string().trim().length(2),
  phone: f.phone().optional(),
  homeTerminalTimezone: f.requiredString(),
  /** Q-2 — SMS is never a channel; notifications go by email. */
  notifyByEmail: z.boolean().default(true),
});
export type DriverFormValues = z.infer<typeof driverSchema>;

/** 11.6 / 11.7 · CSV import */
export const csvImportSchema = z.object({ file: f.csvFile() });

/** 11.11 · Request a log edit — driving time is never shortened (49 CFR §395.30). */
export const logEditRequestSchema = z.object({
  eventId: f.requiredString(),
  // `CreateEditRequestDto.proposedStatus` is OFF | SB | D | ON only — PC/YM have no
  // representation in the §395.30 proposal (web/backend-gaps.md B-39, web/bugs.md WB-021).
  proposedStatus: z.enum(['OFF', 'SB', 'D', 'ON']),
  startAt: f.requiredString(),
  endAt: f.requiredString(),
  // §395 Appendix A caps the reason at 60 characters, not 500 (web/bugs.md WB-020).
  reason: f.annotation(),
});
export type LogEditRequestValues = z.infer<typeof logEditRequestSchema>;

/** 11.13 · Unassigned driving — assigning a segment always carries an annotation. */
export const unidentifiedAssignSchema = z.object({
  driverId: f.requiredString(),
  annotation: f.annotation(),
});

/** 11.12 · Certify logs (ADMIN only) */
export const certifySchema = z.object({
  // `POST /logs/:driverId/certify` takes ONE driver and MANY dates, not the reverse
  // (backend/src/modules/logs/dto/logs.dto.ts `CertifyDto`; web/bugs.md WB-022).
  driverId: f.requiredString(),
  dates: z.array(f.isoDay()).min(1, M.required).max(31),
});

/**
 * 11.14 · Send logs to a safety official — ≤ 8 days, fmcsa.dot.gov only, comment 1–60.
 * `method` is spelled as `CreateTransferDto.method` (`WEB_SERVICES | EMAIL`); the inspector address
 * is required only for `EMAIL` — an eRODS web-services transfer has no recipient (web/bugs.md WB-029).
 * `transferFields` + `refineTransfer` let a form add its own fields (e.g. 11.14's `driverId`) and
 * keep these rules as the single source of truth.
 */
export const transferFields = z.object({
  method: z.enum(['WEB_SERVICES', 'EMAIL']),
  recipient: z.string().trim().optional(),
  outputFileComment: f.outputFileComment(),
  from: f.isoDay(),
  to: f.isoDay(),
});

export function refineTransfer(
  value: Pick<z.infer<typeof transferFields>, 'method' | 'recipient' | 'from' | 'to'>,
  ctx: z.RefinementCtx,
): void {
  if (value.method === 'EMAIL') {
    const parsed = f.inspectorEmail().safeParse(value.recipient ?? '');
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recipient'],
        message: parsed.error.issues[0]?.message ?? M.inspectorEmail,
      });
    }
  }
  const span = f.daySpan(value.from, value.to);
  if (!(Number.isFinite(span) && span >= 1 && span <= LIMITS.transferRangeDays)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: M.transferRange });
  }
}

export const transferSchema = transferFields.superRefine(refineTransfer);
export type TransferFormValues = z.infer<typeof transferSchema>;

/** 11.16 · Create work order */
export const workOrderSchema = z.object({
  vehicleId: f.requiredString(),
  title: f.requiredString(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  dueDate: f.isoDay().optional(),
  assignee: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
});

/** 11.17 · Resolve defect */
export const resolveDefectSchema = z.object({
  resolution: f.editReason(),
  repairedAt: z.string().optional(),
  photos: f.imageFiles().optional(),
});

/** 11.10 · Create trip */
export const tripSchema = z.object({
  reference: f.requiredString(),
  driverId: f.requiredString(),
  vehicleId: f.requiredString(),
  origin: f.requiredString(),
  destination: f.requiredString(),
  scheduledStart: f.requiredString(),
  notes: z.string().trim().max(500).optional(),
});

/** 11.18 · Invite a user (Q-1 — no password; the invite lands by email). */
export const inviteUserSchema = z.object({
  email: f.email(),
  firstName: f.requiredString(),
  lastName: f.requiredString(),
  roleKey: f.requiredString(),
});

/** 11.19 · Create a role */
export const roleSchema = z.object({
  name: f.requiredString(),
  description: z.string().trim().max(200).optional(),
  permissions: z.record(z.enum(['NONE', 'READ', 'FULL'])),
});

/**
 * 11.20 · Register an ELD device — field for field with `CreateDeviceDto`
 * (backend/src/modules/devices/dto/devices.dto.ts): `serial` 1–60, `model` PT30 | PT40,
 * `firmware` ≤ 20. There is no `eldIdentifier` on a device — that is the carrier's (W-17,
 * `carrierSchema`) — web/bugs.md WB-024. `vehicleId` is the `Assign to unit` input; it is not part
 * of `CreateDeviceDto` but drives the follow-up `POST /devices/:id/pair`.
 */
export const DEVICE_MODELS = ['PT30', 'PT40'] as const;
export const deviceSchema = z.object({
  model: z.enum(DEVICE_MODELS),
  serial: f.requiredString(M.deviceSerial).max(LIMITS.deviceSerialMax, M.deviceSerial),
  firmware: z.string().trim().max(LIMITS.deviceFirmwareMax).optional(),
  vehicleId: z.string().trim().optional(),
});
export type DeviceFormValues = z.infer<typeof deviceSchema>;

/**
 * 11.21 · New alert rule — `CreateAlertRuleDto` (backend/src/modules/notifications/dto).
 *
 * Q-2: `SMS` is not a member of `ALERT_CHANNELS`, so it cannot be represented, let alone sent. The
 * other three are exactly what §11.21's design draws under DELIVERY (`In-app` · `Email` ·
 * `SMS (v2)` disabled · `Webhook`) and what the DTO accepts (web/decisions.md, alert channels).
 * `recipients` is the DTO's role/user object, not an email list (web/bugs.md WB-025).
 */
export const ALERT_CHANNELS = ['IN_APP', 'EMAIL', 'WEBHOOK'] as const;
export const ALERT_SEVERITIES = ['CRITICAL', 'WARNING', 'INFO'] as const;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The fields the modal registers with react-hook-form. */
export const alertRuleFormSchema = z.object({
  name: f.requiredString(M.alertRuleName).max(LIMITS.alertRuleNameMax, M.alertRuleName),
  severity: z.enum(ALERT_SEVERITIES),
});
export type AlertRuleFormValues = z.infer<typeof alertRuleFormSchema>;

/** The full `POST /alert-rules` body, field for field with `CreateAlertRuleDto`. */
export const alertRuleSchema = alertRuleFormSchema.extend({
  key: z.string().trim().min(1).max(100),
  conditions: z
    .array(
      z.object({
        event: z.string().min(1).max(100),
        params: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1, M.required),
  channels: z.array(z.enum(ALERT_CHANNELS)).min(1, M.required),
  recipients: z.object({
    roles: z.array(z.string()).optional(),
    userIds: z.array(z.string().uuid()).optional(),
    driverIds: z.array(z.string().uuid()).optional(),
    subjectDriver: z.boolean().optional(),
  }),
  throttle: z
    .object({
      perDriverPerDay: z.number().int().positive().optional(),
      cooldownMin: z.number().int().positive().optional(),
    })
    .optional(),
  quietHours: z
    .object({
      from: z.string().regex(HH_MM),
      to: z.string().regex(HH_MM),
      timezone: z.string().min(1).max(60),
    })
    .optional(),
  enabled: z.boolean().default(true),
});
export type AlertRulePayload = z.infer<typeof alertRuleSchema>;

/**
 * 11.22 · New support ticket — `CreateSupportTicketDto` (backend/src/modules/support/dto):
 * `priority` is `TicketPriorityEnum` exactly (web/bugs.md WB-026), `category` ≤ 100,
 * `description` becomes the DTO's `body` (≤ 5000). `subject` keeps §14.2's 3–140, which sits
 * inside the DTO's 1–200, so nothing the form accepts is ever rejected by the server.
 */
export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const ticketSchema = z.object({
  category: f.requiredString().max(LIMITS.ticketCategoryMax),
  priority: z.enum(TICKET_PRIORITIES),
  subject: f.ticketSubject(),
  description: f
    .requiredString(M.ticketDescription)
    .max(LIMITS.ticketBodyMax, M.ticketDescription),
});
export type TicketFormValues = z.infer<typeof ticketSchema>;

/** W-16 · Send a message */
export const messageSchema = z.object({ body: f.messageBody() });

/**
 * 11.1 · Create a geofence. `dwellMinutes` / `afterHoursOnly` are gap **B-15** — the backend
 * `Geofence` model has no such columns yet (only `alertOnEnter` / `alertOnExit`); the fields are
 * still collected here so the checkboxes are not silently dropped, and dropped from the payload
 * at submit time until B-15 ships (web/backend-gaps.md).
 */
export const geofenceSchema = z.object({
  name: f.requiredString(),
  category: z.enum(['TERMINAL', 'SHIPPER', 'CUSTOMER', 'REST_AREA', 'OTHER']).default('TERMINAL'),
  colour: z.enum(['BLUE', 'GREEN', 'AMBER', 'RED', 'VIOLET']).default('BLUE'),
  type: z.enum(['CIRCLE', 'POLYGON', 'ADDRESS']).default('POLYGON'),
  address: z.string().trim().optional(),
  /** Backend field name is `radiusMi` (miles) — B-93/D-098. */
  radiusMi: z.number().positive().optional(),
  appliesTo: z.string().trim().default('All vehicle groups'),
  alertOnEnter: z.boolean().default(true),
  alertOnExit: z.boolean().default(true),
  dwellMinutes: z.number().int().positive().optional(),
  afterHoursOnly: z.boolean().default(false),
  countAsYardMove: z.boolean().default(false),
});
export type GeofenceFormValues = z.infer<typeof geofenceSchema>;

/** W-17 · Company profile */
export const carrierSchema = z.object({
  name: f.requiredString(),
  dotNumber: f.requiredString(),
  timezone: f.requiredString(),
  eldIdentifier: f.eldIdentifier(),
  addressLine1: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().length(2).optional(),
  postalCode: z.string().trim().optional(),
});

/** W-26 · My profile */
export const profileSchema = z.object({
  firstName: f.requiredString(),
  lastName: f.requiredString(),
  phone: f.phone().optional(),
});

/** W-00 · Developer sign-in (dev build only — Q-1). */
export const signInSchema = z.object({
  email: f.email(),
  password: z.string().min(1, M.required),
});
