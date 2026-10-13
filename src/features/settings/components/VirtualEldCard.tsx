// pt30_pt40/tz.md §10.1 — "Test PT30/40 mode" card on Settings · ELD devices.
// UI language follows the settings pages (English, WD-118). Hidden when the environment forbids
// virtual ELDs; the switch is disabled with a tooltip without `carrierSettings` FULL.
import { useState } from 'react';
import { usePermission } from '@/shared/auth/usePermission';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import { ApiError, formErrorMessage } from '@/shared/api/errors';
import { formatCarrier } from '@/shared/format/datetime';
import { useCarrier, useSetVirtualEld, type CarrierRow } from '@/shared/api/settingsAdmin';
import { ToggleRow } from './formKit';
import { SETTINGS_REASON, VIRTUAL_ELD_COPY } from '../lib/copy';

function updatedBy(carrier: CarrierRow): string | null {
  const who = carrier.virtualEldUpdatedBy;
  if (!who) return null;
  if (typeof who === 'string') return who;
  return who.fullName ?? who.name ?? who.email ?? null;
}

function statusLine(carrier: CarrierRow): string {
  if (!carrier.virtualEldEnabled) return VIRTUAL_ELD_COPY.statusOff;
  const when = carrier.virtualEldUpdatedAt ? formatCarrier(carrier.virtualEldUpdatedAt, carrier.timezone) : null;
  return VIRTUAL_ELD_COPY.statusOn(when, updatedBy(carrier));
}

export function VirtualEldCard() {
  const { data: carrier } = useCarrier();
  const { can } = usePermission();
  const { toast } = useToast();
  const mutation = useSetVirtualEld();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!carrier || carrier.virtualEldAvailable !== true) return null;
  const canWrite = can('carrierSettings', 'FULL');
  const enabled = carrier.virtualEldEnabled === true;

  function apply(next: boolean) {
    mutation.mutate(next, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast({ kind: 'success', ...TOAST_COPY.settingsSaved });
      },
      onError: (error) => {
        setConfirmOpen(false);
        if (error instanceof ApiError && error.code === 'VIRTUAL_ELD_REQUIRES_TEST_ERODS') {
          toast({ kind: 'error', title: VIRTUAL_ELD_COPY.requiresTestErods });
          return;
        }
        toast({ kind: 'error', title: formErrorMessage(error) });
      },
    });
  }

  return (
    <Card>
      <div className="flex flex-col gap-3" data-testid="virtual-eld-card">
        <ToggleRow
          title={VIRTUAL_ELD_COPY.title}
          description={VIRTUAL_ELD_COPY.description}
          checked={enabled}
          disabled={!canWrite || mutation.isPending}
          tooltip={canWrite ? undefined : SETTINGS_REASON.virtualEldReadOnly}
          onChange={(next) => (next ? setConfirmOpen(true) : apply(false))}
        />
        <p className="text-caption text-text-muted" role="status">
          {statusLine(carrier)}
        </p>
      </div>
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={VIRTUAL_ELD_COPY.confirmTitle}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="lg" onClick={() => apply(true)} loading={mutation.isPending}>
              {VIRTUAL_ELD_COPY.confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-body text-text-secondary">{VIRTUAL_ELD_COPY.confirmBody}</p>
      </Modal>
    </Card>
  );
}
