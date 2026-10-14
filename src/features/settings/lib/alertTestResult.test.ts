import { describe, expect, it } from 'vitest';
import { describeAlertTestResult } from './alertTestResult';

describe('describeAlertTestResult (B-9 Test rule toast)', () => {
  it('a disabled rule (no channels attempted) keeps the muted copy', () => {
    expect(describeAlertTestResult({ triggered: false, channels: [] })).toEqual({
      kind: 'warning',
      title: 'Rule is muted — no test alert sent',
    });
  });

  it('an older backend answering { triggered } only still works', () => {
    expect(describeAlertTestResult({ triggered: true })).toEqual({ kind: 'success', title: 'Test alert sent' });
    expect(describeAlertTestResult({ triggered: false }).title).toBe('Rule is muted — no test alert sent');
  });

  it('every channel sent or queued → success', () => {
    expect(
      describeAlertTestResult({
        triggered: true,
        channels: [
          { channel: 'IN_APP', status: 'SENT' },
          { channel: 'EMAIL', status: 'SENT' },
          { channel: 'WEBHOOK', status: 'QUEUED' },
        ],
      }),
    ).toEqual({ kind: 'success', title: 'Test alert sent' });
  });

  it('email failed while in-app landed → partly sent, naming the reason', () => {
    expect(
      describeAlertTestResult({
        triggered: true,
        channels: [
          { channel: 'IN_APP', status: 'SENT' },
          { channel: 'EMAIL', status: 'FAILED', reason: 'NO_MAIL_TRANSPORT' },
        ],
      }),
    ).toEqual({
      kind: 'warning',
      title: 'Test alert partly sent',
      description: 'Email not sent: email sending (SMTP) is not configured.',
    });
  });

  it('nothing delivered → not sent, lists every channel; unknown reasons fall through verbatim', () => {
    const toast = describeAlertTestResult({
      triggered: false,
      channels: [
        { channel: 'EMAIL', status: 'FAILED', reason: 'NO_EMAIL_ADDRESS' },
        { channel: 'WEBHOOK', status: 'SUPPRESSED', reason: 'CHANNEL_DISABLED' },
        { channel: 'IN_APP', status: 'FAILED', reason: 'WEIRD' },
      ],
    });
    expect(toast.kind).toBe('warning');
    expect(toast.title).toBe('Test alert not sent');
    expect(toast.description).toBe(
      'Email not sent: your account has no email address. Webhook not sent: turned off in notification channels. In-app not sent: WEIRD.',
    );
  });
});
