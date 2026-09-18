// Smoke coverage for the vehicles overlays (11.2–11.6) — each renders, shows its title/labels,
// and its primary action reaches the network in the expected shape.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import type { VehicleRow } from '@/shared/api/vehicles';
import { AddVehicleModal } from './AddVehicleModal';
import { DeleteUnitModal } from './DeleteUnitModal';
import { AssignDriverModal } from './AssignDriverModal';
import { CalibrateOdometerModal } from './CalibrateOdometerModal';
import { ImportVehiclesModal } from './ImportVehiclesModal';

const VEHICLE: VehicleRow = {
  id: 'veh_1',
  unitNumber: '#101',
  vin: '1FUJGLDR8LLLL1234',
  make: 'Freightliner',
  model: 'Cascadia',
  year: 2021,
  licensePlate: '4821-JG',
  plateState: 'OH',
  fuelType: 'DIESEL',
  sleeperBerth: true,
  odometerMi: 993589,
  deviceOdometerMi: 981109,
  odometerOffsetMi: 12480,
  odometerCalibratedAt: null,
  engineHours: '1070.2',
  busType: null,
  status: 'ACTIVE',
  notes: null,
  activatedAt: '2025-04-18T00:00:00.000Z',
  createdAt: '2025-04-18T00:00:00.000Z',
};

function renderWithProviders(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('11.2 Add vehicle', () => {
  it('creates a unit and fires the exact §13.3 toast', async () => {
    server.use(http.post(url(endpoints.vehicles.create), () => ok({ id: 'veh_9', unitNumber: '126', status: 'ACTIVE' })));
    const user = userEvent.setup();
    renderWithProviders(<AddVehicleModal onClose={() => {}} />);

    await user.type(screen.getByLabelText(/Unit number/), '126');
    await user.type(screen.getByLabelText(/^Make/), 'Freightliner');
    await user.type(screen.getByLabelText(/^Model/), 'Cascadia');
    await user.clear(screen.getByLabelText(/^Year/));
    await user.type(screen.getByLabelText(/^Year/), '2023');
    await user.type(screen.getByLabelText(/^VIN/), '1FUJHHDR5NLNN4410');
    await user.click(screen.getByRole('button', { name: 'Save unit' }));

    expect(await screen.findByText('Unit #126 created')).toBeInTheDocument();
  });

  it('renders "Edit unit …" and "Save changes" in edit mode', () => {
    renderWithProviders(<AddVehicleModal vehicle={VEHICLE} onClose={() => {}} />);
    expect(screen.getByText('Edit unit #101')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });
});

describe('11.3 Delete unit', () => {
  it('keeps Delete disabled until the confirmation text matches, then deletes', async () => {
    server.use(http.delete(url(endpoints.vehicles.remove(':id')), () => ok({ id: 'veh_1', status: 'INACTIVE' })));
    const user = userEvent.setup();
    renderWithProviders(<DeleteUnitModal vehicle={VEHICLE} eldSerial="PT30_A86E" onClose={() => {}} />);

    expect(screen.getByText(/Historical logs, DVIRs and/)).toBeInTheDocument();
    const confirmButton = screen.getByRole('button', { name: 'Delete unit' });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('UNIT-101'), 'UNIT-101');
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(await screen.findByText('Unit #101 deleted')).toBeInTheDocument();
  });
});

describe('11.4 Assign driver', () => {
  it('shows the out-of-service refusal instead of a driver list', () => {
    renderWithProviders(<AssignDriverModal vehicle={{ ...VEHICLE, status: 'OUT_OF_SERVICE' }} onClose={() => {}} />);
    expect(screen.getByText(/is out of service/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign driver' })).toBeDisabled();
  });

  it('assigns the selected driver', async () => {
    server.use(
      http.get(url(endpoints.drivers.list), () =>
        ok({ items: [{ id: 'drv_1', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', assignedVehicleId: null, homeTerminalName: 'Columbus, OH' }], page: 1, limit: 25, total: 1, totalPages: 1 }),
      ),
      http.post(url(endpoints.vehicles.assignDriver(':id')), () => ok({ id: 'veh_1', assignedDriverId: 'drv_1' })),
    );
    const user = userEvent.setup();
    renderWithProviders(<AssignDriverModal vehicle={VEHICLE} onClose={() => {}} />);

    await user.click(await screen.findByText('John Smith'));
    await user.click(screen.getByRole('button', { name: 'Assign driver' }));

    expect(await screen.findByText('Driver assigned')).toBeInTheDocument();
  });
});

describe('11.5 Calibrate odometer', () => {
  it('shows the ECU + offset caption and saves a calibration', async () => {
    server.use(
      http.post(url(endpoints.vehicles.calibrateOdometer(':id')), () =>
        ok({ id: 'veh_1', odometerOffsetMiles: 12502, dashOdometerMiles: 993611, deviceOdometerMiles: 981109 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CalibrateOdometerModal vehicle={VEHICLE} onClose={() => {}} />);

    expect(screen.getByText('981,109 mi')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Dashboard odometer/), '993611');
    await user.click(screen.getByRole('button', { name: 'Save calibration' }));

    expect(await screen.findByText('Odometer calibrated')).toBeInTheDocument();
  });
});

describe('11.6 Import vehicles', () => {
  it('parses a dropped CSV and shows the row count before import', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportVehiclesModal onClose={() => {}} />);

    const file = new File(['unitNumber,vin\n201,1FUJGLDR8LLLL0001'], 'units.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText('units.csv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 1 units' })).toBeInTheDocument();
  });

  it('WB-106 — parses quoted fields with embedded commas and strips a leading BOM', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportVehiclesModal onClose={() => {}} />);

    const file = new File(
      ['﻿unitNumber,vin,notes\n201,1FUJGLDR8LLLL0001,"Yard A, bay 3"'],
      'units.csv',
      { type: 'text/csv' },
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText('units.csv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 1 units' })).toBeInTheDocument();
  });

  it('WB-108 — rejects a file over the advertised 2,000-row maximum', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportVehiclesModal onClose={() => {}} />);

    const body = Array.from({ length: 2001 }, (_, i) => `${200 + i},1FUJGLDR8LLLL${String(i).padStart(4, '0')}`).join('\n');
    const file = new File([`unitNumber,vin\n${body}`], 'units.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText(/File has 2001 rows — 2,000 rows maximum\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import units' })).toBeDisabled();
  });
});
