// B-9 "Test rule" — turns the per-channel result of `POST /alert-rules/:id/test` into one toast.
// The toast must be truthful: an EMAIL that SMTP did not deliver is never reported as "sent".
import type { AlertChannel, AlertRuleTestResult } from '@/shared/api/settingsAdmin';

const CHANNEL_LABEL: Record<AlertChannel, string> = { IN_APP: 'In-app', EMAIL: 'Email', WEBHOOK: 'Webhook' };

const REASON_LABEL: Record<string, string> = {
  NO_EMAIL_ADDRESS: 'your account has no email address',
  NO_MAIL_TRANSPORT: 'email sending (SMTP) is not configured',
  SMTP_SEND_FAILED: 'the mail server rejected the message',
  NO_WEBHOOK_CONFIGURED: 'no webhook integration is configured',
  CHANNEL_DISABLED: 'turned off in notification channels',
};

export interface AlertTestToast {
  kind: 'success' | 'warning';
  title: string;
  description?: string;
}

export function describeAlertTestResult(result: AlertRuleTestResult): AlertTestToast {
  const channels = result.channels ?? [];
  if (!result.triggered && channels.length === 0) {
    return { kind: 'warning', title: 'Rule is muted — no test alert sent' };
  }
  const notDelivered = channels.filter((c) => c.status === 'FAILED' || c.status === 'SUPPRESSED');
  if (notDelivered.length === 0) return { kind: 'success', title: 'Test alert sent' };

  const description = notDelivered
    .map((c) => `${CHANNEL_LABEL[c.channel] ?? c.channel} not sent: ${REASON_LABEL[c.reason ?? ''] ?? c.reason ?? 'unknown error'}.`)
    .join(' ');
  return {
    kind: 'warning',
    title: result.triggered ? 'Test alert partly sent' : 'Test alert not sent',
    description,
  };
}
