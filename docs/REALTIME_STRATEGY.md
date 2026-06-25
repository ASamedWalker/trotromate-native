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

## What's gated on Trotro Pro (driver app) — later
- Real per-bus GPS → live position on map after booking.
- Assigned-vehicle + driver (real plate/photo) on the receipt.
- Backend geofence push: "your trotro is 5 min away".
- Live ETA to pickup + to drop-off for the booked passenger.
(Infra is ready: `useRealtimeVehicle(vanId)` consumes `gps:van:{vanId}`; push tokens
stored; just needs the driver-side writer.)

## Build order
1. Booking Route Status panel (real signals, kill fake fields) — THIS SESSION.
2. Wire live count + queue + traffic into the panel, realtime-subscribed.
3. Surface predictability on routes/detail + receipt consistently.
4. (Trotro Pro lands) → live vehicle position + arrival push.
