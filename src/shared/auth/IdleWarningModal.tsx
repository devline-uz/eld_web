// owner: web-auth-rbac — §17: after 30 minutes idle a warning modal counts 60 seconds down,
// then the session ends (tokens cleared, query cache cleared, socket disconnected).
import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';

export function IdleWarningModal({
  seconds,
  onStay,
  onSignOut,
}: {
  seconds: number;
  onStay: () => void;
  onSignOut: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const tick = setInterval(() => setRemaining((value) => value - 1), 1_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (remaining <= 0) onSignOut();
  }, [remaining, onSignOut]);

  return (
    <Modal
      open
      // WB-084 — Escape, a backdrop click or the X is not "I am here": on an unattended machine
      // any stray dismiss must end the session, not grant another 30 minutes. Only the explicit
      // `Stay signed in` button extends it.
      onClose={onSignOut}
      size="sm"
      title="Still there?"
      subtitle="You have been inactive for 30 minutes."
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onSignOut}>
            Sign out
          </Button>
          <Button variant="primary" size="lg" onClick={onStay}>
            Stay signed in
          </Button>
        </>
      }
    >
      <p role="alert" className="text-body text-text-secondary">
        For security, you will be signed out in{' '}
        <span className="tabular font-semibold text-text">{Math.max(remaining, 0)}</span> seconds.
      </p>
    </Modal>
  );
}
