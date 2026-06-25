# Per-drop-off fare system (build first, GPRTU partnership later)

> PROGRESS (2026-06-24): Steps 1, 2, 4 DONE + tested live (alight picker →
> stage fare → checkout, verified Achimota ₵4 / Dome ₵5.50 / Taifa ₵7 on the
> seeded Circle→Taifa corridor). Migration 052 + 052b/c run.
>
> ALIGHT PLACEMENT DECISION → `docs/ALIGHT_UX.md`: keep the picker on the detail
> bottom-sheet (only place route.stops load); NO separate picker on Plan a Trip;
> make search stage-aware instead (planner matches route_stops → pre-seed detail).
> Revised remaining order:
>   - ✅ Step 3: report/fare.tsx board+alight picker — DONE + tested (₵5 report →
>     fare_report w/ stops + segment_fares(0,3) report_count 0→1, avg 5.00).
>   - ✅ Planner stage-awareness — DONE + tested (Circle→Dome → corridor, ₵5.50,
>     pre-selects Dome on detail). + fare source badge (official/estimate).
>   - GO Mode: read the booking's chosen drop-off (unify, don't re-ask) — NEXT
>   - Optional board picker on detail (mid-route boarders)
>   - Step 5: national %-reprice — DB fn `reprice_segment_fares()` ready (ops-only,
>     run on a GPRTU change); app shows effective fare. No app UI needed.


Goal: working per-drop-off (stage) fare system using our OWN data + manual seed.
No GPRTU partnership yet — build + verify everything first, then plug in their
official schedule later. Full design: `docs/FARE_REPORTING_RESEARCH.md`. Model:
board→alight stage pair, board defaults to route origin.

Execute in order. Test each slice on the sim before moving on (owner rule:
always test the flow). Commit straight to main.

## 0. (Owner) run the migration
I draft it; you run it in the Supabase SQL editor (anon key can't DDL). I'll flag
when ready.

## 1. Schema migration  ⟶ I draft, owner runs
- `segment_fares` (route_id, from_stop_order, to_stop_order, official_fare,
  avg_reported_fare, min_fare, max_fare, report_count, last_report_at,
  source ['gprtu'|'station'|'driver'|'crowd'|'seed'], is_official,
  effective_date, fare_version).
- `fare_reports`: add `from_stop_id`, `to_stop_id` (start capturing drop-off).
- `fare_settings` (or a row): `national_multiplier`, `current_version`,
  `effective_date` — for the % re-price model.
- Acceptance: tables exist; existing fare flow still works (graceful when empty).

## 2. Fare service + lookup precedence  ⟶ code
- `lib/services/segment-fares.ts`: `getFareForDropoff(routeId, fromStopOrder,
  toStopOrder)`.
- Precedence: exact `segment_fares` row → distance-interpolate via
  `route_stops.distance_from_origin_km` → flat corridor `official_fare` fallback.
- Acceptance: returns sensible fare for a seeded corridor + falls back cleanly.

## 3. Capture drop-off in fare reports  ⟶ code (starts data collection NOW)
- `app/report/fare.tsx`: add a drop-off (alight) picker from the route's stops;
  write `from_stop_id` + `to_stop_id`.
- Acceptance: a report records board + alight + amount; shows in DB.

## 4. Alight picker → fare-to-drop-off  ⟶ code
- Route detail (`app/routes/detail.tsx`): "Where will you alight?" picker over
  `route.stops`; selecting a drop-off updates the displayed fare (via service).
- Pass the chosen drop-off + fare to checkout (already threads fare today).
- GATED on stops existing — most routes have none yet, so:
  - Seed `route_stops` + `segment_fares` for ONE demo corridor (37 Military→Madina
    or Circle→Taifa) to demo end-to-end. Fallback to flat corridor fare otherwise.
- Acceptance: pick drop-off on the seeded corridor → fare changes → checkout matches.

## 5. National %-reprice + manual seed path  ⟶ code/tooling
- Helper to apply `national_multiplier` to all `segment_fares` → new
  `fare_version` + `effective_date` (per-route override allowed).
- Simple seed/entry path for stage fares (manual, since no GPRTU feed) — script or
  a minimal admin input; Trotro Pro driver entry comes later.
- Acceptance: bump fares by +20% → versions/dates update; app shows new fare +
  "effective <date>".

## Dependencies / risks
- `route_stops` is sparse (most routes have none) → steps 3-4 limited until stops
  seeded. Seed 1 demo corridor first.
- Migration is DDL → owner must run before steps 2-5 land.
- Keep everything graceful: empty `segment_fares` → current flat-fare behavior.

## Stretch (if time)
- Confidence/source badge on the fare ("GPRTU official" vs "estimate · N reports").
- Overcharge flag when paid > official ± margin.

## NOT tomorrow (later / blocked)
- GPRTU/GRTCC partnership + official schedule import (owner: after it all works).
- Trotro Pro driver fare entry (needs the driver app).
- Multi-leg transfer ticketing.
