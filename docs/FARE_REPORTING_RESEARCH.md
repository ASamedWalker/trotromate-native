# Fare Reporting & Per-Drop-off Fares — Research / Wide Perspective

Research to inform Troski's per-drop-off fare model (GPRTU official +
crowdsourced). Companion to the "Per-drop-off fares" item in
`docs/DEFERRED_BACKLOG.md`. Date: 2026-06-23.

## 1. How informal-transit fares actually work (the model)

Trotro/matatu/danfo fares are **stage-based** (a.k.a. segment/drop-off-based), not
flat per corridor: the fare is a function of **where you board → where you alight**
along the route. This is the same "stage" system used across African paratransit.
Fares are also **variable** — they shift with fuel, traffic, police checks, weather,
demand — so a single fixed number is wrong; you need a *current* value with a date.

Implication: model a corridor as an **ordered list of stages (stops)**, and price
each **(board stop → alight stop)** segment. GPRTU sets official prices per stage;
riders pay (and report) the real price for their segment.

Sources: [Digital Matatus](https://digitalmatatus.com/),
[openMatatus](https://preparecenter.org/resource/the-openmatatus-project-collaborative-research-and-mapping-for-nairobis-informal-public-transit/),
[WhereIsMyTransport Cape Town Taxi Project](https://www.bizcommunity.com/Article/196/709/168626.html),
[Mapping informal transit — state of the art](https://www.safari-njema.polimi.it/mapping-informal-transit/).

## 2. The data standard that fits: GTFS-Fares v2

GTFS-Fares v2 models exactly drop-off pricing via **fare leg rules**:
`from_area_id` (boarding zone) → `to_area_id` (alighting zone), with optional
`contains_area_id` for in-between zones, plus **distance-based** leg fares. A "fare
leg" = a ride without transferring — maps 1:1 to a trotro segment.

Takeaway for Troski's schema: a **fare-leg table keyed by (route/corridor,
from_stop, to_stop)** with a price is the standards-aligned shape. Stops act as the
"areas/stages." Distance-from-origin (already on `route_stops`) is the fallback when
a specific segment hasn't been reported yet (interpolate by distance).

Sources: [GTFS Fares](https://gtfs.org/getting-started/features/fares/),
[GTFS-Fares v2 spec](https://old.gtfs.org/extensions/fares-v2/),
[Distance-based fares PR](https://github.com/google/transit/pull/556).

## 3. How fares get collected in the wild

- **Ride-and-survey** (Digital Matatus / WhereIsMyTransport): fieldworkers ride
  every route with a phone, log stops + fares, confirm with operators/commuters.
  High quality, slow, expensive. Good for **seeding** the GPRTU/official baseline.
- **Crowdsensing** (Moovit "Mooviters", 450k+ editors): a large community
  continuously contributes/edits data; edits **moderated** by senior
  editors/ambassadors; users can flag wrong data. Scales, needs trust controls.
- **Operator/union source**: GPRTU publishes official stage fares — the
  authoritative anchor. Treat as the baseline + bounds; crowdsourced fills the
  gaps and tracks real-world drift.

Best practice = **hybrid**: official (GPRTU) as anchor + crowdsourced for coverage,
freshness, and reality-check.

Sources: [Digital Matatus methodology](https://digitalmatatus.com/),
[Moovit crowdsourcing](https://www.digitaltrends.com/mobile/moovit-crowdsource-update/),
[Moovit community/moderation](https://moovit.com/features/).

## 4. UX patterns for user fare reporting (what to capture, frictionlessly)

Capture the minimum that makes a fare *useful per drop-off*:
1. **Board point** (default = origin/where they got on; pre-fill from GPS/last stop)
2. **Alight point** (the drop-off — the new field we're missing today)
3. **Amount paid** (numeric, quick-chip presets near the expected fare)
4. **Vehicle type** (trotro/okada/pragya) — already have
5. Optional: time-of-day, "paid extra (traffic/luggage)" flag

Capture at the moments riders are already engaged (lowest friction):
- **In-ride / post-trip prompt** — Troski ALREADY has GO Mode's "Where will you
  alight?" picker + a post-trip fare prompt (+5/+8 pts). Add board+alight+amount
  there → near-zero extra friction, highest-quality (real trip context).
- **Manual report** (`report/fare.tsx`) — add the alight/drop-off picker.
- **One-tap confirm** — when official/known fare exists, "Paid ₵X? ✓ / Different"
  beats free text.

Motivators (why people contribute): the research splits into **platform-based**
(points, levels, reputation, leaderboards) and **individual** (altruism, helping
fellow riders, accuracy pride). Troski already has the rewards/coins system + points
for reports — lean on it.

Sources: [Motivators for collaborative transit data (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0968090X1831310X),
[Transit-app UX practices (AltexSoft)](https://www.altexsoft.com/blog/best-mobile-user-experience-design-practices-for-public-transportation-apps/),
[Gamification in transit (Mass Transit)](https://www.masstransitmag.com/technology/passenger-info/article/13000010/loyalty-programs-and-gamification-in-public-transit).

## 5. Trust / validation (so the data is usable)

- **Anchor + bounds**: reject/flag reports far outside GPRTU official ± margin
  (e.g. >120% = possible overcharge, surface it rather than silently averaging).
- **Outlier rejection**: drop top/bottom percentile before averaging a segment.
- **Confidence by sample + recency**: show "avg ₵X · N reports · updated Yd ago";
  low N or stale → label "estimate". (Troski's card already shows reports + freshness.)
- **Moderation/verification**: `is_verified` flag; trusted contributors weighted;
  let users flag wrong fares (Moovit pattern).
- **Dedup**: one rider, same segment, same day → collapse.

## 6. Concrete recommendation for Troski

Model:
- `route_stops` already = ordered stages with distance-from-origin. Use as the
  stage list. (Coverage gaps remain — most routes have no stops yet.)
- Add a **fare-leg store**: `segment_fares(route_id, from_stop_order, to_stop_order,
  official_fare, avg_reported_fare, min, max, report_count, last_report_at,
  source)`. Origin→drop-off is the common case; full board→alight is the general one.
- `fare_reports`: add `from_stop_id` + `to_stop_id` (today it's only route_id+amount
  → drop-off is lost). This is the **cheapest first step** — start collecting now.
- Fare lookup precedence: **exact reported segment → GPRTU official for that
  segment → distance-interpolated estimate** (using distance_from_origin_km).

Capture points (reuse existing surfaces):
- GO Mode alight picker + post-trip prompt → record board+alight+amount.
- `report/fare.tsx` → add drop-off picker.
- Route detail / checkout → alight picker → fare-to-drop-off (replaces flat fare).

Phasing: (1) capture drop-off in reports → (2) segment fare store + GPRTU import →
(3) app alight-picker pricing. See backlog for the gated build order.

## Open questions for owner
- Is the boarding point usually always the route origin, or do riders frequently
  board mid-route? (Determines whether we need full board→alight or just origin→drop.)
- Source of GPRTU official stage fares — published list, or manual entry per corridor?
- Stage granularity — price every `route_stop`, or only major fare-change points
  ("fare stages" are coarser than every bus stop in matatu systems)?
