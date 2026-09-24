// W-03/W-04/W-06/W-07 write paths — `POST /vehicles`, `/vehicles/:id/assign-driver`,
// `/vehicles/:id/calibrate-odometer`, `POST /drivers`, the two import endpoints and the CSV
// exports. None of them had a handler, so in `dev:mock` every Save fell through to
// `localhost:3002` and died with `net::ERR_FAILED` (mock-layer audit, 2026-09-23).
//
// The reads are here too: `GET /vehicles` and `GET /drivers` answer from the same mutable
// `mockState` tables the writes edit, so a unit added in the drawer is in the next page, and an
// assigned driver shows up in the DRIVER column without a reload — the behaviour the real API has.
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import type { DriverRow, VehicleRow } from '@/shared/api/vehicles';
import { fixture } from '../fixtures.generated';
import { fail, ok, serverPage, url } from '../envelope';
import type { DeviceRow } from '@/shared/api/settingsAdmin';
import { DEVICES, DRIVERS, VEHICLES, daysAgo, mockId } from './mockState';

const VEHICLE_Q_FIELDS = ['unitNumber', 'vin', 'make', 'model', 'licensePlate'];
const DRIVER_Q_FIELDS = ['firstName', 'lastName', 'username', 'cdlNumber', 'email'];

const findVehicle = (id: string): VehicleRow | undefined => VEHICLES.find((v) => v.id === id);
const findDriver = (id: string): DriverRow | undefined => DRIVERS.find((d) => d.id === id);

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
      vehicles: VEHICLES.map((v) => ({
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
  http.get(url(endpoints.trailers.export), () => ok(fixture('GET /api/trailers/export'))),

  /* ---------------------------------------------------------------- vehicles */
  http.get(url(endpoints.vehicles.list), ({ request }) =>
    ok(serverPage<VehicleRow>(VEHICLES, request, VEHICLE_Q_FIELDS)),
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
    if (VEHICLES.some((v) => v.unitNumber.replace('#', '') === unitNumber.replace('#', ''))) {
      return fail(409, 'DUPLICATE_UNIT_NUMBER', 'A unit with this number already exists.', {
        unitNumber: 'A unit with this number already exists.',
      });
    }
    const odometerMi = Number(dto.odometerMi ?? 0);
    const created: VehicleRow = {
      id: mockId('veh'),
      unitNumber,
      vin: String(dto.vin),
      make: (dto.make as string) ?? null,
      model: (dto.model as string) ?? null,
      year: dto.year == null ? null : Number(dto.year),
      licensePlate: (dto.licensePlate as string) ?? null,
      plateState: (dto.plateState as string) ?? null,
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
    return ok(created, 201);
  }),

  http.patch(url(endpoints.vehicles.update(':id')), async ({ params, request }) => {
    const vehicle = findVehicle(String(params.id));
    if (!vehicle) return NOT_FOUND('Vehicle');
    Object.assign(vehicle, await body(request));
    return ok(vehicle);
  }),

  http.delete(url(endpoints.vehicles.remove(':id')), ({ params }) => {
    const index = VEHICLES.findIndex((v) => v.id === String(params.id));
    if (index === -1) return NOT_FOUND('Vehicle');
    const [removed] = VEHICLES.splice(index, 1);
    for (const driver of DRIVERS) {
      if (driver.assignedVehicleId === removed!.id) driver.assignedVehicleId = null;
    }
    return ok({ ...removed!, status: 'INACTIVE' });
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
    if (DRIVERS.some((d) => d.username === username)) {
      return fail(409, 'DUPLICATE_USERNAME', 'This username is already taken.', {
        username: 'This username is already taken.',
      });
    }
    const assignedVehicleId = (dto.assignedVehicleId as string) ?? null;
    if (assignedVehicleId) {
      for (const other of DRIVERS) {
        if (other.assignedVehicleId === assignedVehicleId) other.assignedVehicleId = null;
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
    };
    DRIVERS.unshift(created);
    return ok(created, 201);
  }),

  http.patch(url(endpoints.drivers.update(':id')), async ({ params, request }) => {
    const driver = findDriver(String(params.id));
    if (!driver) return NOT_FOUND('Driver');
    Object.assign(driver, await body(request));
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

  http.post(url(endpoints.trailers.create), () => ok(fixture('POST /api/trailers'), 201)),

  http.post(url(endpoints.geofences.create), async ({ request }) => {
    const dto = await body(request);
    return ok({ ...(fixture('POST /api/geofences') as Record<string, unknown>), ...dto, id: mockId('gf') }, 201);
  }),
  http.patch(url(endpoints.geofences.update(':id')), async ({ params, request }) =>
    ok({ ...(fixture('PATCH /api/geofences/{id}') as Record<string, unknown>), ...(await body(request)), id: String(params.id) }),
  ),
  http.delete(url(endpoints.geofences.remove(':id')), () => ok(fixture('DELETE /api/geofences/{id}'))),

  /** B-7 (shipped 2026-09-24) — the documented offset page; no seeded pairings (team driving is rare). */
  http.get(url(endpoints.coDriverPairings.list), ({ request }) => ok(serverPage([], request))),
  /** Telemetry read path (shipped 2026-09-24) — `{ items }` newest first, the documented row shape. */
  http.get(url(endpoints.vehicles.telemetry(':id')), ({ params }) =>
    ok({
      items: [
        {
          time: daysAgo(0),
          vehicleId: String(params.id),
          driverId: null,
          latitude: '39.961200',
          longitude: '-82.998800',
          speedMph: 0,
          headingDeg: 90,
          odometerMi: findVehicle(String(params.id))?.odometerMi ?? 0,
          engineHours: '12400.00',
          idleHours: '310.50',
          engineOn: false,
          rpm: 0,
          fuelPct: 62,
          defPct: 80,
          fuelEconomyMpg: '6.40',
          coolantTempC: 79,
          oilTempC: 88,
          voltage: '13.9',
          dtcCount: 0,
        },
      ],
    }),
  ),
];

/** `/trips/:id` captures the literal "unassigned-loads", so these two are registered AFTER
 * `tripsMessagingGapHandlers` in `index.ts` rather than with the set above (WB-016). */
export const tripDetailHandlers = [
  http.get(url(endpoints.trips.detail(':id')), ({ params }) =>
    ok({ ...(fixture('GET /api/trips/{id}') as Record<string, unknown>), id: String(params.id) }),
  ),
  http.patch(url(endpoints.trips.update(':id')), async ({ params, request }) =>
    ok({ ...(fixture('PATCH /api/trips/{id}') as Record<string, unknown>), ...(await body(request)), id: String(params.id) }),
  ),
];
