// owner: web-settings-admin — W-22 Settings · Integrations (web/tz.md §10 W-22).
// Design: web/roles and screens/admin panel/Settings — integrations and API keys.jpg
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink, Plus, Copy } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Can } from '@/shared/auth/Can';
import { usePermission } from '@/shared/auth/usePermission';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Card, SectionHeader } from '@/shared/ui/Card';
import { ConfirmDelete, Modal } from '@/shared/ui/Modal';
import { DataTable } from '@/shared/ui/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';
import { useToast } from '@/shared/ui/Toast';
import { orDash } from '@/shared/format/empty';
import { formatRelative } from '@/shared/format/relative';
import { ApiError } from '@/shared/api/errors';
import {
  useIntegrationsList,
  useUpsertIntegration,
  useDisconnectIntegration,
  useApiKeysList,
  useRevokeApiKey,
  useIntegrationsCatalog,
  type IntegrationProvider,
  type ApiKeyRow,
  type IntegrationRow,
} from '@/shared/api/settingsAdmin';
import { CreateApiKeyModal } from './components/CreateApiKeyModal';
import { EditApiKeyScopesModal } from './components/EditApiKeyScopesModal';
import { INTEGRATION_STATUS, SETTINGS_REASON, SETTINGS_TOAST } from './lib/copy';

interface CatalogEntry {
  provider: IntegrationProvider | null;
  name: string;
  description: string;
}

// WB-232 — the cards used to carry hardcoded status lines ("69 devices syncing", "1,842 receipts
// this quarter", "Last sync 4 minutes ago", "Last export Sep 01"). No endpoint returns such figures;
// the status line is now derived from the integration record only (`integrationStatusLine`).
const CATALOG: CatalogEntry[] = [
  { provider: null, name: 'Pacific Track', description: 'ELD hardware · PT30 / PT40' },
  { provider: 'mcleod', name: 'McLeod PowerBroker', description: 'TMS · loads, stops and BOL' },
  { provider: 'wex', name: 'WEX fuel cards', description: 'Fuel purchases for IFTA' },
  { provider: 'quickbooks', name: 'QuickBooks Online', description: 'Accounting & driver settlements' },
  { provider: null, name: 'DAT load board', description: 'Find and book available loads' },
  { provider: 'slack', name: 'Slack', description: 'Push alerts into a channel' },
  { provider: null, name: 'Geotab', description: 'Import telematics from mixed fleets' },
  { provider: null, name: 'Zapier', description: 'Automate with 6,000+ apps' },
  { provider: 'webhook', name: 'Custom webhook', description: 'Send events to your own endpoint' },
];

/** The honest status line for a card: connection state and `lastSyncAt` from the API, nothing else. */
function integrationStatusLine(entry: CatalogEntry, record: IntegrationRow | undefined): string {
  if (!entry.provider) return INTEGRATION_STATUS.noConnector;
  if (record?.status !== 'CONNECTED') return INTEGRATION_STATUS.notConnected;
  return record.lastSyncAt ? INTEGRATION_STATUS.lastSync(formatRelative(record.lastSyncAt)) : INTEGRATION_STATUS.connectedNoSync;
}

export default function IntegrationsPage() {
  const { can } = usePermission();
  const canFull = can('integrations', 'FULL');
  const { toast } = useToast();
  const integrationsQuery = useIntegrationsList();
  const apiKeysQuery = useApiKeysList();
  const upsert = useUpsertIntegration();
  const disconnect = useDisconnectIntegration();
  const revokeKey = useRevokeApiKey();
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [scopesTarget, setScopesTarget] = useState<ApiKeyRow | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<CatalogEntry | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  // B-89 (shipped 2026-09-24) — `GET /integrations/catalog`. Fetched lazily, only while the
  // marketplace modal is open.
  const catalogQuery = useIntegrationsCatalog(marketplaceOpen);

  const byProvider = useMemo(
    () => Object.fromEntries(integrationsQuery.rows.map((i) => [i.provider, i])),
    [integrationsQuery.rows],
  );

  const connectedCount = CATALOG.filter((c) => c.provider && byProvider[c.provider]?.status === 'CONNECTED').length;
  const availableCount = CATALOG.length - connectedCount;

  function handleConnect(entry: { provider: IntegrationProvider | string; name: string }) {
    if (upsert.isPending) return;
    upsert.mutate(
      { provider: entry.provider, dto: { enabled: true, config: {} } },
      {
        onSuccess: () => toast({ kind: 'success', ...SETTINGS_TOAST.integrationConnected(entry.name) }),
        onError: (error) => toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
      },
    );
  }

  function handleDisconnect(entry: CatalogEntry) {
    if (!entry.provider) return;
    disconnect.mutate(entry.provider, {
      onSuccess: () => {
        toast({ kind: 'success', ...SETTINGS_TOAST.integrationDisconnected(entry.name) });
        setDisconnectTarget(null);
      },
      onError: (error) => {
        toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
        setDisconnectTarget(null);
      },
    });
  }

  // `Revoke` used to fire straight from the row menu with no confirm and no feedback — an
  // irreversible action that could also fail silently.
  function handleRevoke(key: ApiKeyRow) {
    revokeKey.mutate(key.id, {
      onSuccess: () => {
        toast({ kind: 'success', ...SETTINGS_TOAST.apiKeyRevoked(key.name) });
        setRevokeTarget(null);
      },
      onError: (error) => {
        toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' });
        setRevokeTarget(null);
      },
    });
  }

  const keyColumns: ColumnDef<ApiKeyRow, unknown>[] = [
    { accessorKey: 'name', header: 'NAME', cell: ({ row }) => <span className="text-text">{row.original.name}</span> },
    {
      id: 'key',
      header: 'KEY',
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-mono text-caption text-text-secondary">
          {row.original.prefix}••••••••
          <button
            type="button"
            aria-label="Copy key prefix"
            onClick={() => navigator.clipboard?.writeText(row.original.prefix)}
          >
            <Copy size={14} strokeWidth={1.75} />
          </button>
        </span>
      ),
    },
    { id: 'scope', header: 'SCOPE', cell: ({ row }) => <span className="text-text-secondary">{row.original.scopes.join(' · ')}</span> },
    { id: 'created', header: 'CREATED', cell: ({ row }) => <span className="text-text-secondary">{orDash(row.original.createdAt, formatRelative)}</span> },
    { id: 'lastUsed', header: 'LAST USED', cell: ({ row }) => <span className="text-text-secondary">{orDash(row.original.lastUsedAt, formatRelative)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text">Settings · Integrations</h1>
          <p className="text-page-sub text-text-muted">
            {connectedCount} connected · {availableCount} available
          </p>
        </div>
        {/* B-89 (shipped 2026-09-24) — `GET /integrations/catalog`. */}
        <Button
          variant="secondary"
          iconLeft={<ExternalLink size={16} strokeWidth={1.75} />}
          onClick={() => setMarketplaceOpen(true)}
        >
          Browse marketplace
        </Button>
      </div>

      {integrationsQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : integrationsQuery.isError ? (
        <Card>
          <ErrorState
            title="Could not load integrations"
            description="The list of connected systems did not load. Nothing was disconnected — try again in a moment."
            onRetry={() => integrationsQuery.refetch()}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {CATALOG.map((entry) => {
            const record = entry.provider ? byProvider[entry.provider] : undefined;
            const connected = record?.status === 'CONNECTED';
            return (
              <Card key={entry.name}>
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-md bg-bg-subtle text-body-strong text-text-secondary">
                    {entry.name.slice(0, 1)}
                  </span>
                  <Badge tone={connected ? 'success' : 'neutral'} dot={connected}>
                    {connected ? 'Connected' : 'Available'}
                  </Badge>
                </div>
                <p className="mt-3 text-card-title font-semibold text-text">{entry.name}</p>
                <p className="text-card-sub text-text-muted">{entry.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-caption tabular-nums text-text-muted">{integrationStatusLine(entry, record)}</span>
                  {canFull && entry.provider ? (
                    connected ? (
                      // WB-224 — the button was labelled `Manage` and disconnected the
                      // integration on the first click with no confirm. There is no
                      // configuration endpoint to manage anything with, so it says what it does
                      // and asks first.
                      <Button variant="danger-outline" size="sm" onClick={() => setDisconnectTarget(entry)}>
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        iconLeft={<Plus size={14} strokeWidth={1.75} />}
                        disabled={upsert.isPending}
                        onClick={() => handleConnect({ ...entry, provider: entry.provider! })}
                      >
                        Connect
                      </Button>
                    )
                  ) : canFull ? (
                    <Button variant="secondary" size="sm" disabled title={SETTINGS_REASON.providerUnavailable}>
                      Connect
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card padded={false}>
        <div className="flex items-center justify-between p-card">
          <SectionHeader title="API keys" subtitle="REST v2 · rate limit 600 requests / minute" />
          <Can perm="integrations" level="FULL">
            <Button variant="primary" iconLeft={<Plus size={16} strokeWidth={1.75} />} onClick={() => setCreateKeyOpen(true)}>
              Create key
            </Button>
          </Can>
        </div>
        {apiKeysQuery.isLoading ? (
          <LoadingState className="p-4" />
        ) : apiKeysQuery.isError ? (
          <ErrorState
            title="Could not load API keys"
            description="The key list did not load. Existing keys keep working — try again in a moment."
            onRetry={() => apiKeysQuery.refetch()}
          />
        ) : apiKeysQuery.rows.length === 0 ? (
          <EmptyState title="No API keys yet" description="Create a key to let another system read your fleet data." />
        ) : (
          <DataTable
            data={apiKeysQuery.rows}
            columns={keyColumns}
            caption="API keys"
            getRowId={(r) => r.id}
            rowActions={
              canFull
                ? (row) => (
                    <>
                      <DropdownMenu.Item
                        onSelect={() => setScopesTarget(row)}
                        className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle"
                      >
                        Edit scopes
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => setRevokeTarget(row)}
                        className="cursor-pointer rounded-md px-2 py-1.5 text-body text-danger outline-none hover:bg-danger-soft"
                      >
                        Revoke
                      </DropdownMenu.Item>
                    </>
                  )
                : undefined
            }
          />
        )}
      </Card>

      {marketplaceOpen && (
        <Modal
          open
          onClose={() => setMarketplaceOpen(false)}
          title="Integration marketplace"
          subtitle="Every connector OneBook offers"
          size="lg"
          footer={
            <Button variant="secondary" size="lg" onClick={() => setMarketplaceOpen(false)}>
              Close
            </Button>
          }
        >
          {catalogQuery.isLoading ? (
            <LoadingState rows={4} />
          ) : catalogQuery.isError ? (
            <ErrorState onRetry={() => catalogQuery.refetch()} />
          ) : (catalogQuery.data ?? []).length === 0 ? (
            <EmptyState title="No connectors listed" description="The marketplace has nothing to show right now." />
          ) : (
            <div className="flex flex-col gap-2">
              {(catalogQuery.data ?? []).map((entry) => {
                const connected = byProvider[entry.provider]?.status === 'CONNECTED';
                return (
                  <div key={entry.provider} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <p className="text-body-strong text-text">{entry.name}</p>
                      <p className="text-caption text-text-muted">{entry.description} · {entry.category}</p>
                    </div>
                    {connected ? (
                      <Badge tone="success">Connected</Badge>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!entry.available || !canFull || upsert.isPending}
                        title={!entry.available ? 'Not yet available — this connector has no integration yet.' : undefined}
                        onClick={() => handleConnect(entry)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}
      {createKeyOpen && <CreateApiKeyModal onClose={() => setCreateKeyOpen(false)} />}
      {scopesTarget && <EditApiKeyScopesModal apiKey={scopesTarget} onClose={() => setScopesTarget(null)} />}
      <ConfirmDelete
        open={Boolean(disconnectTarget)}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={() => disconnectTarget && handleDisconnect(disconnectTarget)}
        title={`Disconnect ${disconnectTarget?.name ?? 'this integration'}?`}
        description="Data already imported stays in OneBook. No new data is exchanged until the integration is connected again."
        confirmLabel="Disconnect"
        loading={disconnect.isPending}
      />
      <ConfirmDelete
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && handleRevoke(revokeTarget)}
        title={`Revoke ${revokeTarget?.name ?? 'this key'}?`}
        description="Any system using this key loses access immediately. This cannot be undone — create a new key to restore access."
        confirmLabel="Revoke key"
        loading={revokeKey.isPending}
      />
    </div>
  );
}
