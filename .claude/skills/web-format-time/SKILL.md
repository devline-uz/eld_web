---
name: web-format-time
description: Units, number, date and duration formatting for the OneBook ELD web panel, and the three-timezone rule (driver home terminal vs carrier vs browser). Use before rendering any measurement, timestamp, duration or HOS hour.
---

# Formatting (tz.md §8) — `src/shared/format/`, 100% coverage

**Grep the module first:** `units.ts`, `numbers.ts`, `datetime.ts`, `duration.ts`, `hos.ts`,
`relative.ts` (+ `useRelativeTime`), `empty.ts`, `jurisdiction.ts`. Almost every formatter already
exists — adding a second one is a defect. A new formatter needs tests to keep 100%.

## Rules
- Backend returns **imperial, already rounded**. The client never converts or rounds; it groups thousands and formats. Percent and MPG arrive ready.
- Units: `993,589 mi` · `61 mph` · `62,410 gal` · MPG `6.4` · engine hours `1,070 h 12 m` (KPI) / `1070.2 h` (table) · `79 °C` · `13.9 V` · `78%` · `21,300 lbs` · `$2,184.30` right-aligned · g-force signed 2dp `-0.42 g`.
- Time: HOS hours `HH:MM` two-digit tabular (`00:19`, `70:00`) · event `HH:MM:SS` · table `HH:MM` 24h · `MMM DD, HH:MM` · long `EEE, MMM d, yyyy` · short `MMM dd, yyyy` · range `MMM dd – MMM dd, yyyy` · duration `05h 30m` · `Due in 3,100 mi · Sep 24`.
- Relative: `<60 s` just now · `<60 min` `N minutes ago` (`12 min` in tables) · `<24 h` `N h` · `Yesterday` · `<7 d` `N d` · else date. Recomputed every 30 s.
- Empty: table `—` muted · no driver/unit `Unassigned` (muted, not italic) · no device `Not assigned` · no defects `None` · DVIR `Not submitted` (warning).

## ⭐ Timezones
| Context | Zone | Source |
|---|---|---|
| RODS/HOS: grid, totals, certification, log events, transfer range | `driver.homeTerminalTimezone` | `GET /drivers/:id` / `timezone` in logs response |
| Company: dashboard subtitle (`· ET`), audit log, report ranges, tickets | `carrier.timezone` | `GET /carrier` |
| Relative time, `Now · this device` | browser | — |

Never the browser zone on an HOS screen. `formatRods(iso, driverTz)` ≠ `formatLocal`; lint bans
`formatLocal` in `hos-logs/`. DST via `date-fns-tz`: 23/25-hour days keep 24 grid columns, coordinates
against `summary.dayLengthSec`.
