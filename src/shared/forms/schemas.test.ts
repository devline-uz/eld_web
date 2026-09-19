// web/tz.md §14.2 — each field rule, with its exact error string.
import { describe, expect, it } from 'vitest';
import * as f from './fields';
import { VALIDATION_MESSAGES as M } from './messages';
import {
  alertRuleFormSchema,
  alertRuleSchema,
  deviceSchema,
  driverSchema,
  ticketSchema,
  transferSchema,
  vehicleSchema,
} from './schemas';

const firstError = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success ? null : result.error!.issues[0]!.message;
};

describe('field rules', () => {
  it('validates an email address', () => {
    expect(f.email().safeParse('sarah.chen@universal-logistics.example').success).toBe(true);
    expect(firstError(f.email(), 'sarah@')).toBe(M.email);
    expect(firstError(f.email(), '')).toBe(M.email);
  });

  it('only accepts fmcsa.dot.gov for an inspector', () => {
    expect(f.inspectorEmail().safeParse('inspector@fmcsa.dot.gov').success).toBe(true);
    expect(f.inspectorEmail().safeParse('agent@eastern.fmcsa.dot.gov').success).toBe(true);
    expect(firstError(f.inspectorEmail(), 'inspector@gmail.com')).toBe(M.inspectorEmail);
  });

  it('rejects lookalike domains that merely end with fmcsa.dot.gov (WB-094)', () => {
    expect(f.inspectorEmail().safeParse('Inspector@FMCSA.DOT.GOV').success).toBe(true);
    expect(f.inspectorEmail().safeParse('agent@a.b.fmcsa.dot.gov').success).toBe(true);
    for (const attack of [
      'officer@evilfmcsa.dot.gov',
      'officer@notfmcsa.dot.gov',
      'officer@evil.notfmcsa.dot.gov',
      'officer@fmcsa.dot.gov.evil.com',
      'officer@fmcsa-dot.gov',
      'officer@fmcsaxdot.gov',
      'officer@.fmcsa.dot.gov',
      'officer@fmcsa.dot.gov.',
      'officer@evil.com#fmcsa.dot.gov',
    ]) {
      expect(firstError(f.inspectorEmail(), attack), attack).toBe(M.inspectorEmail);
    }
  });

  it('enforces the driver mobile password minimum', () => {
    expect(f.driverPassword().safeParse('Onebook2026').success).toBe(true);
    expect(firstError(f.driverPassword(), 'short')).toBe(M.password);
  });

  it('rejects a VIN with I, O or Q, or the wrong length', () => {
    expect(f.vin().safeParse('1FUJA6CV88LW12345').success).toBe(true);
    expect(firstError(f.vin(), '1FUJA6CV88LW1234I')).toBe(M.vin);
    expect(firstError(f.vin(), '1FUJA6CV88LW')).toBe(M.vin);
  });

  it('checks unit number, username and CDL number lengths', () => {
    expect(f.unitNumber().safeParse('#101').success).toBe(true);
    expect(firstError(f.unitNumber(), '')).toBe(M.unitNumber);
    expect(firstError(f.unitNumber(), 'x'.repeat(21))).toBe(M.unitNumber);
    expect(f.username().safeParse('m.webb_01').success).toBe(true);
    expect(firstError(f.username(), 'M.Webb')).toBe(M.username);
    expect(firstError(f.username(), 'ab')).toBe(M.username);
    expect(firstError(f.username(), 'a'.repeat(31))).toBe(M.username);
    expect(f.cdlNumber().safeParse('OH-4471982').success).toBe(true);
    expect(firstError(f.cdlNumber(), '')).toBe(M.cdlNumber);
  });

  it('bounds the odometer at 3,000,000 whole miles', () => {
    expect(f.odometer().safeParse(993589).success).toBe(true);
    expect(firstError(f.odometer(), 3_000_001)).toBe(M.odometer);
    expect(firstError(f.odometer(), -1)).toBe(M.odometer);
    expect(firstError(f.odometer(), 12.5)).toBe(M.odometer);
    expect(firstError(f.odometer(), 'x')).toBe(M.odometer);
  });

  it('applies the FMCSA annotation minimum of 4 characters', () => {
    expect(f.annotation().safeParse('Yard move to bay 3').success).toBe(true);
    expect(firstError(f.annotation(), 'ok')).toBe(M.annotation);
    expect(firstError(f.annotation(), 'x'.repeat(61))).toBe(M.annotation);
  });

  it('bounds the other free-text fields', () => {
    expect(firstError(f.outputFileComment(), 'x'.repeat(61))).toBe(M.outputFileComment);
    expect(firstError(f.editReason(), 'no')).toBe(M.editReason);
    expect(firstError(f.messageBody(), 'x'.repeat(2001))).toBe(M.messageBody);
    expect(firstError(f.ticketSubject(), 'ab')).toBe(M.ticketSubject);
    expect(f.ticketSubject().safeParse('Device offline on unit #101').success).toBe(true);
  });

  it('requires an ELD identifier of exactly 4 characters', () => {
    expect(f.eldIdentifier().safeParse('OBK1').success).toBe(true);
    expect(firstError(f.eldIdentifier(), 'OBK')).toBe(M.eldIdentifier);
    expect(firstError(f.eldIdentifier(), 'OBK-1')).toBe(M.eldIdentifier);
  });

  it('validates phone numbers in E.164 and US form', () => {
    expect(f.phone().safeParse('+14155552671').success).toBe(true);
    expect(f.phone().safeParse('(614) 555-0188').success).toBe(true);
    expect(f.phone().safeParse('+1 614 555 0104').success).toBe(true);
    expect(firstError(f.phone(), '+1 abc 555 0104')).toBe(M.phone);
    expect(firstError(f.phone(), '12')).toBe(M.phone);
  });

  it('validates the W-17 company profile numbers', () => {
    expect(f.dotNumber().safeParse('1234567').success).toBe(true);
    expect(firstError(f.dotNumber(), '123456789')).toBe(M.dotNumber);
    expect(f.mcNumber().safeParse('MC-892014').success).toBe(true);
    expect(firstError(f.mcNumber(), 'MC 12x')).toBe(M.mcNumber);
    expect(f.ein().safeParse('12-3456789').success).toBe(true);
    expect(firstError(f.ein(), '123456789')).toBe(M.ein);
    expect(f.postalCode().safeParse('43215-1234').success).toBe(true);
    expect(firstError(f.postalCode(), '4321')).toBe(M.zip);
    expect(f.postalCode(true).safeParse('M5V 2T6').success).toBe(true);
    expect(f.city().safeParse("Coeur d'Alene").success).toBe(true);
    expect(firstError(f.city(), 'Columbus 2')).toBe(M.city);
  });

  it('caps a transfer at 8 days and a log range at 62', () => {
    expect(f.transferRange().safeParse({ from: '2026-09-03', to: '2026-09-10' }).success).toBe(true);
    expect(firstError(f.transferRange(), { from: '2026-09-01', to: '2026-09-10' })).toBe(
      M.transferRange,
    );
    expect(firstError(f.transferRange(), { from: '2026-09-10', to: '2026-09-01' })).toBe(
      M.transferRange,
    );
    expect(f.logRange().safeParse({ from: '2026-07-11', to: '2026-09-10' }).success).toBe(true);
    expect(firstError(f.logRange(), { from: '2026-01-01', to: '2026-09-10' })).toBe(M.logRange);
    expect(firstError(f.logRange(), { from: 'nope', to: '2026-09-10' })).toBe(M.required);
    expect(Number.isNaN(f.daySpan('nope', '2026-09-10'))).toBe(true);
  });

  it('accepts a CSV up to 5 MB and up to 5 images', () => {
    const csv = new File(['a,b'], 'units.csv', { type: 'text/csv' });
    expect(f.csvFile().safeParse(csv).success).toBe(true);
    expect(firstError(f.csvFile(), new File(['a'], 'units.xlsx'))).toBe(M.csvFile);
    const image = new File(['x'], 'defect.jpg', { type: 'image/jpeg' });
    expect(f.imageFiles().safeParse([image]).success).toBe(true);
    expect(firstError(f.imageFiles(), Array(6).fill(image))).toBe(M.images);
    expect(firstError(f.imageFiles(), [new File(['x'], 'a.pdf', { type: 'application/pdf' })])).toBe(
      M.images,
    );
  });
});

describe('form schemas', () => {
  it('accepts a complete Add driver form (11.8 · Q-3)', () => {
    const result = driverSchema.safeParse({
      firstName: 'Marcus',
      lastName: 'Webb',
      email: 'marcus.webb@universal-logistics.example',
      username: 'marcus.webb',
      password: 'Onebook2026',
      cdlNumber: 'OH-4471982',
      cdlState: 'OH',
      homeTerminalTimezone: 'America/New_York',
      notifyByEmail: true,
    });
    expect(result.success).toBe(true);
  });

  it('requires a unique-looking VIN and unit number on Add vehicle (11.2)', () => {
    expect(
      vehicleSchema.safeParse({
        unitNumber: '#101',
        vin: '1FUJA6CV88LW12345',
        make: 'Freightliner',
        model: 'Cascadia',
        year: 2021,
      }).success,
    ).toBe(true);
    expect(firstError(vehicleSchema, { unitNumber: '', vin: 'x', make: '', model: '', year: 2021 })).toBe(
      M.unitNumber,
    );
  });

  it('bounds the vehicle year to 1970 through the current year', () => {
    const base = { unitNumber: '#101', vin: '1FUJA6CV88LW12345', make: 'Freightliner', model: 'Cascadia' };
    const currentYear = new Date().getFullYear();
    expect(vehicleSchema.safeParse({ ...base, year: 1970 }).success).toBe(true);
    expect(vehicleSchema.safeParse({ ...base, year: currentYear }).success).toBe(true);
    expect(firstError(vehicleSchema, { ...base, year: 1969 })).toBe(M.yearMin);
    expect(firstError(vehicleSchema, { ...base, year: currentYear + 1 })).toBe(M.yearFuture);
  });

  it('holds an FMCSA transfer to 8 days and a government address (11.14)', () => {
    const base = {
      method: 'EMAIL' as const,
      recipient: 'inspector@fmcsa.dot.gov',
      outputFileComment: 'Roadside inspection 2026-09-12',
      from: '2026-09-05',
      to: '2026-09-12',
    };
    expect(transferSchema.safeParse(base).success).toBe(true);
    expect(firstError(transferSchema, { ...base, to: '2026-09-20' })).toBe(M.transferRange);
    expect(firstError(transferSchema, { ...base, recipient: 'me@example.com' })).toBe(
      M.inspectorEmail,
    );
  });

  it('sends eRODS without a recipient and spells the method WEB_SERVICES (11.14 · WB-029)', () => {
    const erods = {
      method: 'WEB_SERVICES' as const,
      outputFileComment: 'Roadside inspection 2026-09-12',
      from: '2026-09-05',
      to: '2026-09-12',
    };
    expect(transferSchema.safeParse(erods).success).toBe(true);
    expect(transferSchema.safeParse({ ...erods, method: 'WEB_SERVICE' }).success).toBe(false);
    const noAddress = transferSchema.safeParse({ ...erods, method: 'EMAIL' });
    expect(noAddress.success ? [] : noAddress.error.issues.map((i) => i.path.join('.'))).toEqual(['recipient']);
  });

  it('registers a device with the CreateDeviceDto fields and no eldIdentifier (11.20 · WB-024)', () => {
    expect(deviceSchema.safeParse({ model: 'PT30', serial: 'PT30_1C4F', vehicleId: '' }).success).toBe(
      true,
    );
    expect(deviceSchema.safeParse({ model: 'PT40', serial: 'PT40_9A1B', firmware: 'L113' }).success).toBe(
      true,
    );
    // The ELD identifier is the carrier's (W-17), never a device field.
    expect('eldIdentifier' in deviceSchema.shape).toBe(false);
    expect(firstError(deviceSchema, { model: 'PT30', serial: '' })).toBe(M.deviceSerial);
    expect(firstError(deviceSchema, { model: 'PT30', serial: 'x'.repeat(61) })).toBe(M.deviceSerial);
    expect(deviceSchema.safeParse({ model: 'OBK-200', serial: 'SN-991' }).success).toBe(false);
    expect(
      deviceSchema.safeParse({ model: 'PT30', serial: 'SN-991', firmware: 'x'.repeat(21) }).success,
    ).toBe(false);
  });

  it('validates the two fields the New alert rule modal registers (11.21)', () => {
    expect(alertRuleFormSchema.safeParse({ name: 'Break required soon', severity: 'WARNING' }).success).toBe(
      true,
    );
    expect(firstError(alertRuleFormSchema, { name: '', severity: 'WARNING' })).toBe(M.alertRuleName);
    expect(alertRuleFormSchema.safeParse({ name: 'x', severity: 'MEDIUM' }).success).toBe(false);
  });

  const alertPayload = {
    key: 'break_required_soon',
    name: 'Break required soon',
    severity: 'WARNING' as const,
    conditions: [{ event: 'hos.break_due', params: { withinMin: 30 } }],
    channels: ['IN_APP', 'EMAIL', 'WEBHOOK'] as const,
    recipients: { roles: ['Fleet managers'] },
    quietHours: { from: '22:00', to: '06:00', timezone: 'America/New_York' },
    enabled: true,
  };

  it('accepts the CreateAlertRuleDto body with the design channels In-app, Email and Webhook', () => {
    expect(alertRuleSchema.safeParse(alertPayload).success).toBe(true);
    expect(
      alertRuleSchema.safeParse({ ...alertPayload, throttle: { perDriverPerDay: 1, cooldownMin: 60 } })
        .success,
    ).toBe(true);
  });

  it('never accepts SMS as a channel (Q-2)', () => {
    expect(alertRuleSchema.safeParse({ ...alertPayload, channels: ['SMS'] }).success).toBe(false);
    expect(alertRuleSchema.safeParse({ ...alertPayload, channels: ['EMAIL', 'SMS'] }).success).toBe(
      false,
    );
    expect(firstError(alertRuleSchema, { ...alertPayload, channels: [] })).toBe(M.required);
  });

  it('takes recipients as the DTO role/user object, not an email list (WB-025)', () => {
    expect(
      alertRuleSchema.safeParse({ ...alertPayload, recipients: ['ops@universal-logistics.example'] })
        .success,
    ).toBe(false);
    expect(
      alertRuleSchema.safeParse({
        ...alertPayload,
        recipients: { userIds: ['not-a-uuid'] },
      }).success,
    ).toBe(false);
    expect(firstError(alertRuleSchema, { ...alertPayload, conditions: [] })).toBe(M.required);
    expect(
      alertRuleSchema.safeParse({
        ...alertPayload,
        quietHours: { from: '24:00', to: '06:00', timezone: 'America/New_York' },
      }).success,
    ).toBe(false);
  });

  it('uses TicketPriorityEnum exactly — URGENT and NORMAL, never MEDIUM (11.22 · WB-026)', () => {
    const ticket = {
      category: 'ELD hardware',
      priority: 'NORMAL',
      subject: 'Device offline on unit #101',
      description: 'The PT30 stopped reporting after a firmware update.',
    };
    for (const priority of ['LOW', 'NORMAL', 'HIGH', 'URGENT']) {
      expect(ticketSchema.safeParse({ ...ticket, priority }).success, priority).toBe(true);
    }
    expect(ticketSchema.safeParse({ ...ticket, priority: 'MEDIUM' }).success).toBe(false);
    expect(firstError(ticketSchema, { ...ticket, description: '' })).toBe(M.ticketDescription);
    expect(firstError(ticketSchema, { ...ticket, subject: 'ab' })).toBe(M.ticketSubject);
    expect(ticketSchema.safeParse({ ...ticket, category: 'x'.repeat(101) }).success).toBe(false);
  });
});
