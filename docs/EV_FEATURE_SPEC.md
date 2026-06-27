# Troski EV Service — research-grounded feature spec

Researched 2026-06-27. Question: what does the EV service actually need for Ghana?

## The decisive finding
Ghana's operational EV network is **battery SWAP, not plug-in charging**:
- **Kofa Swap & Go**: 33 active swap stations in Accra + 6 in Kumasi, expanding to
  Takoradi/Tamale. 2-minute swaps, app-based access, 20k+ swaps/month.
- **Plug-in public charging is tiny**: electromaps lists ~4 GH stations; OpenChargeMap
  a handful; **OpenStreetMap has ~0** in real Ghana. Chargers sit at malls, hotels,
  offices, select fuel stations in Accra/Tema/Kumasi/Takoradi/Cape Coast.
- **GreenDrive Hub** = the main plug-in charging operator building out.

**Implication for Troski:** electric adoption here is led by **2-wheelers (e-okada)**
running on **battery swap** — and Troski already serves okada riders. So the feature's
highest-value angle is a **swap-station map for e-okada/delivery riders**, with car
charging secondary. This is a real moat, not a generic charger map.

## Other grounded facts
- Connectors in GH: **Type 2 (AC)** + **DC fast (CCS)**. EVs: BYD Yuan Plus/Seagull,
  Chery iCAR 03, BAW.
- Pricing: **not standardised/published** — public > home, still < petrol.
- Pain points (universal + worse here): **broken/unavailable chargers**, **load-shedding
  (dumsor)** outages, **range anxiety on long trips**, sparse official data.
- The category leader (PlugShare) wins on **user-generated reliability data**:
  check-ins, "is it working?", photos, reviews, real-time availability, trip planner.

## Feature priority (research-backed)
1. **Battery Swap | Charging toggle** — swap primary (Kofa/Stima), charging secondary.
   Swap is the real Ghana network + ties to Troski's okada riders.
2. **Crowdsourced reliability** — "working / not working", last-confirmed, photos,
   reviews. Official data is thin, so Troski's existing report engine IS the moat.
3. **Connector + power filter** — Type 2 / CCS, slow/fast/rapid (OCM provides this).
4. **Load-shedding awareness** — flag stations on solar/backup; off-peak advice
   (dumsor is a uniquely Ghanaian EV blocker).
5. **Pricing transparency** — crowdsource per-kWh / per-swap cost (none published).
6. **Trip / range planning** — "can I make it + where to swap/charge en route" given
   sparse infra.
7. **Vehicle profile** — BYD/Chery/BAW + e-okada; filter by compatibility.
8. **Operator deep-links** — open Kofa app to book a swap; partner for live status.

## Data strategy
- **Now:** OpenChargeMap (free key, EXPO_PUBLIC_OCM_KEY) for plug-in chargers.
- **Moat:** Troski crowdsourcing for reliability, pricing, gaps, and swap stations.
- **Authoritative:** partner with **Kofa** (swap) + **GreenDrive Hub** (charging) for
  station lists + live availability; deep-link to Kofa for swap booking.
- Never fabricate coordinates — honest empty/onboarding states until real data lands.

## Built so far (app/ev/index.tsx + lib/services/ev-charging.ts)
Accra map, OCM station dots (operational/down), detail sheet (operator/kW/connector/
access) + Directions, nearby list, no-key onboarding + suggest-a-station crowdsource.
