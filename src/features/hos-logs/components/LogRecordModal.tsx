// owner: web-hos-logs — W-08 `Log events` row menu → `View full record`.
//
// WB-196: the item used to be `<a href="#event-{id}">` pointing at an element that does not exist
// anywhere on the page — clicking it only appended a fragment to the URL. The §395.8 record has
// more fields than the seven table columns (sequence id, record status and origin, the editor and
// the edit reason, the supersede chain), and an inspector asks for exactly those, so the item now
// opens them read-only. All times are in the driver's home terminal zone, like every other time on
// this screen.
import { formatInTimeZone } from 'date-fns-tz';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { EMPTY, formatEngineHours, formatOdometer } from '@/shared/format';
import { RECORD_ORIGIN, RECORD_STATUS, type LogEventView } from '@/shared/api/hosLogs';

const STATUS_LABEL: Record<number, string> = {
  [RECORD_STATUS.active]: 'Active (1)',
  [RECORD_STATUS.superseded]: 'Superseded (2)',
  [RECORD_STATUS.proposed]: 'Proposed — awaiting the driver (3)',
  [RECORD_STATUS.rejected]: 'Rejected by the driver (4)',
};

const ORIGIN_LABEL: Record<number, string> = {
  [RECORD_ORIGIN.automatic]: 'ELD · automatic (1)',
  [RECORD_ORIGIN.driver]: 'Driver · edited (2)',
  [RECORD_ORIGIN.carrier]: 'Carrier · proposed (3)',
  [RECORD_ORIGIN.unidentified]: 'Unidentified driver (4)',
};

const DUTY_LABEL: Record<string, string> = {
  OFF: 'Off duty',
  SB: 'Sleeper berth',
  D: 'Driving',
  ON: 'On duty, not driving',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="shrink-0 text-body text-text-muted">{label}</span>
      <span className="min-w-0 break-words text-right text-body-strong text-text">{value}</span>
    </div>
  );
}

export interface LogRecordModalProps {
  event: LogEventView;
  timezone: string;
  onClose: () => void;
}

export function LogRecordModal({ event, timezone, onClose }: LogRecordModalProps) {
  const at = formatInTimeZone(new Date(event.eventDateTime), timezone, 'yyyy-MM-dd HH:mm:ss zzz');
  return (
    <Modal
      open
      onClose={onClose}
      title="Full record"
      subtitle={`§395.8 record · sequence ${event.eventSequenceId}`}
      size="md"
      footer={<ModalCancelButton>Close</ModalCancelButton>}
    >
      <div className="flex flex-col">
        <Row label="Event time" value={at} />
        <Row label="Duty status" value={event.status ? DUTY_LABEL[event.status] ?? event.status : EMPTY.dash} />
        <Row label="Event type · code" value={`${event.eventType} · ${event.eventCode}`} />
        <Row label="Record status" value={STATUS_LABEL[event.recordStatus] ?? String(event.recordStatus)} />
        <Row label="Record origin" value={ORIGIN_LABEL[event.recordOrigin] ?? String(event.recordOrigin)} />
        <Row label="Location" value={event.locationName ?? EMPTY.dash} />
        <Row
          label="Odometer"
          value={
            event.totalVehicleMiles === null || event.totalVehicleMiles === undefined
              ? EMPTY.dash
              : `${formatOdometer(event.totalVehicleMiles)} mi`
          }
        />
        <Row label="Engine hours" value={formatEngineHours(event.totalEngineHours ?? null)} />
        <Row label="Annotation" value={event.annotation ?? EMPTY.dash} />
        <Row label="Comment" value={event.comment ?? EMPTY.dash} />
        <Row label="Edited by" value={event.editorType ? `${event.editorType}${event.editedById ? ` · ${event.editedById}` : ''}` : EMPTY.dash} />
        <Row label="Edit reason" value={event.editReason ?? EMPTY.dash} />
        <Row label="Supersedes" value={event.supersedesId ?? EMPTY.dash} />
        <Row label="Event ID" value={event.id} />
      </div>
    </Modal>
  );
}
