// owner: web-vehicles-drivers — W-06 bulk bar `Send message` for a multi-row selection.
// One selected driver opens their conversation in W-16 instead (`messagesHref`); two or more go
// through `POST /messages/broadcast`, the same real endpoint W-16's "Broadcast to fleet" uses.
// `messaging` FULL, per §16.
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { useBroadcastMessage } from '@/shared/api/messaging';
import { messageSchema } from '@/shared/forms/schemas';
import { toUserMessage } from '@/shared/api/errors';
import { DRIVER_TOAST } from '../lib/copy';

type MessageFormValues = z.infer<typeof messageSchema>;

export interface BulkMessageModalProps {
  driverIds: string[];
  onClose: () => void;
  onSent?: () => void;
}

export function BulkMessageModal({ driverIds, onClose, onSent }: BulkMessageModalProps) {
  const { toast } = useToast();
  const broadcast = useBroadcastMessage();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<MessageFormValues>({ resolver: zodResolver(messageSchema), mode: 'onBlur', defaultValues: { body: '' } });

  function send(values: MessageFormValues) {
    if (broadcast.isPending) return;
    broadcast.mutate(
      { body: values.body, driverIds },
      {
        onSuccess: (result) => {
          toast({ kind: 'success', ...DRIVER_TOAST.messageSent(result.sent) });
          onSent?.();
          onClose();
        },
        onError: (error) => toast({ kind: 'error', title: toUserMessage(error) }),
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Send message"
      subtitle={`${driverIds.length} drivers · each one receives it in their own conversation`}
      size="md"
      isDirty={isDirty}
      footer={
        <>
          <ModalCancelButton disabled={broadcast.isPending} />
          <Button variant="primary" size="lg" loading={broadcast.isPending} disabled={broadcast.isPending} onClick={handleSubmit(send)}>
            Send message
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1">
        <span className="text-label text-text">
          Message <span className="text-danger" aria-hidden="true">*</span>
        </span>
        <textarea
          {...register('body')}
          rows={4}
          disabled={broadcast.isPending}
          aria-invalid={errors.body ? true : undefined}
          className="rounded-md border border-border bg-bg-surface p-3 text-body text-text"
        />
        {errors.body?.message && <span className="text-caption text-danger">{errors.body.message}</span>}
      </label>
    </Modal>
  );
}
