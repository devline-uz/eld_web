// owner: web-settings-admin — W-24 `Start chat` (B-90, shipped 2026-09-24).
// `POST /support/chats` opens a SUPPORT conversation with the first message; replies land in
// Messages (a different feature — not imported here) through the normal conversation list.
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import { useStartSupportChat } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';

export function StartChatModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const startChat = useStartSupportChat();
  const [message, setMessage] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const busy = startChat.isPending;
  const dirty = message.trim() !== '';

  function submit() {
    if (busy || message.trim().length === 0) return;
    setBanner(null);
    startChat.mutate(
      { message: message.trim() },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: 'Chat started', description: 'Find the conversation under Messages — our team replies there.' });
          onClose();
        },
        onError: (error) => {
          const text = error instanceof ApiError ? error.userMessage : 'Something went wrong.';
          setBanner(text);
        },
      },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Start a chat"
      subtitle="A support agent replies in Messages"
      size="sm"
      isDirty={dirty}
      footer={
        <>
          <ModalCancelButton disabled={busy} />
          <Button variant="primary" size="lg" loading={busy} disabled={busy || message.trim().length === 0} onClick={submit}>
            Start chat
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {banner && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
            {banner}
          </p>
        )}
        <Field label="Message" required>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
            rows={4}
            placeholder="Describe what you need help with…"
            className={`${inputClass} h-auto py-2`}
          />
        </Field>
      </div>
    </Modal>
  );
}
