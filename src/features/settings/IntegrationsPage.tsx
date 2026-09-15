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
  type IntegrationProvider,
  type ApiKeyRow,
} from '@/shared/api/settingsAdmin';
import { CreateApiKeyModal } from './components/CreateApiKeyModal';

interface CatalogEntry {
  provider: IntegrationProvider | null;
  name: string;
  description: string;
  meta: string;
}

const CATALOG: CatalogEntry[] = [
  { provider: null, name: 'Pacific Track', description: 'ELD hardware · PT30 / PT40', meta: '69 devices syncing' },
  { provider: 'mcleod', name: 'McLeod PowerBroker', description: 'TMS · loads, stops and BOL', meta: 'Last sync 4 minutes ago' },
  { provider: 'wex', name: 'WEX fuel cards', description: 'Fuel purchases for IFTA', meta: '1,842 receipts this quarter' },
  { provider: 'quickbooks', name: 'QuickBooks Online', description: 'Accounting & driver settlements', meta: 'Last export Sep 01' },
  { provider: null, name: 'DAT load board', description: 'Find and book available loads', meta: 'Connect to post capacity' },
  { provider: 'slack', name: 'Slack', description: 'Push alerts into a channel', meta: 'Send HOS alerts to #dispatch' },
  { provider: null, name: 'Geotab', description: 'Import telematics from mixed fleets', meta: 'Requires MyGeotab credentials' },
  { provider: null, name: 'Zapier', description: 'Automate with 6,000+ apps', meta: 'No-code automation' },
  { provider: 'webhook', name: 'Custom webhook', description: 'Send events to your own endpoint', meta: 'JSON over HTTPS' },
];

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

  const byProvider = useMemo(
    () => Object.fromEntries(integrationsQuery.rows.map((i) => [i.provider, i])),
    [integrationsQuery.rows],
  );

  const connectedCount = CATALOG.filter((c) => c.provider && byProvider[c.provider]?.status === 'CONNECTED').length;
  const availableCount = CATALOG.length - connectedCount;

  function handleConnect(provider: IntegrationProvider) {
    upsert.mutate(
      { provider, dto: { enabled: true, config: {} } },
      {
        onSuccess: () => toast({ kind: 'success', title: `${provider} connected` }),
        onError: (error) => toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
      },
    );
  }

  function handleDisconnect(provider: IntegrationProvider) {
    disconnect.mutate(provider, {
      onSuccess: () => toast({ kind: 'success', title: `${provider} disconnected` }),
      onError: (error) => toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
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
        <Button variant="secondary" iconLeft={<ExternalLink size={16} strokeWidth={1.75} />}>
          Browse marketplace
        </Button>
      </div>

      {integrationsQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : integrationsQuery.isError ? (
        <Card>
          <ErrorState onRetry={() => integrationsQuery.refetch()} />
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
                  <span className="text-caption text-text-muted">{entry.meta}</span>
                  {canFull && entry.provider ? (
                    connected ? (
                      <Button variant="secondary" size="sm" onClick={() => handleDisconnect(entry.provider!)}>
                        Manage
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" iconLeft={<Plus size={14} strokeWidth={1.75} />} onClick={() => handleConnect(entry.provider!)}>
                        Connect
                      </Button>
                    )
                  ) : canFull ? (
                    <Button variant="secondary" size="sm" disabled title="Not yet available">
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
          <ErrorState onRetry={() => apiKeysQuery.refetch()} />
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
                      <DropdownMenu.Item className="cursor-pointer rounded-md px-2 py-1.5 text-body outline-none hover:bg-bg-subtle">Edit scopes</DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => revokeKey.mutate(row.id)}
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

      {createKeyOpen && <CreateApiKeyModal onClose={() => setCreateKeyOpen(false)} />}
    </div>
  );
}
