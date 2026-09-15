---
name: web-design-tokens
description: OneBook ELD web design tokens and shared-component contract — where the tokens live, duty-status palette, measurements, icon rules, the shared/ui inventory. Use when writing styles, a shared/ui component, or matching a screen to its design image.
---

# Tokens (tz.md §3) and shared components (§5)

**Source of truth is the code:** tokens in `src/shared/ui/tokens.css` (bound to Tailwind via
`@theme`); components in `src/shared/ui/` (`index.ts` exports them); exact empty-state and toast
copy in `src/shared/ui/copy.ts`. `grep -n -- '--<name>' src/shared/ui/tokens.css` before asking
what a value is. The full spec table is in `references/tokens.md` — open it only when a token is
missing from `tokens.css` or you are auditing the token file itself.

## Rules
- A hex or raw px in a feature file is a lint error. Use `var(--…)`/Tailwind theme classes.
- Duty colours are identical everywhere (grid line, badge, donut): Driving `--success` · On-duty `--danger` · Sleeper `--violet` · Off-duty `--neutral` · Yard move `--danger` (under ON) · PC `--neutral` (under OFF). Unit: ELD offline `--danger` · Idle `--warning` · Inactive `--neutral`. Severity: Critical danger · Major warning · Minor neutral.
- Progress bars: HOS meter 4px — `>25%` success, `10–25%` warning, `<10%`/0 danger. Maintenance 6px — `>30 d`/`>3000 mi` success, near warning, overdue danger. Track `--bg-subtle`.
- Measurements: sidebar 212 (collapsed 64) · sub-nav 204 · topbar 62 · page padding 24 · card padding 20 · card gap 16 · KPI row 4 cols · main grid `1fr 380px` · table row 48 (54 with avatar) · header 40 · button 36/32/40 · input 40 · icons 16/18/20. Min width 1280, horizontal scroll below; no `max-width` on the page.
- Typography: Inter; `tabular-nums` on every number; table head 11/600 `.06em` UPPERCASE muted; page title 22/600; KPI 30/600.
- Icons: Lucide only, stroke 1.75, `currentColor`.
- Components exist **once**. Extend `shared/ui`, never fork into `features/`. Inventory: Button (primary/secondary/ghost/danger/danger-outline/link, `loading` keeps label) · Badge/StatusBadge/DutyBadge/SeverityBadge · Card+SectionHeader · KpiCard · DataTable+Pagination+TableSettings · Modal/Drawer/ConfirmDelete · EmptyState/LoadingState/ErrorState/ForbiddenState (`states.tsx`) · Toast · OfflineBanner · ProgressBar/ProgressCard · HosMeter · DateRangePicker · DriverPicker/UnitPicker · Avatar · FilterDrawer.
- Loading = skeleton keeping card structure (KPI row → 4 skeleton cards), never a spinner. Every status badge carries text. Focus `2px solid var(--border-focus)` offset 2 — `outline:none` banned.
- Design image wins: copy column casing, badge colour, button label and empty-state sentence verbatim.
