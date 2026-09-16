---
name: web-modal-spec
description: How to build or change one of the 30 OneBook ELD overlays (modals, drawers, popovers, menus) from tz.md §11 — sizes, footer order, validation, dirty-close, toasts, compliance overlays. Use when a screen action opens an overlay.
---

# Overlays (tz.md §11, §5.9, §14)

Find the overlay by **content** in §11 (`grep -n '^### 11\.' tz.md`), then open the design file
that entry names. File names under `roles and screens/sheets, modals, drawers, menus/` **do not
match their contents** — never trust a file name. Reuse `Modal`/`Drawer`/`ConfirmDelete` from
`src/shared/ui`; look for an existing overlay in the feature before creating one.

## Mechanics
- `Modal` for create/confirm · right `Drawer` for detail reading · popover for Table settings / Date range / Account menu · panel for Notifications.
- Radix Dialog: focus trap, `Esc` closes, focus returns to trigger, `--bg-overlay`, `--shadow-modal`, `--radius-xl` on large modals.
- Footer: `Cancel` left of primary, primary right, `lg` (40px) buttons. Dirty close → **11.30 Discard changes** first. Destructive confirm (11.3) uses `danger` and states what survives (logs/DVIRs stay for audits).

## Forms
- RHF + zod, `mode:'onBlur'`, re-validate `onChange`. Required label `*`; error under input 12/400 `--danger`, `aria-invalid` + `aria-describedby`.
- Submit: button `loading`, inputs disabled, `isSubmitting` guard. `422` → `details` into `setError`; unknown field → banner inside the modal.
- Exact strings from §14.2 (grep `tz.md` for the field): VIN 17 chars no I/O/Q · annotation 4–60 (`An annotation must be at least 4 characters (FMCSA requirement).`) · `outputFileComment` ≤ 60 · inspector email `*.fmcsa.dot.gov` · transfer range ≤ 8 days · log range ≤ 62 · CSV ≤ 5 MB · images ≤ 5 × 5 MB · `eldIdentifier` 4 chars `[A-Z0-9]`.
- After success: invalidate affected `qk` keys, close, fire the **exact** toast from `src/shared/ui/copy.ts` (§13.3). Never invent wording.

## Compliance overlays — 11.11 log edit, 11.12 certify, 11.13 unassigned, 11.14 send to official
Show the server refusal verbatim (`DRIVING_TIME_IMMUTABLE`, `UNCERTIFIED_LOGS`,
`UNRESOLVED_UNIDENTIFIED`, `ACTIVE_MALFUNCTION`, `ERODS_TEST_MODE`, `INVALID_TRANSFER_RECIPIENT`).
Never retry around it, hide it, or pre-filter the request client-side. No optimistic updates.

## Channels
`SMS` is never an option (Q-2). In 11.21 the SMS channel renders permanently disabled and `SMS` is never put in `channels`.
