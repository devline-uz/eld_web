// Silent-failure sweep — every 400/422 from a vehicles form lands somewhere the user can see:
// under the input it names, or spelled out (`formErrorMessage`) instead of a bare generic line.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ToastProvider } from '@/shared/ui/Toast';
import type { VehicleRow } from '@/shared/api/vehicles';
import { AddVehicleModal } from './AddVehicleModal';
import { CalibrateOdometerModal } from './CalibrateOdometerModal';
import { ImportVehiclesModal } from './ImportVehiclesModal';
import { AssignDriverModal } from './AssignDriverModal';

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

const issues = (...list: Array<[string, string]>) => ({
  issues: list.map(([path, message]) => ({ path, code: 'custom', message })),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('11.2 Add / Edit unit — server validation is never silent', () => {
  async function saveEdit() {
    const user = userEvent.setup();
    renderWithProviders(<AddVehicleModal vehicle={VEHICLE} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
  }

  it('an issue on a field without an error line (`notes`) is spelled out in the toast', async () => {
    server.use(
      http.patch(url(endpoints.vehicles.update(':id')), () =>
        fail(422, 'VALIDATION_FAILED', 'Request validation failed.', issues(['notes', 'String must contain at most 500 character(s)'])),
      ),
    );
    await saveEdit();
    expect(await screen.findByText('Notes: String must contain at most 500 character(s).')).toBeInTheDocument();
  });

  it('`odometerMi` lands under the Odometer input, not in a toast', async () => {
    server.use(
      http.patch(url(endpoints.vehicles.update(':id')), () =>
        fail(422, 'VALIDATION_FAILED', 'Request validation failed.', issues(['odometerMi', 'Number must be greater than or equal to 0'])),
      ),
    );
    await saveEdit();
    const error = await screen.findByText('Number must be greater than or equal to 0');
    expect(screen.getByLabelText(/Odometer at activation/).closest('label')).toContainElement(error);
    expect(screen.queryByText(/Check the highlighted fields/)).not.toBeInTheDocument();
  });

  it('caps make / model / notes at the `CreateVehicleDto` lengths', () => {
    renderWithProviders(<AddVehicleModal onClose={() => {}} />);
    expect(screen.getByLabelText(/^Make/)).toHaveAttribute('maxLength', '60');
    expect(screen.getByLabelText(/^Model/)).toHaveAttribute('maxLength', '60');
    expect(screen.getByLabelText(/^Notes/)).toHaveAttribute('maxLength', '500');
  });
});

describe('11.5 Calibrate odometer — server validation', () => {
  it('an `odometerMi` issue shows under the input', async () => {
    server.use(
      http.post(url(endpoints.vehicles.calibrateOdometer(':id')), () =>
        fail(422, 'VALIDATION_FAILED', 'Request validation failed.', issues(['odometerMi', 'Expected integer, received float'])),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CalibrateOdometerModal vehicle={VEHICLE} onClose={() => {}} />);
    await user.type(screen.getByLabelText(/Dashboard odometer/), '993611');
    await user.click(screen.getByRole('button', { name: 'Save calibration' }));

    const error = await screen.findByText('Expected integer, received float');
    expect(screen.getByLabelText(/Dashboard odometer/)).toHaveAttribute('aria-invalid', 'true');
    expect(error).toHaveAttribute('role', 'alert');
  });

  it('any other refusal is shown in the modal as an alert', async () => {
    server.use(
      http.post(url(endpoints.vehicles.calibrateOdometer(':id')), () =>
        fail(409, 'ODOMETER_ANOMALY', 'Odometer anomaly'),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CalibrateOdometerModal vehicle={VEHICLE} onClose={() => {}} />);
    await user.type(screen.getByLabelText(/Dashboard odometer/), '993611');
    await user.click(screen.getByRole('button', { name: 'Save calibration' }));

    expect(await screen.findByText('The odometer reading does not match the recorded mileage.')).toHaveAttribute('role', 'alert');
  });
});

describe('11.4 Assign driver — server validation', () => {
  it('a 422 is spelled out, not the generic "check the highlighted fields"', async () => {
    server.use(
      http.get(url(endpoints.drivers.list), () =>
        ok({ items: [{ id: 'drv_1', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', assignedVehicleId: null, homeTerminalName: 'Columbus, OH' }], page: 1, limit: 25, total: 1, totalPages: 1 }),
      ),
      http.post(url(endpoints.vehicles.assignDriver(':id')), () =>
        fail(422, 'VALIDATION_FAILED', 'Request validation failed.', issues(['driverId', 'Invalid uuid'])),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AssignDriverModal vehicle={VEHICLE} onClose={() => {}} />);
    await user.click(await screen.findByText('John Smith'));
    await user.click(screen.getByRole('button', { name: 'Assign driver' }));

    expect(await screen.findByText('Driver: Invalid uuid.')).toBeInTheDocument();
  });
});

describe('11.6 Import vehicles — no silent dead end', () => {
  it('a header-only file says why Import stays disabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportVehiclesModal onClose={() => {}} />);
    const file = new File(['unitNumber,vin\n'], 'units.csv', { type: 'text/csv' });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(await screen.findByRole('alert')).toHaveTextContent('The file has no unit rows.');
    expect(screen.getByRole('button', { name: 'Import units' })).toBeDisabled();
  });
});
