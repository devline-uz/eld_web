// owner: web-dispatch-messaging — W-16 "+ New": start a direct conversation, or broadcast one
// message to many drivers at once (`messaging` FULL — web/tz.md §11 / §16). Not drawn as its own
// overlay in the design files; built to the same Modal/footer/validation contract as every other
// 11.x form (web-modal-spec).
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Check, Search } from 'lucide-react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { useToast } from '@/shared/ui/Toast';
import { useDriversList } from '@/shared/api/drivers';
import { useCreateConversation, useBroadcastMessage } from '@/shared/api/messaging';
import { messageSchema } from '@/shared/forms/schemas';
import { ApiError } from '@/shared/api/errors';
import type { z } from 'zod';

type MessageFormValues = z.infer<typeof messageSchema>;
type Tab = 'DIRECT' | 'BROADCAST';

export function NewConversationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (conversationId: string) => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('DIRECT');
  const [query, setQuery] = useState('');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const driversQuery = useDriversList({ q: query || undefined, limit: 50 });
  const createConversation = useCreateConversation();
  const broadcast = useBroadcastMessage();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty: bodyDirty },
  } = useForm<MessageFormValues>({ resolver: zodResolver(messageSchema), mode: 'onBlur', defaultValues: { body: '' } });

  const drivers = driversQuery.data?.items ?? [];
  const submitting = createConversation.isPending || broadcast.isPending;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleStartConversation() {
    if (!driverId) return;
    createConversation.mutate(
      { type: 'DIRECT', driverIds: [driverId] },
      {
        onSuccess: (conversation) => {
          onCreated(conversation.id);
          onClose();
          toast({ kind: 'success', title: 'Conversation started' });
        },
        onError: (error) => toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
      },
    );
  }

  function handleBroadcast(values: MessageFormValues) {
    if (selectedIds.length === 0) return;
    broadcast.mutate(
      { body: values.body, driverIds: selectedIds },
      {
        onSuccess: (result) => {
          toast({ kind: 'success', title: `Broadcast sent to ${result.sent} driver${result.sent === 1 ? '' : 's'}` });
          onClose();
        },
        onError: (error) => toast({ kind: 'error', title: error instanceof ApiError ? error.userMessage : 'Something went wrong.' }),
      },
    );
  }

  const canSubmit = tab === 'DIRECT' ? Boolean(driverId) : selectedIds.length > 0;
  // WB-165 — a typed broadcast or a picked recipient is unsaved work: closing now raises the
  // 11.30 discard confirm instead of dropping it, and `Cancel` goes through the same route.
  const isDirty = Boolean(driverId) || selectedIds.length > 0 || bodyDirty;

  return (
    <Modal
      open
      onClose={onClose}
      title="New message"
      subtitle="Message a driver or broadcast to the fleet"
      size="md"
      isDirty={isDirty && !submitting}
      footer={
        <>
          <ModalCancelButton disabled={submitting} />
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!canSubmit}
            onClick={tab === 'DIRECT' ? handleStartConversation : handleSubmit(handleBroadcast)}
          >
            {tab === 'DIRECT' ? 'Start conversation' : 'Send broadcast'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
          {(
            [
              ['DIRECT', 'Message a driver'],
              ['BROADCAST', 'Broadcast to fleet'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={tab === value ? 'bg-bg-inverse px-3 text-body-strong text-text-inverse' : 'bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex h-input items-center gap-2 rounded-md border border-border px-3">
          <Search size={16} strokeWidth={1.75} className="text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search driver…"
            aria-label="Search driver"
            className="h-full flex-1 bg-transparent text-body outline-none"
          />
        </div>

        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {drivers.map((driver) => {
            const name = `${driver.firstName} ${driver.lastName}`;
            const selected = tab === 'DIRECT' ? driverId === driver.id : selectedIds.includes(driver.id);
            return (
              <li key={driver.id}>
                <button
                  type="button"
                  onClick={() => (tab === 'DIRECT' ? setDriverId(driver.id) : toggleSelected(driver.id))}
                  aria-pressed={selected}
                  className={`flex w-full items-center gap-3 rounded-md border p-2 text-left ${selected ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-bg-subtle'}`}
                >
                  {/* WB-165 — a real <input> nested in a <button> is interactive-in-interactive
                      markup; the button's own `aria-pressed` already carries the state, so the
                      tick is drawn, not focusable. */}
                  <span
                    aria-hidden="true"
                    className={`flex size-4 shrink-0 items-center justify-center border border-border ${
                      tab === 'DIRECT' ? 'rounded-full' : 'rounded-sm'
                    } ${selected ? 'border-primary bg-primary text-text-inverse' : 'bg-bg-surface'}`}
                  >
                    {selected && <Check size={12} strokeWidth={2} />}
                  </span>
                  <Avatar name={name} size="sm" />
                  <span className="flex-1 text-body-strong text-text">{name}</span>
                </button>
              </li>
            );
          })}
          {!driversQuery.isLoading && drivers.length === 0 && <li className="p-2 text-body text-text-muted">No drivers match this search.</li>}
        </ul>

        {tab === 'BROADCAST' && (
          <label className="flex flex-col gap-1">
            <span className="text-label text-text">
              Message <span className="text-danger">*</span>
            </span>
            <textarea {...register('body')} rows={4} className="rounded-md border border-border bg-bg-surface px-3 py-2 text-body text-text outline-none" />
            {errors.body?.message && <span className="text-caption text-danger">{errors.body.message}</span>}
          </label>
        )}
      </div>
    </Modal>
  );
}
