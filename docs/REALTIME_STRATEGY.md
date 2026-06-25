# Troski Real-Time Strategy — predictability is the moat

Owner direction (2026-06-26): win passengers with **real-time value + quality**,
not fancy features. Minibus first, okada/carrier later. Ghanaians value their time.

## What the research says passengers actually suffer (daily)
1. **Unpredictability of wait** — 1–3 hrs at terminals "uncertain when the next
   trotro will arrive." The single biggest pain. Predictability > everything.
2. **Fare extortion** — paying above the approved GPRTU fare; journey-splitting;
   night tripling (Kaneshie–Kasoa GH₵15 vs approved GH₵8.50).
3. **Wasted time / no ability to plan** — "a functioning transport system lets
   people plan their lives with confidence."
4. Overcrowding, poor vehicle condition, station chaos (a *coordination* problem).

Sources: Ghanaian Times "Transport crisis deepens"; B&FT "coordination problem";
GBC "fare extortion"; allAfrica.

## Honest audit of our real-time capability
- ✅ Real-time **infra** works: Supabase Realtime (fare/queue/incident INSERT subs),
  GO Mode GPS broadcast (`gps:trip:{routeId}`, 1–2s fresh), push tokens registered.
- ✅ Real data we HAVE: crowdsourced fares (per-drop-off, GPRTU-anchored), queue
  reports (station busyness), Google traffic ETA, live trotros from riders in GO Mode.
- ❌ Real data we DON'T have: actual bus GPS positions (`vehicle_positions` empty,
  no driver writer), assigned-vehicle lookup, backend "bus approaching" push.
- ⚠️ Trust leak: booking shows **fake** "Departs in 5 mins / STC Coach / Mr John
  Kwame". A real-time app must never show fake live data.

## Principle
**Never show fake real-time data. Show real signals + honest freshness, or say
"not yet known."** Predictability from real crow3sourced + traffic data beats a
fake countdown. Fare transparency (already built) directly fights extortion.
Real crowdsourced + traffic data beats a fabricated ETA.

## What we can deliver NOW (no Trotro Pro needed)
1. **Honest booking screen** — remove fake bus/driver/departure; replace with a
   real-time **Route Status** panel: live trotros active on the route, station
   queue/wait at origin, traffic-aware ETA, GPRTU-anchored fare. (THIS SESSION.)
2. **Predictability signals everywhere** — "N trotros moving on this route now",
   "Kaneshie: moderate queue · 20m ago", "Light traffic · ~30 min". Realtime-subbed.
3. **Fare-extortion shield** — show the official/GPRTU fare prominently at booking
   + "report if you were overcharged" (feeds the crowd data). (Mostly built.)
4. **Departure honesty** — trotros leave when full; show "N waiting at station"
   instead of a fake countdown.

## Phase model (owner, 2026-06-26)
- **Phase 1 = Troski's OWN buses.** Assigned to routes, reflect live on the app
  NOW. Real-time bus position is achievable immediately — not gated on third parties.
- **Later = open to other drivers** (Troski Pro onboarding) to cover more routes.

## Troski Pro is BUILT (driver app at /Users/samed/troski-pro)
Same Supabase project. A bus on shift:
- Broadcasts GPS on `gps:van:{vanId}` (event `location`) every 10s fg / 15s bg.
- Writes `vehicle_positions` via RPC `upsert_vehicle_position` (one live row per van,
  PostGIS point, is_active). `deactivate_vehicle_position` on End Shift.
- Boards passengers via `mark_ticket_boarded(trip_code)`.
Links passenger↔bus by route_id/route_label + plate_number. Tables exist
(vehicle_positions, fleet_vans, fleet_drivers, driver_shifts, bookings, tickets).
Passenger consumer exists: `useVehiclePositions`, `useRealtimeVehicle(vanId)`.

### ⚠️ THE GATE — run once in Supabase to unblock the whole fleet
The 3 RPCs the driver app calls did NOT exist (404). Created in
`troski-pro/lib/supabase/migrations/001_fleet_position_rpcs.sql` — **owner runs it
in the Supabase SQL editor.** After that: a Troski bus starts a shift → broadcasts →
passenger app shows the live bus on the booked route (Confirm Booking already wired).

## Still to build once buses are broadcasting
- Live bus position on a map after booking (receipt/tracking) via `useRealtimeVehicle`.
- ETA to pickup + to drop-off (bus position + Mapbox Directions).
- Backend geofence push: "your bus is 5 min away" (push tokens already stored).
- Driver photo/real plate on the ticket.

## Tracking in two phases (owner, 2026-06-26 — data costs money in Ghana)
Most riders guard their data bundle, so live-map tracking is opt-in, not default.
- **Phase 1 — notification-first (data-light, the default for most).** BUILT:
  the track screen's **Data Saver** drops the map (tiles = the cost) and shows a
  big live ETA + distance; **proximity alerts** fire a local notification at
  ~10 min, ~5 min and on arrival ("🚌 Bus ~5 min away · 1.2 km from your stop").
  Lock the phone, get tapped. Traffic-aware ETA so updates reflect road conditions.
- **Phase 2 — live map (power users).** BUILT: full live minibus on the map,
  auto-follow, ETA. The same data, richer view, for those who want it.

## WhatsApp Bot AI (planned — zero-data channel)
Many Ghanaians live on WhatsApp and pay near-nothing for it. A bot lets a rider
ask "where's my bus / how far / when" and get the live answer — no app data, no
app even open.
- **Flow**: rider messages the Troski WhatsApp number → bot matches their auth
  phone → finds their active booking → reads `vehicle_positions` for the route →
  replies "GT-1199-25 is ~5 min / 1.2 km away, light traffic." Can also push
  proactive "your bus is 5 min away" messages.
- **Stack (backend, not built)**: WhatsApp Business API (Meta Cloud API) or Twilio
  → a webhook server → match phone↔booking → query vehicle_positions/traffic →
  AI/NLU layer (Claude) for free-text Q&A → reply. Proactive alerts via the same
  geofence rule that drives push.
- **Why it fits**: lowest-friction, lowest-data real-time channel — exactly the
  "win them by saving their time AND their data" play. See DEFERRED_BACKLOG.

## Build order
1. Booking Route Status panel (real signals, kill fake fields) — THIS SESSION.
2. Wire live count + queue + traffic into the panel, realtime-subscribed.
3. Surface predictability on routes/detail + receipt consistently.
4. (Trotro Pro lands) → live vehicle position + arrival push.
