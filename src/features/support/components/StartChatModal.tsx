// owner: web-settings-admin — W-24 `Start chat` (B-90, shipped 2026-09-24).
// `POST /support/chats` opens a SUPPORT conversation with the first message; replies land in
// Messages (a different feature — not imported here) through the normal conversation list.
import { useState } from 'react';
import { Modal, ModalCancelButton } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { ApiError, formErrorMessage } from '@/shared/api/errors';
import { useStartSupportChat } from '@/shared/api/settingsAdmin';
import { Field, inputClass } from './formKit';

/** `CreateSupportChatDto.message` is 1–2000 characters. */
const MESSAGE_MAX = 2000;

export function StartChatModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const startChat = useStartSupportChat();
  const [message, setMessage] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const busy = startChat.isPending;
  const dirty = message.trim() !== '';

  function submit() {
    if (busy) return;
    // The button used to sit disabled on an empty message with no word on why.
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setMessageError('Enter a message.');
      return;
    }
    if (trimmed.length > MESSAGE_MAX) {
      setMessageError(`Message must be ${MESSAGE_MAX} characters or fewer.`);
      return;
    }
    setBanner(null);
    startChat.mutate(
      { message: message.trim() },
      {
        onSuccess: () => {
          toast({ kind: 'success', title: 'Chat started', description: 'Find the conversation under Messages — our team replies there.' });
          onClose();
        },
        onError: (error) => {
          // A 422 on `message` goes under the field; anything else is spelled out in the banner.
          const issue =
            error instanceof ApiError && (error.status === 400 || error.status === 422)
              ? error.fieldErrors.message
              : undefined;
          if (issue) setMessageError(issue);
          const rest =
            error instanceof ApiError ? Object.keys(error.fieldErrors).filter((path) => path !== 'message') : [];
          if (issue && rest.length === 0) return;
          setBanner(formErrorMessage(error, issue ? ['message'] : [], { subject: 'Subject' }));
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
          <Button variant="primary" size="lg" loading={busy} disabled={busy} onClick={submit}>
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
        <Field label="Message" required error={messageError ?? undefined}>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setMessageError(null);
            }}
            maxLength={MESSAGE_MAX}
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
