// owner: web-settings-admin — W-24 Support action copy and disabled-control reasons (WD-079).
//
// Every `B-NN` below is a backend gap recorded in web/backend-gaps.md ("Stage 2 — Settings/Support",
// B-90/B-91); WD-080 records how these ids replaced the earlier invented ones.
import type { ToastCopy } from '@/shared/ui/copy';

export const SUPPORT_TOAST = {
  ticketOpened: { title: 'Support ticket opened', description: 'Our team will reply by email.' } satisfies ToastCopy,
} as const;

export const SUPPORT_REASON = {
  /** B-90 — no chat service or conversation endpoint for support. */
  chat: 'Live chat is not available yet — use email or the roadside line.',
  /**
   * B-91 — `POST /support/tickets` takes subject/body/category/
   * priority only: no file attachments and no way to attach device diagnostics or ELD events.
   */
  attachments: 'Not available yet — the ticket API cannot carry files. Describe the problem, the unit and the time instead.',
  diagnostics: 'Not available yet — the ticket API cannot attach device diagnostics or ELD events. Name the unit and the time in the description.',
  /**
   * B-12 — `POST /support/tickets` and `POST /feedback` are `@Perm('support', 'FULL')`, while
   * a Viewer holds `support: READ`. §21.4 keeps `+ New ticket` for every role, so the submit
   * button is what gets disabled for a READ-only role (WB-245/WB-246), with this reason on screen.
   */
  ticketForbidden: 'Your role can view support but not submit tickets yet — ask an administrator to open one for you (B-12).',
  feedbackForbidden: 'Your role can view support but not submit feedback yet — ask an administrator to send it for you (B-12).',
} as const;
