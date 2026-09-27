// 11.8 · Add driver. Kept out of `schemas.ts` (and the `@/shared/forms` barrel) so that only the
// Add driver modal loads the libphonenumber metadata behind `internationalPhone()`.
import { z } from 'zod';
import * as f from './fields';
import { internationalPhone } from './phoneNumber';
import { licenceNumber, refineLicenceForState } from './driverLicence';

/**
 * 11.8 · Add driver (Q-3 — every driver account is created here).
 * `Email address` is required and unique; the password is the mobile-app password.
 */
export const driverSchema = z
  .object({
    firstName: f.requiredString(),
    lastName: f.requiredString(),
    email: f.email(),
    username: f.username(),
    password: f.driverPassword(),
    /** Trimmed, upper-cased, `[A-Z0-9-]`, 4–20; checked against `cdlState`'s format below. */
    cdlNumber: licenceNumber(),
    cdlState: z.string().trim().length(2),
    /** International; validated per country and submitted as E.164 (`+998901234567`). */
    phone: internationalPhone(),
    /**
     * Optional and typed — there is no Terminal table to pick from yet (backend D-090). Left empty,
     * the name is not sent and the zone falls back to the carrier's own time zone.
     */
    homeTerminalName: z.string().trim().optional(),
    homeTerminalTimezone: z.string().optional(),
    /** Q-2 — SMS is never a channel; notifications go by email. */
    notifyByEmail: z.boolean().default(true),
  })
  .superRefine(refineLicenceForState);
export type DriverFormValues = z.infer<typeof driverSchema>;
