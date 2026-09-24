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
   * WB-250 — B-12 shipped: `POST /support/tickets` and `POST /feedback` now only need
   * `support: READ`, which every role that can reach these screens holds. These strings are kept
   * as the inline fallback for a genuine server-side `403` (e.g. a custom role changed
   * mid-session), not as a client-side gate anymore.
   */
  ticketForbidden: 'Your role can view support but not submit tickets — check with an administrator.',
  feedbackForbidden: 'Your role can view support but not submit feedback — check with an administrator.',
} as const;
