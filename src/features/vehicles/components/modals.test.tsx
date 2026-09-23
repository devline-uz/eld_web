// Smoke coverage for the vehicles overlays (11.2–11.6) — each renders, shows its title/labels,
// and its primary action reaches the network in the expected shape.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

  // WB-158 / B-74 — the tick was kept in local state and never sent.
  it('the "Notify the driver" checkbox is disabled with a visible reason', () => {
    renderWithProviders(<AssignDriverModal vehicle={VEHICLE} onClose={() => {}} />);
    const notify = screen.getByRole('checkbox', { name: /Notify the driver in the app/ });
    expect(notify).toBeDisabled();
    expect(screen.getByText(/the assign endpoint sends no notification/)).toBeInTheDocument();
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

describe('11.2 Add vehicle — double submit', () => {
  // WB-162 — the guard was RHF's `isSubmitting`, which clears before `mutate()`'s request lands.
  it('two fast clicks create one unit', async () => {
    let posts = 0;
    server.use(
      http.post(url(endpoints.vehicles.create), async () => {
        posts += 1;
        await new Promise((r) => setTimeout(r, 40));
        return ok({ ...VEHICLE, id: 'veh_new' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AddVehicleModal onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText('e.g. 126'), '126');
    await user.type(screen.getByLabelText(/^VIN/), '1FUJGLDR8LLLL9999');
    const [make, model] = screen.getAllByRole('textbox').slice(2);
    await user.type(make!, 'Freightliner');
    await user.type(model!, 'Cascadia');

    const save = screen.getByRole('button', { name: 'Save unit' });
    await user.click(save);
    await user.click(save);

    await vi.waitFor(() => expect(posts).toBeGreaterThan(0));
    expect(posts).toBe(1);
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

// WB — 11.30 Discard changes. Two defects met here: `Cancel` called `onClose` directly and walked
// straight past the confirm that Esc and X honour, and `AddVehicleModal` reported itself dirty at
// mount (react-hook-form's `isDirty` against `defaultValues`), so an untouched form asked to
// discard changes that did not exist.
describe('11.30 Discard changes — vehicles overlays', () => {
  it('an untouched Add vehicle form closes on Cancel with no confirm', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<AddVehicleModal onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('an untouched Edit unit form closes on Cancel with no confirm', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<AddVehicleModal vehicle={VEHICLE} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('an edited form confirms on Cancel, exactly as on Esc, and Keep editing keeps it open', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<AddVehicleModal onClose={onClose} />);

    await user.type(screen.getByLabelText(/Unit number/), '126');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc on an edited form confirms too (unchanged behaviour, guarded)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<AddVehicleModal onClose={onClose} />);

    await user.type(screen.getByLabelText(/Unit number/), '126');
    await user.keyboard('{Escape}');

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a change made outside react-hook-form (notes) also counts as dirty', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<AddVehicleModal onClose={onClose} />);

    await user.type(screen.getByLabelText(/Notes/), 'Yard A');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Cancel on a half-typed Delete confirmation asks before throwing the text away', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<DeleteUnitModal vehicle={VEHICLE} eldSerial={null} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();

    await user.type(screen.getByPlaceholderText('UNIT-101'), 'UNIT');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// WB — the >5,000 mi extra confirmation used to fail OPEN: a unit with no ELD odometer reading
// produced `NaN`, `NaN > 5000` is false, and the checkbox never appeared, so any value at all
// could be saved unchallenged. It now fails closed.
describe('11.5 Calibrate odometer — the large-delta guard fails closed', () => {
  const NO_DEVICE_READING = { ...VEHICLE, deviceOdometerMi: null };

  it('demands the extra confirmation when the device odometer is unknown', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CalibrateOdometerModal vehicle={NO_DEVICE_READING} onClose={() => {}} />);

    await user.type(screen.getByLabelText(/Dashboard odometer/), '993611');

    const confirmation = await screen.findByText(/no ELD odometer reading/);
    expect(confirmation).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save calibration' })).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Save calibration' })).toBeEnabled();
  });

  it('still demands it for a > 5,000 mi jump against a known reading', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CalibrateOdometerModal vehicle={VEHICLE} onClose={() => {}} />);

    await user.type(screen.getByLabelText(/Dashboard odometer/), '1200000');

    expect(await screen.findByText(/more than 5,000 mi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save calibration' })).toBeDisabled();
  });

  it('asks for nothing extra on a small correction against a known reading', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CalibrateOdometerModal vehicle={VEHICLE} onClose={() => {}} />);

    await user.type(screen.getByLabelText(/Dashboard odometer/), '993611');

    expect(screen.queryByText(/I confirm this value is correct/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save calibration' })).toBeEnabled();
  });
});

// WB — the import options had no counterpart in `POST /vehicles/import`, and the file card printed
// a hardcoded "N valid, 0 errors" that no validation had produced.
describe('11.6 Import vehicles — no invented state', () => {
  it('makes no validity claim about the parsed rows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportVehiclesModal onClose={() => {}} />);

    const file = new File(['unitNumber,vin\n201,1FUJGLDR8LLLL0001'], 'units.csv', { type: 'text/csv' });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(await screen.findByText('units.csv')).toBeInTheDocument();
    expect(screen.queryByText(/valid, 0 errors/)).not.toBeInTheDocument();
    expect(screen.getByText(/1 rows detected/)).toBeInTheDocument();
  });

  it('disables the options the import endpoint cannot accept, with the reason on screen', () => {
    renderWithProviders(<ImportVehiclesModal onClose={() => {}} />);

    expect(screen.getByText(/the import endpoint does not accept this option/)).toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
    for (const select of screen.getAllByRole('combobox')) expect(select).toBeDisabled();
  });
});
