// owner: web-settings-admin — W-22 provider credentials (WB-QA-S-01).
// Mirrors the backend's `INTEGRATION_REQUIRED_CONFIG` (`../eld_backend/src/modules/integrations/
// dto/integrations.dto.ts`): `PUT /integrations/:provider` with `enabled: true` is a 422 unless
// every key below is a non-blank string. Secret keys (`apiKey`, `clientSecret`, Slack
// `webhookUrl`) are encrypted at rest and come back `[REDACTED]`, so they are never prefilled.
import { z } from 'zod';

export type CredentialProvider = 'mcleod' | 'wex' | 'comdata' | 'quickbooks' | 'slack';

export interface CredentialField {
  key: string;
  label: string;
  /** `secret` renders a password input with a show/hide toggle. */
  kind: 'text' | 'url' | 'secret';
  placeholder?: string;
  hint?: string;
  /** Extra format rule beyond "required". */
  format?: 'https' | 'slack-webhook';
}

export interface CredentialSpec {
  subtitle: string;
  /** Shown as an info note above the fields. */
  note?: string;
  fields: CredentialField[];
}

export const CREDENTIAL_SPECS: Record<CredentialProvider, CredentialSpec> = {
  mcleod: {
    subtitle: 'OneBook signs in to your McLeod PowerBroker API with these credentials.',
    fields: [
      { key: 'baseUrl', label: 'API base URL', kind: 'url', format: 'https', placeholder: 'e.g. https://tms.example.com/ws' },
      { key: 'username', label: 'Username', kind: 'text' },
      { key: 'apiKey', label: 'API key', kind: 'secret' },
    ],
  },
  wex: {
    subtitle: 'Fuel purchases from this WEX account feed the IFTA report.',
    fields: [
      { key: 'accountNumber', label: 'Account number', kind: 'text' },
      { key: 'apiKey', label: 'API key', kind: 'secret' },
    ],
  },
  comdata: {
    subtitle: 'Fuel purchases from this Comdata account feed the IFTA report.',
    fields: [
      { key: 'accountNumber', label: 'Account number', kind: 'text' },
      { key: 'apiKey', label: 'API key', kind: 'secret' },
    ],
  },
  quickbooks: {
    subtitle: 'Credentials from your Intuit developer app.',
    note: 'Sign in with Intuit (OAuth) is not available yet — enter the company ID and app credentials instead.',
    fields: [
      { key: 'realmId', label: 'Company (realm) ID', kind: 'text' },
      { key: 'clientId', label: 'Client ID', kind: 'text' },
      { key: 'clientSecret', label: 'Client secret', kind: 'secret' },
    ],
  },
  slack: {
    subtitle: 'Alerts are posted to the channel this incoming webhook belongs to.',
    fields: [
      {
        key: 'webhookUrl',
        label: 'Incoming webhook URL',
        kind: 'secret',
        format: 'slack-webhook',
        placeholder: 'e.g. https://hooks.slack.com/services/…',
        hint: 'Slack → Apps → Incoming Webhooks → Add to channel. Treat it like a password.',
      },
    ],
  },
};

export function isCredentialProvider(provider: string): provider is CredentialProvider {
  return provider in CREDENTIAL_SPECS;
}

export const CREDENTIAL_MESSAGES = {
  required: (label: string) => `${label} is required.`,
  https: (label: string) => `${label} must be a full https:// URL.`,
  slackWebhook: 'Enter a Slack incoming webhook URL starting with https://hooks.slack.com/.',
} as const;

function parseUrl(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

/** Same rules as the backend's `validateIntegrationConfig`. */
export function credentialSchema(spec: CredentialSpec) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of spec.fields) {
    let rule: z.ZodTypeAny = z
      .string({ required_error: CREDENTIAL_MESSAGES.required(field.label) })
      .refine((v) => v.trim().length > 0, CREDENTIAL_MESSAGES.required(field.label));
    if (field.format === 'https') {
      rule = rule.refine((v) => {
        if (v.trim().length === 0) return true;
        const url = parseUrl(v);
        return url?.protocol === 'https:' && url.hostname.length > 0;
      }, CREDENTIAL_MESSAGES.https(field.label));
    } else if (field.format === 'slack-webhook') {
      rule = rule.refine((v) => {
        if (v.trim().length === 0) return true;
        const url = parseUrl(v);
        return url?.protocol === 'https:' && url.hostname === 'hooks.slack.com' && url.pathname.length > 1;
      }, CREDENTIAL_MESSAGES.slackWebhook);
    }
    shape[field.key] = rule;
  }
  return z.object(shape);
}
