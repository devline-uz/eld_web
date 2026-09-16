# OneBook ELD — web panel subagents

Thirteen agents, one slice of `web/tz.md` each. Launch Claude Code from `web/` so this
`.claude/` is picked up. Short brief in, ≤ 8-line report out. They never edit `../backend/`
and never write to git.

| Agent | Owns | tz.md | Model |
|---|---|---|---|
| `web-architect` | Vite/TS/ESLint config, router + guards, AppShell, layouts, code splitting, bundle budget, CI | 2, 4, 9, 16, 19, 11.26–11.28 | opus |
| `web-design-system` | `tokens.css`, every `shared/ui` component, states, `copy.ts` | 3, 5, 13, 11.23–11.25, 11.29–11.30 | sonnet |
| `web-api-client` | `client.ts`, `endpoints.ts`, `qk`, policy, errors, types, `shared/format`, zod, MSW, contract tests | 6.1–6.4, 8, 14, 17, 20 | opus |
| `web-auth-rbac` | Firebase sign-in, auth modes, tokens, 22-key model, guards, role chip, My account | 6.5–6.9, 12, W-00, W-26 | opus |
| `web-realtime` | Socket.IO provider, rooms, events, reconnect, polling fallback, offline | 7, 13.4 | sonnet |
| `web-dashboard-fleet` | Dashboard, Live Fleet, MapLibre, geofences | W-01, W-02, 11.1 | sonnet |
| `web-vehicles-drivers` | Vehicles, Unit profile/histories, Drivers, Driver profile, driver creation, CSV import | W-03…W-07, 11.2–11.9 | sonnet |
| `web-hos-logs` | ⭐ 24-hour grid, available hours, violations, certification, log edits, unassigned | W-08, 11.11–11.13 | opus |
| `web-dvir-safety` | DVIR, defects, work orders, schedules, safety events, coaching | W-09, W-10, 11.15–11.17 | sonnet |
| `web-dispatch-messaging` | Trips, Messages, broadcasts | W-11, W-16, 11.10 | sonnet |
| `web-reports-transfer` | IFTA/Activity/DVIR reports, FMCSA pack, eRODS transfers | W-12…W-15, 11.14 | opus |
| `web-settings-admin` | Company, Users, Roles, Devices, Alert rules, Integrations, Audit log, Support, Feedback | W-17…W-25, 11.18–11.22 | sonnet |
| `web-qa-a11y` | Unit/component/contract/RBAC/E2E, axe, visual, bundle budget, CI gates | 15–18, 22 | sonnet |

## Skills (`.claude/skills/`)

| Skill | Carries |
|---|---|
| `web-core` | **Loaded by every agent.** Stack, paths, ports, house rules, logging, git policy, and the token-discipline rules |
| `web-screen-spec` | 10-point screen procedure, read-only rules |
| `web-modal-spec` | Overlay mechanics, form validation strings, compliance overlays, toasts |
| `web-design-tokens` | Where tokens live, duty palette, measurements, component inventory (`references/tokens.md` = full spec) |
| `web-api-contract` | Envelope, nine `client.ts` rules, `qk`, cache policy, backend gaps |
| `web-rbac-matrix` | 22 keys, nav by role, three layers, read-only removals |
| `web-format-time` | Units, formats, three-timezone rule |
| `web-realtime-events` | Gateway reality, rooms, existing/missing events, polling, offline |
| `web-testing-gates` | Coverage gates, 16 E2E scenarios, a11y, budgets, CSP |

## Token policy
Agent files hold only what is unique to their slice; everything shared is in `web-core`, read
once. Each agent preloads only the 2–4 skills it needs. Agents grep before they read, read line
ranges not files, edit in place, run the narrowest test command, and report in ≤ 8 lines.
Quality gates (typecheck, lint, touched tests, design image for new screens, real endpoint
shapes) are never traded for tokens — see `web-core` §Token discipline, rule 9.

## Writing a brief
One task per invocation: name the screen/module, the `tz.md` section, and what "done" means.
Don't bundle a review into a build brief. Run unblocked agents in parallel.

## Not used
`code-review` / `simplify` / `security-review` are not in any `skills:` list — run them from the
main session.
