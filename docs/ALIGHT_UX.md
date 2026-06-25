# Where alight (drop-off) selection lives — decision

Question (owner): should picking the specific alight point along a route be on
the **Plan a Trip** screen or the **route-detail bottom-sheet card** (where the
"Where will you alight?" picker + the Trotro · 11.8km · 4 stops pills now sit)?
Factor in step 3 (report drop-off capture) and step 4 (detail alight picker).

## The deciding constraint
The journey planner (`lib/services/route-planner.ts`) matches the destination
against route **endpoints only** — `from_location` / `to_location` via ilike —
NOT against `route_stops`. So **intermediate stages never appear in Plan a Trip
results**; they only exist once a route is opened and `route.stops` loads (the
detail screen). Plan a Trip passes the corridor **endpoint** as `to`.

→ The precise alight point is only knowable on the **detail card**. That's where
it must live. Confirmed by the standard: Transit/Citymapper set destination in
search, then show fare per option and guide you off in-ride; matatu riders pick
their stage when on the vehicle. ([Transit](https://help.transitapp.com/article/93-how-to-use-transit),
[matatu stages](https://nairobipostalcode.org/nairobi-matatu-routes/))

## Decision

### 1. Alight picker stays on the detail bottom-sheet card (step 4) — KEEP
It's the only place `route.stops` is loaded, and it's the natural "picked a
route → choose where I get off → see the fare" moment. The pills (mode · km ·
stops) + "Where will you alight?" placement are correct. No change to location.

### 2. Do NOT add a separate alight picker on Plan a Trip
Plan a Trip's destination = coarse corridor intent (endpoint match). A second
picker there = duplication + confusion. Instead make search *stage-aware* via two
enhancements (below) so the destination flows INTO the detail picker.

### 3. Make search stage-aware (the real unlock) — planner matches route_stops
Enhancement to `route-planner.ts`: also match the destination against
`route_stops.stop_name`. Then searching an intermediate stage ("Circle →
Achimota") returns the **Circle → Taifa** corridor with Achimota flagged as the
alight, and the detail picker **pre-selects Achimota**. Pass the matched
`dropoff_stop_order` (or name) through to detail so it opens on the right stop.
Also: show the **fare-to-destination** on the result card (Transit shows fare per
option), not the corridor total, when the destination is a known stage.

### 4. Step 3 (report) = its OWN board + alight picker on report/fare.tsx
Different context: the rider reports what they **paid**, and may have **boarded
mid-route** → needs BOTH board and alight selectable (the general stage pair),
written to `fare_reports.from_stop_id` / `to_stop_id` → folded into
`segment_fares` via `apply_fare_report_to_segment`. Independent of the booking
picker. This is what starts accumulating real per-stage crowd data.

### 5. Boarding point (owner: mostly origin, some mid-route)
- **Booking (detail picker)**: board defaults to route origin (`stops[0]`),
  alight-only for v1 — most riders board at origin. Add an optional board picker
  later for mid-route boarders (board→alight pair). `resolveDropoffFareSync`
  already takes a `fromOrder`, so board selection is a small UI add when needed.
- **Reporting (step 3)**: board + alight both selectable from day one.

### 6. One alight value through the funnel
The chosen drop-off should be a single value flowing:
**search intent → detail picker → checkout (done) → GO Mode "Where will you
alight?"** (which already exists). Unify so the rider picks once; GO Mode's
existing alight picker reads the same selection instead of re-asking.

## Net placement answer
- **Specific alight selection → detail bottom-sheet card** (built, step 4). ✓
- **Plan a Trip → no separate picker**; make its destination stage-aware so it
  pre-seeds the detail picker (planner matches route_stops).
- **Fare reporting → own board+alight picker** on report/fare.tsx (step 3).

## Build order (revised, factoring 3 & 4)
1. ✅ Step 4 — detail alight picker → stage fare → checkout (DONE + tested).
2. **Step 3** — report/fare.tsx board+alight picker → fare_reports drop-off →
   aggregate. (Starts crowd data; independent; do next.)
3. **Planner stage-awareness** — match `route_stops`, return dropoff stop, show
   fare-to-destination on the card, pre-select in detail. (Makes search alight-aware.)
4. **GO Mode unify** — alight picker reads the booking's chosen drop-off.
5. **Optional board picker** on detail for mid-route boarders.
6. Step 5 — national %-reprice (orthogonal, already planned).
