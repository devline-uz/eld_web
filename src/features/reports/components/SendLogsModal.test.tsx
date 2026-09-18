// ⭐ 11.14 Send logs to a safety official — FMCSA constraints, test mode, refusals verbatim, polling.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthProviderModule from '@/shared/auth/AuthProvider';
import { http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { rangeDays, reportScreenHandlers, transferRows } from '@/mocks/handlers/reports';
import { endpoints } from '@/shared/api/endpoints';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { VALIDATION_MESSAGES as M } from '@/shared/forms/messages';
import type { Role } from '@/shared/auth/permissions';
import { ToastProvider } from '@/shared/ui/Toast';
import { TEST_BANNER_TEXT } from '../sendLogs';
import { SendLogsModal, type SendLogsModalProps } from './SendLogsModal';

const mocks = vi.hoisted(() => ({ role: 'FLEET_MANAGER' as string }));

vi.mock('@/shared/auth/AuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthProviderModule>();
  const { buildMockAuthContext } = await import('../../../../tests/fixtures/mockAuth');
  return { ...actual, useAuth: () => buildMockAuthContext(mocks.role as Role) };
});

const BASE = { driverId: 'drv_1', from: '2026-09-03', to: '2026-09-10', outputFileComment: 'ROADSIDE INSPECTION 2026-09-10' };

function renderModal(props: Partial<SendLogsModalProps> = {}) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <SendLogsModal open onClose={onClose} erodsMode={undefined} eldIdentifier="OBK1" timezone="America/New_York" initial={BASE} {...props} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose, dialog: () => screen.getAllByRole('dialog')[0] as HTMLElement };
}

let posts: unknown[] = [];
const capturePosts = (respond: () => Response) =>
  http.post(url(endpoints.transfers.create), async ({ request }) => {
    posts.push(await request.json());
    return respond();
  });

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  posts = [];
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(...reportScreenHandlers);
  mocks.role = 'FLEET_MANAGER';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:csv'), revokeObjectURL: vi.fn() });
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('11.14 Send logs to a safety official', () => {
  it('renders the drawn modal with the TEST banner, file preview and pre-send warnings', async () => {
    const { dialog } = renderModal();
    const d = within(dialog());
    expect(d.getByText('Send logs to a safety official')).toBeInTheDocument();
    expect(d.getByText('FMCSA §395.34 data transfer · 8 days ending Sep 10, 2026')).toBeInTheDocument();
    expect(d.getByText('eRODS · TEST mode')).toBeInTheDocument();
    expect(d.getByText(TEST_BANNER_TEXT)).toBeInTheDocument();
    expect(d.getByRole('radio', { name: /Web services \(eRODS\)/ })).toBeChecked();
    expect(d.getByText('Uploads directly to the FMCSA endpoint. Preferred at roadside.')).toBeInTheDocument();
    expect(d.getByText('Encrypted file sent to an fmcsa.dot.gov address only.')).toBeInTheDocument();
    expect(d.getByText('Provided by the safety official. Maximum 60 characters.')).toBeInTheDocument();
    expect(d.getByText('30/60')).toBeInTheDocument();
    expect(d.getByText('RODS, edits, annotations, DVIRs, ELD malfunctions')).toBeInTheDocument();
    expect(d.getByText('ELD registration #OBK1 · TEST (pending)')).toHaveClass('text-warning');
    expect(d.getByText('—')).toBeInTheDocument(); // file name: never built client-side
    expect(await d.findByText('UNRESOLVED_UNIDENTIFIED')).toBeInTheDocument();
    expect(d.getByText('UNCERTIFIED_LOGS')).toBeInTheDocument();
    // WB-101 — 3 RODS days exist in the 8-day range; calendar days are not daily logs.
    expect(await d.findByText('3 daily logs · — events · 3 unassigned')).toBeInTheDocument();
    expect(d.getByRole('button', { name: 'Download a copy' })).toBeDisabled();
    expect(await d.findByText('John Smith')).toBeInTheDocument();
  });

  it('sends an eRODS transfer, shows the test-mode warning toast and hands over a copy', async () => {
    server.use(
      capturePosts(() =>
        ok(
          {
            transfer: { ...transferRows[0], id: 'trf_new', status: 'QUEUED' },
            warnings: [{ code: 'ERODS_TEST_MODE', level: 'warning', message: 'eRODS is in TEST mode.' }],
            counts: { header: 9, events: 42 },
          },
          201,
        ),
      ),
    );
    const { dialog, onClose } = renderModal();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send transfer' }));

    expect(await screen.findByText('Transfer completed in test mode')).toBeInTheDocument();
    expect(screen.getByText('The file was not sent to FMCSA. Download a copy for the officer.')).toBeInTheDocument();
    expect(posts).toEqual([
      { driverId: 'drv_1', method: 'WEB_SERVICES', rangeStart: '2026-09-03', rangeEnd: '2026-09-10', outputFileComment: 'ROADSIDE INSPECTION 2026-09-10' },
    ]);
    const d = within(dialog());
    expect(d.getByText('SMITH38018.csv')).toBeInTheDocument();
    expect(await d.findByText('3 daily logs · 42 events · 3 unassigned')).toBeInTheDocument();
    expect(d.getByText('ERODS_TEST_MODE')).toBeInTheDocument();
    expect(d.getByText('eRODS is in test mode — the file will not reach FMCSA.', { exact: false })).toBeInTheDocument();
    expect(await d.findByText('Test only')).toBeInTheDocument();
    expect(d.queryByRole('button', { name: 'Send transfer' })).toBeNull();

    await userEvent.click(d.getByRole('button', { name: 'Download a copy' }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    // The header X is also named "Close"; this is the footer button.
    await userEvent.click(d.getAllByRole('button', { name: 'Close' }).find((b) => b.textContent === 'Close') as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('never sends a range longer than 8 days', async () => {
    server.use(capturePosts(() => ok({})));
    const { dialog } = renderModal({ initial: { ...BASE, from: '2026-09-02' } });
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send transfer' }));
    expect(await within(dialog()).findByText(M.transferRange)).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('never sends an email transfer to a non-fmcsa.dot.gov address', async () => {
    server.use(capturePosts(() => ok({})));
    const { dialog } = renderModal({ initial: { ...BASE, method: 'EMAIL', recipient: 'officer@gmail.com' } });
    expect(within(dialog()).getByRole('textbox', { name: /Inspector email address/ })).toHaveValue('officer@gmail.com');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send transfer' }));
    expect(await within(dialog()).findByText('Only fmcsa.dot.gov addresses are accepted.')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('never sends a comment over 60 characters or an empty one', async () => {
    server.use(capturePosts(() => ok({})));
    const { dialog } = renderModal({ initial: { ...BASE, outputFileComment: 'X'.repeat(61) } });
    expect(within(dialog()).getByText('61/60')).toHaveClass('text-danger');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send transfer' }));
    expect(await within(dialog()).findByText(M.outputFileComment)).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('shows INVALID_TRANSFER_RECIPIENT verbatim on the field and in the modal, without retrying', async () => {
    server.use(capturePosts(() => fail(422, 'INVALID_TRANSFER_RECIPIENT', 'Email transfer is accepted only for an fmcsa.dot.gov address.')));
    const { dialog } = renderModal({ initial: { ...BASE, method: 'EMAIL', recipient: 'inspector@fmcsa.dot.gov' } });
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send transfer' }));
    await waitFor(() => expect(within(dialog()).getAllByText('Only fmcsa.dot.gov addresses are accepted.')).toHaveLength(2));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ method: 'EMAIL', recipient: 'inspector@fmcsa.dot.gov' });
  });

  it.each([
    ['UNRESOLVED_UNIDENTIFIED', 'Resolve the unassigned driving segments first.'],
    ['UNCERTIFIED_LOGS', 'Some logs in this range are not certified.'],
    ['ACTIVE_MALFUNCTION', 'An ELD malfunction is active for this driver.'],
    ['ERODS_TEST_MODE', 'eRODS is in test mode — the file will not reach FMCSA.'],
  ])('shows the %s refusal verbatim', async (code, text) => {
    server.use(capturePosts(() => fail(422, code, 'refused')));
    const { dialog } = renderModal();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send transfer' }));
    expect(await within(dialog()).findByText(text)).toBeInTheDocument();
    expect(posts).toHaveLength(1);
  });

  it('maps RANGE_TOO_LARGE and field details back onto the form', async () => {
    server.use(capturePosts(() => fail(422, 'RANGE_TOO_LARGE', 'too wide', { fields: { outputFileComment: 'Comment rejected by the server.' } })));
    const { dialog } = renderModal();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send transfer' }));
    expect(await within(dialog()).findByText('Comment rejected by the server.')).toBeInTheDocument();
    expect(within(dialog()).getAllByText(/selected range is too large|at most 8 days/).length).toBeGreaterThan(0);
  });

  it('in PRODUCTION: no banner, Validation passed, and Transfer sent once the send lands', async () => {
    server.use(
      http.get(url(endpoints.logs.range(':driverId')), () =>
        ok({ driverId: 'drv_1', from: '2026-09-03', to: '2026-09-10', days: rangeDays.drv_1!.map((d) => ({ ...d, certified: true })) }),
      ),
      http.get(url(endpoints.unidentified.list), () => ok({ items: [], total: 0, page: 1 })),
      capturePosts(() =>
        ok({ transfer: { ...transferRows[0], id: 'trf_prod', status: 'QUEUED', erodsMode: 'PRODUCTION' }, warnings: [], counts: { events: 12 } }, 201),
      ),
      http.get(url(endpoints.transfers.detail(':id')), () => ok({ ...transferRows[0], id: 'trf_prod', status: 'SENT', erodsMode: 'PRODUCTION' })),
    );
    const { dialog } = renderModal({ erodsMode: 'PRODUCTION' });
    expect(within(dialog()).queryByText('eRODS · TEST mode')).toBeNull();
    expect(
      await within(dialog()).findByText('Validation passed. No unassigned segments or uncertified logs in this range.'),
    ).toBeInTheDocument();
    expect(within(dialog()).getByText('ELD registration #OBK1')).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send transfer' }));
    expect(await screen.findByText('Transfer sent')).toBeInTheDocument();
    expect(screen.getByText('The file was accepted by the FMCSA endpoint.')).toBeInTheDocument();
  });

  it.each([
    ['503', null, 'The FMCSA endpoint returned 503. Retry or send by email.'],
    ['REJECTED_BY_ENDPOINT', 'Signature invalid', 'Signature invalid'],
  ])('in PRODUCTION a failed send (%s) raises Data transfer failed', async (responseCode, responseBody, description) => {
    server.use(
      capturePosts(() =>
        ok({ transfer: { ...transferRows[0], id: 'trf_fail', status: 'QUEUED', erodsMode: 'PRODUCTION' }, warnings: [], counts: {} }, 201),
      ),
      http.get(url(endpoints.transfers.detail(':id')), () =>
        ok({ ...transferRows[0], id: 'trf_fail', status: 'FAILED', erodsMode: 'PRODUCTION', responseCode, responseBody }),
      ),
    );
    const { dialog } = renderModal({ erodsMode: 'PRODUCTION' });
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Send transfer' }));
    expect(await screen.findByText('Data transfer failed')).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it('confirms before discarding a dirty form (11.30)', async () => {
    const { dialog, onClose } = renderModal();
    await userEvent.type(within(dialog()).getByRole('textbox', { name: /Output file comment/ }), '!');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('switching to email reveals the inspector address field', async () => {
    const { dialog } = renderModal();
    expect(within(dialog()).queryByRole('textbox', { name: /Inspector email address/ })).toBeNull();
    await userEvent.click(within(dialog()).getByRole('radio', { name: /Email to a safety official/ }));
    expect(within(dialog()).getByRole('textbox', { name: /Inspector email address/ })).toBeInTheDocument();
  });

  it('defaults to the 8 days ending today in the carrier zone', () => {
    const { dialog } = renderModal({ initial: undefined });
    expect(within(dialog()).getByText(/FMCSA §395\.34 data transfer · 8 days ending /)).toBeInTheDocument();
  });
});
