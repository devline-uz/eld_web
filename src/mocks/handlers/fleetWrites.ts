// W-03/W-04/W-06/W-07 write paths — `POST /vehicles`, `/vehicles/:id/assign-driver`,
// `/vehicles/:id/calibrate-odometer`, `POST /drivers`, the two import endpoints and the CSV
// exports. None of them had a handler, so in `dev:mock` every Save fell through to
// `localhost:3002` and died with `net::ERR_FAILED` (mock-layer audit, 2026-09-23).
//
// The reads are here too: `GET /vehicles` and `GET /drivers` answer from the same mutable
// `mockState` tables the writes edit, so a unit added in the drawer is in the next page, and an
// assigned driver shows up in the DRIVER column without a reload — the behaviour the real API has.
import { http, HttpResponse } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import type { DriverRow, VehicleRow } from '@/shared/api/vehicles';
import { fixture } from '../fixtures.generated';
import { fail, ok, serverPage, url } from '../envelope';
import type { DeviceRow } from '@/shared/api/settingsAdmin';
import { DEVICES, DRIVERS, TRAILERS, VEHICLES, daysAgo, liveVehicles, mockId } from './mockState';
import type { TrailerRow } from '@/shared/api/trailers';
import { findMockTrip, removeMockTrip } from './tripsMessagingGaps';
import { mockVehicleGroupName } from './vehicleGroups';

/** B-104 — `{ vehicleGroupId, vehicleGroupName }` for a geofence row, or null for an unknown group. */
function geofenceGroup(id: unknown): { vehicleGroupId: string | null; vehicleGroupName: string | null } | null {
  if (id == null || id === '') return { vehicleGroupId: null, vehicleGroupName: null };
  const name = typeof id === 'string' ? mockVehicleGroupName(id) : undefined;
  return name === undefined ? null : { vehicleGroupId: id as string, vehicleGroupName: name };
}

const VEHICLE_Q_FIELDS = ['unitNumber', 'vin', 'make', 'model', 'licensePlate'];
const DRIVER_Q_FIELDS = ['firstName', 'lastName', 'username', 'cdlNumber', 'email'];

/** A soft-deleted unit answers 404 on every `/vehicles/:id…` path, as a missing one does. */
const findVehicle = (id: string): VehicleRow | undefined => liveVehicles().find((v) => v.id === id);
/** Non-deleted trailers — a soft-deleted one answers 404 and frees its number. */
const liveTrailers = (): TrailerRow[] => TRAILERS.filter((t) => !t.deletedAt);
const findDriver = (id: string): DriverRow | undefined => DRIVERS.find((d) => d.id === id);
/** Drivers whose unique values are still held — `DELETE /drivers/:id` leaves the row as
 * `TERMINATED`, and a deleted driver's username / email / phone / licence are free to reuse. */
const undeletedDrivers = (): DriverRow[] => DRIVERS.filter((d) => d.status !== 'TERMINATED');

/** Phone numbers compare on digits only, a leading US `1` dropped — `+1 (614) 555-1000` = `6145551000`. */
const phoneKey = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};
/** Unit numbers compare without the display `#` or case; VINs without case. */
const unitNumberKey = (value: unknown): string => String(value ?? '').trim().replace(/^#/, '').toUpperCase();
const vinKey = (value: unknown): string => String(value ?? '').trim().toUpperCase();
const upper = (value: unknown): string => String(value ?? '').trim().toUpperCase();
/** `PLATE|STATE`; '' without a plate so an unplated unit never conflicts. */
const plateStateKey = (plate: unknown, state: unknown): string => (upper(plate) ? `${upper(plate)}|${upper(state)}` : '');

/** The server's rule (B-97): ELD serial unique across units, plate + issuing state unique as a pair,
 * both normalised (trim + upper-case) and empty = no value. `exceptId` is the unit being edited. */
function uniqueConflict(dto: Record<string, unknown>, exceptId?: string) {
  const others = liveVehicles().filter((v) => v.id !== exceptId);
  const serial = upper(dto.deviceId ?? dto.eldSerial);
  if (serial && !DEVICES.some((d) => upper(d.serial) === serial)) {
    return fail(404, 'DEVICE_NOT_FOUND', 'No ELD device with this serial is registered.', {
      eldSerial: 'No ELD device with this serial is registered.',
    });
  }
  if (serial && DEVICES.some((d) => upper(d.serial) === serial && d.vehicleId != null && d.vehicleId !== exceptId)) {
    return fail(409, 'ELD_SERIAL_TAKEN', 'This ELD serial is already assigned to another unit.', {
      eldSerial: 'This ELD serial is already assigned to another unit.',
    });
  }
  const key = plateStateKey(dto.licensePlate, dto.plateState ?? dto.issuingState);
  if (key && others.some((v) => plateStateKey(v.licensePlate, v.plateState) === key)) {
    return fail(409, 'LICENSE_PLATE_TAKEN', 'This license plate is already registered for this state.', {
      licensePlate: 'This license plate is already registered for this state.',
    });
  }
  return null;
}
/** Licence numbers compare without case, spaces or dashes. */
const cdlKey = (value: unknown): string => String(value ?? '').toUpperCase().replace(/[\s-]/g, '');

const MSG = {
  username: 'A driver with this username already exists.',
  email: 'A driver with this email address already exists.',
  phone: 'A driver with this phone number already exists.',
  cdlNumber: 'A driver with this licence number already exists.',
  unit: 'This unit already has a driver assigned.',
} as const;

/** B-100: one 409 per unique value, `details` keyed by the field. Username is trimmed, email
 * trimmed + lower-cased, phone compared by digits, licence ignoring case / spaces / dashes. A
 * deleted (TERMINATED) driver holds nothing, and `exceptId` (the driver being edited) is skipped.
 * Only the values present in `dto` are checked, so a partial PATCH never re-checks the rest. */
export function driverUniqueConflict(dto: Record<string, unknown>, exceptId?: string) {
  const holders = undeletedDrivers().filter((d) => d.id !== exceptId);
  const taken = (code: string, field: keyof typeof MSG) => fail(409, code, MSG[field], { [field]: MSG[field] });
  if (dto.username != null) {
    const username = String(dto.username).trim();
    if (username && holders.some((d) => String(d.username).trim() === username)) return taken('USERNAME_TAKEN', 'username');
  }
  const email = String(dto.email ?? '').trim().toLowerCase();
  if (email && holders.some((d) => d.email?.trim().toLowerCase() === email)) return taken('EMAIL_TAKEN', 'email');
  const phone = phoneKey(dto.phone);
  if (phone && holders.some((d) => d.phone && phoneKey(d.phone) === phone)) return taken('PHONE_TAKEN', 'phone');
  const cdl = cdlKey(dto.cdlNumber);
  if (cdl && holders.some((d) => cdlKey(d.cdlNumber) === cdl)) return taken('CDL_NUMBER_TAKEN', 'cdlNumber');
  return null;
}

const NOT_FOUND = (what: string) => fail(404, 'NOT_FOUND', `${what} was not found.`);

async function body(request: Request): Promise<Record<string, unknown>> {
  return ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
}

export const fleetWriteHandlers = [
  /* ------------------------------------------------- static paths first (WB-016)
   * MSW is first-match-wins and `/vehicles/:id` happily captures the literal segment
   * "export"/"import", so every static sub-path is registered before its `:id` sibling. */
  http.get(url(endpoints.vehicles.export), () =>
    ok({
      vehicles: liveVehicles().map((v) => ({
        unitNumber: v.unitNumber.replace('#', ''),
        vin: v.vin,
        make: v.make,
        model: v.model,
        year: v.year,
        fuelType: v.fuelType,
        odometerMiles: v.odometerMi,
      })),
    }),
  ),
  http.get(url(endpoints.drivers.export), () =>
    ok({
      drivers: DRIVERS.map((d) => ({
        username: d.username,
        firstName: d.firstName,
        lastName: d.lastName,
        cdlNumber: d.cdlNumber,
        cdlState: d.cdlState,
        homeTerminalTimezone: d.homeTerminalTimezone,
        hosRuleset: 'US_70_8_PROPERTY',
      })),
    }),
  ),
  http.get(url(endpoints.devices.export), () => ok(fixture('GET /api/devices/export'))),
  http.get(url(endpoints.trailers.export), () =>
    ok({ trailers: liveTrailers().map((t) => ({ number: t.number, ...(t.vin ? { vin: t.vin } : {}) })) }),
  ),

  /* ---------------------------------------------------------------- vehicles */
  http.get(url(endpoints.vehicles.list), ({ request }) =>
    ok(serverPage<VehicleRow>(liveVehicles(), request, VEHICLE_Q_FIELDS)),
  ),
  http.get(url(endpoints.vehicles.detail(':id')), ({ params }) => {
    const vehicle = findVehicle(String(params.id));
    return vehicle ? ok(vehicle) : NOT_FOUND('Vehicle');
  }),

  http.post(url(endpoints.vehicles.create), async ({ request }) => {
    const dto = await body(request);
    const unitNumber = String(dto.unitNumber ?? '');
    if (!unitNumber || !dto.vin) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
        ...(unitNumber ? {} : { unitNumber: 'Unit number is required.' }),
        ...(dto.vin ? {} : { vin: 'VIN is required.' }),
      });
    }
    // Uniqueness only counts live units: a soft-deleted unit gives up its unit number and VIN, so
    // they can be used again (the real API's unique indexes are partial on `deletedAt IS NULL`).
    const live = liveVehicles();
    if (live.some((v) => unitNumberKey(v.unitNumber) === unitNumberKey(unitNumber))) {
      return fail(409, 'UNIT_NUMBER_TAKEN', 'A unit with this number already exists.', {
        unitNumber: 'A unit with this number already exists.',
      });
    }
    if (live.some((v) => vinKey(v.vin) === vinKey(dto.vin))) {
      return fail(409, 'VIN_TAKEN', 'A unit with this VIN already exists.', {
        vin: 'A unit with this VIN already exists.',
      });
    }
    const uniqueFail = uniqueConflict(dto);
    if (uniqueFail) return uniqueFail;
    const odometerMi = Number(dto.odometerMi ?? 0);
    const created: VehicleRow = {
      id: mockId('veh'),
      unitNumber,
      vin: String(dto.vin),
      make: (dto.make as string) ?? null,
      model: (dto.model as string) ?? null,
      year: dto.year == null ? null : Number(dto.year),
      licensePlate: upper(dto.licensePlate) || null,
      plateState: upper(dto.plateState) || null,
      fuelType: (dto.fuelType as string) ?? 'DIESEL',
      sleeperBerth: Boolean(dto.sleeperBerth),
      odometerMi,
      deviceOdometerMi: null,
      odometerOffsetMi: 0,
      odometerCalibratedAt: null,
      engineHours: 0,
      busType: null,
      status: 'ACTIVE',
      notes: (dto.notes as string) ?? null,
      activatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    VEHICLES.unshift(created);
    const serial = upper(dto.deviceId);
    const device = serial ? DEVICES.find((d) => upper(d.serial) === serial) : undefined;
    if (device) device.vehicleId = created.id;
    return ok(created, 201);
  }),

  http.patch(url(endpoints.vehicles.update(':id')), async ({ params, request }) => {
    const vehicle = findVehicle(String(params.id));
    if (!vehicle) return NOT_FOUND('Vehicle');
    const dto = await body(request);
    // One 409 per unique value, each naming its field (the shape B-97 asks the backend for). The
    // unit being edited is excluded, so saving it unchanged never conflicts with itself, and so is
    // every soft-deleted unit — a deleted unit's number and VIN are free to reuse.
    const others = liveVehicles().filter((v) => v.id !== vehicle.id);
    if (dto.unitNumber != null) {
      const unitNumber = unitNumberKey(String(dto.unitNumber));
      if (others.some((v) => unitNumberKey(v.unitNumber) === unitNumber)) {
        return fail(409, 'UNIT_NUMBER_TAKEN', 'A unit with this number already exists.', {
          unitNumber: 'A unit with this number already exists.',
        });
      }
    }
    if (dto.vin != null) {
      const vin = vinKey(String(dto.vin));
      if (others.some((v) => vinKey(v.vin) === vin)) {
        return fail(409, 'VIN_TAKEN', 'A unit with this VIN already exists.', {
          vin: 'A unit with this VIN already exists.',
        });
      }
    }
    // Merge with the unit's current plate/state so a partial PATCH is judged on the stored pair.
    const uniqueFail = uniqueConflict(
      { ...dto, licensePlate: dto.licensePlate ?? vehicle.licensePlate, plateState: dto.plateState ?? vehicle.plateState },
      vehicle.id,
    );
    if (uniqueFail) return uniqueFail;
    const { deviceId, ...fields } = dto;
    Object.assign(vehicle, fields);
    if (dto.licensePlate != null) vehicle.licensePlate = upper(dto.licensePlate) || null;
    if (dto.plateState != null) vehicle.plateState = upper(dto.plateState) || null;
    const serial = upper(deviceId);
    const device = serial ? DEVICES.find((d) => upper(d.serial) === serial) : undefined;
    if (device) device.vehicleId = vehicle.id;
    return ok(vehicle);
  }),

  /** Soft delete (tz.md §11.3, B-65): the row is kept for audits with `deletedAt` and
   * `status: 'INACTIVE'`, its driver and ELD device are unassigned, and it leaves every read. */
  http.delete(url(endpoints.vehicles.remove(':id')), ({ params }) => {
    const vehicle = findVehicle(String(params.id));
    if (!vehicle) return NOT_FOUND('Vehicle');
    vehicle.status = 'INACTIVE';
    vehicle.deletedAt = new Date().toISOString();
    for (const driver of DRIVERS) {
      if (driver.assignedVehicleId === vehicle.id) driver.assignedVehicleId = null;
    }
    for (const device of DEVICES) {
      if (device.vehicleId === vehicle.id) device.vehicleId = null;
    }
    return ok(vehicle);
  }),

  /** 11.5 — the driver row owns the link (`assignedVehicleId`), exactly as the join in
   * `shared/api/vehicles.ts` reads it, so one unit never keeps two drivers. */
  http.post(url(endpoints.vehicles.assignDriver(':id')), async ({ params, request }) => {
    const vehicle = findVehicle(String(params.id));
    if (!vehicle) return NOT_FOUND('Vehicle');
    const dto = await body(request);
    const driver = findDriver(String(dto.driverId ?? ''));
    if (!driver) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
        driverId: 'Select a driver.',
      });
    }
    for (const other of DRIVERS) {
      if (other.assignedVehicleId === vehicle.id) other.assignedVehicleId = null;
    }
    driver.assignedVehicleId = vehicle.id;
    return ok(vehicle);
  }),

  http.post(url(endpoints.vehicles.unassignDriver(':id')), ({ params }) => {
    const vehicle = findVehicle(String(params.id));
    if (!vehicle) return NOT_FOUND('Vehicle');
    for (const driver of DRIVERS) {
      if (driver.assignedVehicleId === vehicle.id) driver.assignedVehicleId = null;
    }
    return ok(vehicle);
  }),

  /** 11.6 — the offset is what changes; `odometerMi` stays the last ECM reading (tz.md §4.3). */
  http.post(url(endpoints.vehicles.calibrateOdometer(':id')), async ({ params, request }) => {
    const vehicle = findVehicle(String(params.id));
    if (!vehicle) return NOT_FOUND('Vehicle');
    const dto = await body(request);
    const target = Number(dto.odometerMi);
    if (!Number.isFinite(target) || target < 0) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
        odometerMi: 'Enter the odometer reading in miles.',
      });
    }
    const device = vehicle.deviceOdometerMi;
    vehicle.odometerOffsetMi = device == null ? 0 : target - device;
    if (device == null) vehicle.odometerMi = target;
    vehicle.odometerCalibratedAt = new Date().toISOString();
    return ok(vehicle);
  }),

  http.post(url(endpoints.vehicles.import), async ({ request }) => {
    const dto = (await body(request)) as { vehicles?: Array<Record<string, unknown>> };
    const rows = dto.vehicles ?? [];
    let imported = 0;
    const failed: Array<{ index: number; error: string }> = [];
    rows.forEach((row, index) => {
      const unitNumber = String(row.unitNumber ?? '');
      if (!unitNumber || !row.vin) {
        failed.push({ index, error: 'unitNumber and vin are required' });
        return;
      }
      VEHICLES.unshift({
        ...VEHICLES[0]!,
        id: mockId('veh'),
        unitNumber,
        vin: String(row.vin),
        make: (row.make as string) ?? null,
        model: (row.model as string) ?? null,
        odometerMi: Number(row.odometerMi ?? 0),
        deviceOdometerMi: null,
        odometerOffsetMi: 0,
        odometerCalibratedAt: null,
        notes: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        // The template row may be a soft-deleted unit — an imported unit never inherits that.
        deletedAt: null,
      });
      imported += 1;
    });
    return ok({ imported, updated: 0, failed });
  }),

  /* ---------------------------------------------------------------- drivers */
  http.get(url(endpoints.drivers.list), ({ request }) =>
    ok(serverPage<DriverRow>(DRIVERS, request, DRIVER_Q_FIELDS)),
  ),
  http.get(url(endpoints.drivers.detail(':id')), ({ params }) => {
    const driver = findDriver(String(params.id));
    return driver ? ok(driver) : NOT_FOUND('Driver');
  }),

  http.post(url(endpoints.drivers.create), async ({ request }) => {
    const dto = await body(request);
    const username = String(dto.username ?? '');
    const details: Record<string, string> = {};
    if (!dto.firstName) details.firstName = 'First name is required.';
    if (!dto.lastName) details.lastName = 'Last name is required.';
    if (!username) details.username = 'Username is required.';
    if (Object.keys(details).length) {
      return fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', details);
    }
    const uniqueFail = driverUniqueConflict({ ...dto, username }, undefined);
    if (uniqueFail) return uniqueFail;
    // A create never takes a unit away from another driver (that is 11.5's explicit reassign);
    // it used to silently unassign the current driver here.
    const assignedVehicleId = (dto.assignedVehicleId as string) || null;
    if (assignedVehicleId) {
      if (!findVehicle(assignedVehicleId)) {
        return fail(404, 'VEHICLE_NOT_FOUND', 'Unit not found.', {
          assignedVehicleId: 'Select a unit.',
        });
      }
      const unit = findVehicle(assignedVehicleId)!;
      if (unit.status === 'OUT_OF_SERVICE') {
        return fail(409, 'VEHICLE_OUT_OF_SERVICE', 'This unit is out of service.', {
          assignedVehicleId: 'This unit is out of service.',
        });
      }
      if (undeletedDrivers().some((d) => d.assignedVehicleId === assignedVehicleId)) {
        return fail(409, 'VEHICLE_ALREADY_ASSIGNED', 'This unit already has a driver assigned.', {
          assignedVehicleId: 'This unit already has a driver assigned.',
        });
      }
    }
    const created: DriverRow = {
      id: mockId('drv'),
      username,
      firstName: String(dto.firstName),
      lastName: String(dto.lastName),
      email: (dto.email as string) ?? null,
      phone: (dto.phone as string) ?? null,
      cdlNumber: String(dto.cdlNumber ?? ''),
      cdlState: String(dto.cdlState ?? 'OH'),
      status: 'ACTIVE',
      homeTerminalName: String(dto.homeTerminalName ?? 'Columbus, OH'),
      homeTerminalTimezone: String(dto.homeTerminalTimezone ?? 'America/New_York'),
      fleetManagerId: (dto.fleetManagerId as string) ?? null,
      assignedVehicleId,
      allowPersonalConveyance: Boolean(dto.allowPersonalConveyance),
      allowYardMove: Boolean(dto.allowYardMove),
      adverseDrivingEnabled: Boolean(dto.adverseDrivingEnabled),
      shortHaulException: Boolean(dto.shortHaulException),
      splitSleeperEnabled: Boolean(dto.splitSleeperEnabled),
      eldExempt: Boolean(dto.eldExempt),
      eldExemptReason: (dto.eldExemptReason as string) ?? null,
      appVersion: null,
      appPlatform: null,
      registeredAt: new Date().toISOString(),
      emailVerifiedAt: null,
    };
    DRIVERS.unshift(created);
    return ok(created, 201);
  }),

  http.patch(url(endpoints.drivers.update(':id')), async ({ params, request }) => {
    const driver = findDriver(String(params.id));
    if (!driver) return NOT_FOUND('Driver');
    // `assignedVehicleId` is create-only; the unit link changes through `assign-driver`.
    const { assignedVehicleId: _ignored, ...dto } = await body(request);
    const uniqueFail = driverUniqueConflict(dto, driver.id);
    if (uniqueFail) return uniqueFail;
    Object.assign(driver, dto);
    return ok(driver);
  }),

  http.delete(url(endpoints.drivers.remove(':id')), ({ params }) => {
    const driver = findDriver(String(params.id));
    if (!driver) return NOT_FOUND('Driver');
    driver.status = 'TERMINATED';
    driver.assignedVehicleId = null;
    return ok({ id: driver.id, status: 'TERMINATED', assignedVehicleId: null });
  }),

  http.post(url(endpoints.drivers.import), async ({ request }) => {
    const dto = (await body(request)) as { drivers?: Array<Record<string, unknown>> };
    const rows = dto.drivers ?? [];
    let imported = 0;
    const failed: Array<{ index: number; error: string }> = [];
    rows.forEach((row, index) => {
      if (!row.username || !row.firstName || !row.lastName) {
        failed.push({ index, error: 'username, firstName and lastName are required' });
        return;
      }
      DRIVERS.unshift({
        ...DRIVERS[0]!,
        id: mockId('drv'),
        username: String(row.username),
        firstName: String(row.firstName),
        lastName: String(row.lastName),
        email: (row.email as string) ?? null,
        cdlNumber: String(row.cdlNumber ?? ''),
        assignedVehicleId: null,
        status: 'ACTIVE',
        registeredAt: new Date().toISOString(),
      });
      imported += 1;
    });
    return ok({ imported, updated: 0, failed });
  }),

  /* ---------------------------------------------------------------- devices, trailers, geofences */
  // One box per unit (minus a few spares), so the Vehicles table's ELD SERIAL column and W-20 ELD
  // devices describe the same fleet instead of the single generated example row.
  http.get(url(endpoints.devices.list), ({ request }) =>
    ok(serverPage<DeviceRow>(DEVICES, request, ['serial', 'model'])),
  ),
  http.get(url(endpoints.devices.detail(':id')), ({ params }) => {
    const device = DEVICES.find((d) => d.id === String(params.id));
    return device ? ok(device) : NOT_FOUND('Device');
  }),
  http.post(url(endpoints.devices.create), async ({ request }) => {
    const dto = await body(request);
    const created: DeviceRow = {
      id: mockId('dev'),
      serial: String(dto.serial ?? ''),
      model: (dto.model as DeviceRow['model']) ?? 'PT30',
      status: 'UNASSIGNED',
      vehicleId: null,
      bleState: 'DISCONNECTED',
      firmwareVersion: (dto.firmware as string) ?? 'L108',
      firmwareOutdated: false,
      lastHeartbeatAt: null,
      storedEventsCount: 0,
    };
    if (DEVICES.some((d) => d.serial === created.serial)) {
      return fail(409, 'DUPLICATE_SERIAL', 'A device with this serial is already registered.', {
        serial: 'A device with this serial is already registered.',
      });
    }
    DEVICES.unshift(created);
    return ok(created, 201);
  }),
  http.post(url(endpoints.devices.pair(':id')), async ({ params, request }) => {
    const device = DEVICES.find((d) => d.id === String(params.id));
    if (!device) return NOT_FOUND('Device');
    const dto = await body(request);
    const vehicleId = String(dto.vehicleId ?? '');
    for (const other of DEVICES) if (other.vehicleId === vehicleId) other.vehicleId = null;
    device.vehicleId = vehicleId;
    device.status = 'ASSIGNED';
    return ok(device);
  }),
  http.post(url(endpoints.devices.unpair(':id')), ({ params }) => {
    const device = DEVICES.find((d) => d.id === String(params.id));
    if (!device) return NOT_FOUND('Device');
    device.vehicleId = null;
    device.status = 'UNASSIGNED';
    return ok(device);
  }),
  http.patch(url(endpoints.devices.firmware(':id')), async ({ params, request }) => {
    const device = DEVICES.find((d) => d.id === String(params.id));
    if (!device) return NOT_FOUND('Device');
    device.firmwareVersion = String((await body(request)).firmware ?? device.firmwareVersion);
    device.firmwareOutdated = false;
    return ok(device);
  }),
  http.patch(url(endpoints.devices.bleStatus(':id')), async ({ params, request }) => {
    const device = DEVICES.find((d) => d.id === String(params.id));
    if (!device) return NOT_FOUND('Device');
    device.bleState = ((await body(request)).bleState as DeviceRow['bleState']) ?? device.bleState;
    return ok(device);
  }),
  http.delete(url(endpoints.devices.remove(':id')), ({ params }) => {
    const index = DEVICES.findIndex((d) => d.id === String(params.id));
    if (index === -1) return NOT_FOUND('Device');
    const [removed] = DEVICES.splice(index, 1);
    return ok({ ...removed!, status: 'RETIRED' });
  }),
  http.post(url(endpoints.devices.import), () => ok(fixture('POST /api/devices/import'))),

  // Trailers (backend `TrailersService`): server-paged list over NON-deleted rows; `number` is unique
  // among non-deleted rows only; DELETE is soft; export skips deleted rows.
  http.get(url(endpoints.trailers.list), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const page = params.has('page') ? Number(params.get('page')) : 1;
    const limit = params.has('limit') ? Number(params.get('limit')) : 25;
    const status = params.get('status');
    const sort = params.get('sort');
    const q = (params.get('q') ?? '').trim().toLowerCase();
    const bad: Record<string, string> = {};
    if (!Number.isInteger(page) || page < 1) bad.page = 'page must be an integer ≥ 1.';
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) bad.limit = 'limit must be an integer between 1 and 200.';
    if (status && !['ACTIVE', 'INACTIVE', 'OUT_OF_SERVICE'].includes(status)) bad.status = 'Invalid status.';
    if (sort && !/^(number|vin|status):(asc|desc)$/.test(sort)) bad.sort = 'sort must be number|vin|status:asc|desc.';
    if (Object.keys(bad).length > 0) return fail(422, 'VALIDATION_FAILED', 'Validation failed.', bad);
    let rows = liveTrailers().filter(
      (t) => (!status || t.status === status) && (!q || t.number.toLowerCase().includes(q) || (t.vin ?? '').toLowerCase().includes(q)),
    );
    const [field, dir] = (sort ?? 'number:asc').split(':') as ['number' | 'vin' | 'status', 'asc' | 'desc'];
    rows = [...rows].sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * (dir === 'desc' ? -1 : 1));
    return ok({
      items: rows.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
    });
  }),
  http.get(url(endpoints.trailers.detail(':id')), ({ params }) => {
    const trailer = liveTrailers().find((t) => t.id === String(params.id));
    return trailer ? ok(trailer) : NOT_FOUND('Trailer');
  }),
  http.post(url(endpoints.trailers.create), async ({ request }) => {
    const dto = await body(request);
    const number = String(dto.number ?? '').trim();
    if (!number || number.length > 40) return fail(422, 'VALIDATION_FAILED', 'Invalid trailer.', { number: 'Enter a trailer number of up to 40 characters.' });
    if (liveTrailers().some((t) => t.number.toUpperCase() === number.toUpperCase())) {
      return fail(409, 'CONFLICT', `Trailer "${number}" already exists.`);
    }
    const created: TrailerRow = { id: mockId('trl'), number, vin: dto.vin ? String(dto.vin) : null, status: 'ACTIVE', deletedAt: null };
    TRAILERS.push(created);
    return ok(created, 201);
  }),
  http.patch(url(endpoints.trailers.update(':id')), async ({ params, request }) => {
    const trailer = liveTrailers().find((t) => t.id === String(params.id));
    if (!trailer) return NOT_FOUND('Trailer');
    const dto = await body(request);
    if (typeof dto.number === 'string' && dto.number.trim()) {
      const number = dto.number.trim();
      if (liveTrailers().some((t) => t.id !== trailer.id && t.number.toUpperCase() === number.toUpperCase())) {
        return fail(409, 'CONFLICT', `Trailer "${number}" already exists.`);
      }
      trailer.number = number;
    }
    if (typeof dto.vin === 'string') trailer.vin = dto.vin || null;
    if (typeof dto.status === 'string') trailer.status = dto.status as TrailerRow['status'];
    return ok(trailer);
  }),
  // Soft delete: succeeds regardless of references; already-deleted → 404.
  http.delete(url(endpoints.trailers.remove(':id')), ({ params }) => {
    const trailer = liveTrailers().find((t) => t.id === String(params.id));
    if (!trailer) return NOT_FOUND('Trailer');
    trailer.deletedAt = new Date().toISOString();
    trailer.status = 'INACTIVE';
    return ok({ success: true });
  }),
  // Upsert by `number` among non-deleted rows, per-row failures in `failed` (201, not a 4xx).
  http.post(url(endpoints.trailers.import), async ({ request }) => {
    const dto = await body(request);
    const rows = Array.isArray(dto.trailers) ? (dto.trailers as Array<Record<string, unknown>>) : [];
    let imported = 0;
    let updated = 0;
    const failed: Array<{ index: number; error: string }> = [];
    rows.forEach((row, index) => {
      const number = String(row.number ?? '').trim();
      if (!number || number.length > 40) {
        failed.push({ index, error: 'Trailer number is required (up to 40 characters).' });
        return;
      }
      const existing = liveTrailers().find((t) => t.number.toUpperCase() === number.toUpperCase());
      if (existing) {
        if (typeof row.vin === 'string') existing.vin = row.vin || null;
        updated += 1;
      } else {
        TRAILERS.push({ id: mockId('trl'), number, vin: row.vin ? String(row.vin) : null, status: 'ACTIVE', deletedAt: null });
        imported += 1;
      }
    });
    return ok({ imported, updated, failed }, 201);
  }),

  // B-104 — `vehicleGroupId` (null = all groups) is echoed with its `vehicleGroupName`; an
  // unknown group is the backend's 404 VEHICLE_GROUP_NOT_FOUND.
  http.post(url(endpoints.geofences.create), async ({ request }) => {
    const dto = await body(request);
    const group = geofenceGroup(dto.vehicleGroupId ?? null);
    if (!group) return fail(404, 'VEHICLE_GROUP_NOT_FOUND', 'Vehicle group not found.');
    return ok({ ...(fixture('POST /api/geofences') as Record<string, unknown>), ...dto, ...group, id: mockId('gf') }, 201);
  }),
  http.patch(url(endpoints.geofences.update(':id')), async ({ params, request }) => {
    const dto = await body(request);
    const group = dto.vehicleGroupId === undefined ? {} : geofenceGroup(dto.vehicleGroupId);
    if (!group) return fail(404, 'VEHICLE_GROUP_NOT_FOUND', 'Vehicle group not found.');
    return ok({ ...(fixture('PATCH /api/geofences/{id}') as Record<string, unknown>), ...dto, ...group, id: String(params.id) });
  }),
  http.delete(url(endpoints.geofences.remove(':id')), () => ok(fixture('DELETE /api/geofences/{id}'))),

  /** B-7 (shipped 2026-09-24) — the documented offset page; no seeded pairings (team driving is rare). */
  http.get(url(endpoints.coDriverPairings.list), ({ request }) => ok(serverPage([], request))),
  /** Telemetry read path (shipped 2026-09-24) — `{ items }` newest first, the documented row shape.
   * Every `Decimal` column (lat/lon, engine/idle hours, MPG, voltage) now serialises as a JSON
   * number on the live API (confirmed on :3002, 2026-09-24) — the mock follows suit. */
  http.get(url(endpoints.vehicles.telemetry(':id')), ({ params }) =>
    ok({
      items: [
        {
          time: daysAgo(0),
          vehicleId: String(params.id),
          driverId: null,
          latitude: 39.9612,
          longitude: -82.9988,
          speedMph: 0,
          headingDeg: 90,
          odometerMi: findVehicle(String(params.id))?.odometerMi ?? 0,
          engineHours: 12400,
          idleHours: 310.5,
          engineOn: false,
          rpm: 0,
          fuelPct: 62,
          defPct: 80,
          fuelEconomyMpg: 6.4,
          coolantTempC: 79,
          oilTempC: 88,
          voltage: 13.9,
          dtcCount: 0,
        },
      ],
    }),
  ),
];

/** `/trips/:id` captures the literal "unassigned-loads", so these are registered AFTER
 * `tripsMessagingGapHandlers` in `index.ts` rather than with the set above (WB-016). */
export const tripDetailHandlers = [
  http.get(url(endpoints.trips.detail(':id')), ({ params }) =>
    ok({ ...(fixture('GET /api/trips/{id}') as Record<string, unknown>), id: String(params.id) }),
  ),
  /** A seeded trip is patched in place; DELIVERED / CANCELLED refuse any non-status field with
   * 409 `TRIP_NOT_EDITABLE` (backend contract). Unknown ids keep the generated fixture echo. */
  http.patch(url(endpoints.trips.update(':id')), async ({ params, request }) => {
    const dto = await body(request);
    const trip = findMockTrip(String(params.id));
    if (!trip) return ok({ ...(fixture('PATCH /api/trips/{id}') as Record<string, unknown>), ...dto, id: String(params.id) });
    const fieldEdit = Object.keys(dto).some((key) => key !== 'status');
    if (fieldEdit && (trip.status === 'DELIVERED' || trip.status === 'CANCELLED')) {
      return fail(409, 'TRIP_NOT_EDITABLE', 'Delivered or cancelled trips cannot be edited.');
    }
    Object.assign(trip, dto);
    return ok(trip);
  }),
  /** Hard delete → 204; 404 unknown; 409 `TRIP_IN_PROGRESS` while the driver is running it. */
  http.delete(url(endpoints.trips.remove(':id')), ({ params }) => {
    const trip = findMockTrip(String(params.id));
    if (!trip) return NOT_FOUND('Trip');
    if (trip.status === 'IN_PROGRESS') {
      return fail(409, 'TRIP_IN_PROGRESS', 'This trip is in progress and cannot be deleted.');
    }
    removeMockTrip(trip.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
