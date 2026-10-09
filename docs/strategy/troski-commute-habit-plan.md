# Troski Commute Habit Plan

_2026-10-09. Goal: Troski becomes the first thing an Accra commuter checks every morning — the "Transit app" of Ghana, built for how trotros actually work._

## 1. The core idea

Transit (transitapp.com) works because US agencies publish free schedule (GTFS) and live-position (GTFS-Realtime) feeds. Transit packages that data well and adds crowdsourcing on top.

Accra has no such feeds. Trotros have no timetable — they leave when full. So Troski must **produce** its own live data, and answer Accra's real questions:

| Rider question | Troski answer | Data source |
|---|---|---|
| Is there a car loading / how long is the queue at my station? | Queue status per station, with "reported X min ago" | Station reporters + crowd `queue_reports` |
| What's the real fare today? | GPRTU fare + recent reported fare | `routes.is_gprtu_verified`, `fare_reports` |
| Anything wrong on my route today? | Disruption alerts (strike, fare hike, flood, closure, police) | Official Pulse alerts + `incident_reports` |
| When is the next train / intercity bus? | Scheduled departures | `lib/constants/train-schedule.ts`; later Metro Mass / STC / VIP |

Rule (data-cost lens): **text-first, no live map by default.** A push and a home card cost almost no data. Google Maps already owns the map.

## 2. What already exists (reuse, don't rebuild)

- **Morning + afternoon pushes**: `/api/cron/notifications?type=morning_commute` (06:15) and `afternoon_rush` (16:00) → `lib/services/broadcast-notifications.ts`. Today they send the **same Accra-wide snapshot to everyone** (any 3 recent fares, any 3 queues, 1 incident). Not personal.
- **Favourite routes**: `trotromate-native/lib/hooks/useFavorites.ts` — **AsyncStorage only**, the server can't see them.
- **WhatsApp saved routes**: `whatsapp_saved_routes` (098) — server-side, per phone.
- **Queue reports**: `queue_reports` + `station_queue_stats` view (2h window); screens `app/stations`, `app/queue/status.tsx`.
- **Incidents**: `incident_reports` table (traffic/accident/police/roadwork).
- **Pulse**: `tale_posts` with official-post support (Troski account). No `alert` post type yet.
- **Train schedules**: bundled constant, 3 lines.
- **Rewards/coins** for reports. **WhatsApp bot** handles reports + lookups (EN/Pidgin/FR).

## 3. Phases

### Phase 0 — Pick the 3 launch corridors (owner decision, 1 day)
Proposal: **Madina ↔ Circle**, **Kasoa ↔ Circle/Kaneshie**, **Tema ↔ Accra**. Criteria: rider volume, owner network, verified GPRTU fares already present.
Everything below is judged on these corridors only. Don't spread thin.

### Phase 1 — Personal morning card (build, ~1–2 weeks)
1. **Sync favourites to the server**: new table `commute_routes (device_id, route_id, from_station, to_station, created_at)` + RPC `save_commute_route`/`remove_commute_route` (device-scoped, same pattern as `save_push_token`). Native: `useFavorites` writes to both local + server. Migration → dry run → Codex review → owner applies.
2. **Rework `sendMorningBroadcast`**: if a rider has commute routes → personal body:
   `Madina → Circle · GH₵8.70 · Queue at Madina: long (12 min ago) · No disruptions`
   No routes → today's generic snapshot + "Save your route for a personal update".
3. **Honesty rules**: show report age; if nothing fresh (>2h), say "No recent report — tap to report and earn coins". Never invent a status.
4. **Home card in the app**: same content, top of Home, for saved routes.
5. **Afternoon push**: same thing, reversed direction (Circle → Madina).

### Phase 2 — Seed live data on the corridors (ops, starts alongside Phase 1)
Crowd reports alone won't be dense enough at launch. Seed them:
1. **Station reporters**: 1 paid person per launch terminal (Madina, Circle, Kasoa, Kaneshie, Tema Station), 06:00–09:00 and 16:00–19:00, reporting queue + loading every 30 min via the WhatsApp bot. Tag reports `source = 'reporter'` so they can be weighted and audited.
2. **Freshness target**: every launch station has a report < 30 min old during peaks.
3. **Crowd layer**: Rewards bonus for reports on launch corridors during peaks; "confirm / still true?" one-tap on existing reports (cheaper than a new report).

### Phase 3 — Disruption alerts + transport news (build + ops, ~1 week)
1. New Pulse `post_type = 'alert'` (strike, fare change, closure, flood, train delay), official account only, pinned in feed, auto-expires.
2. **Targeted push**: alert tagged with corridors/stations → push only riders with matching commute routes (everyone for city-wide events like a GPRTU strike).
3. **Sources**: GPRTU/GRTCC announcements, Ministry of Transport, Ghana Railway, police/ NADMO flood notices, news. **Human approves every alert** at first (owner or one editor). Wrong alerts kill trust.
4. Morning card includes the top active alert for the route.

### Phase 4 — Scheduled operators (data work, ongoing)
Convert operators that DO run timetables into a small GTFS-style schedule store: trains (move out of the bundled constant), Metro Mass Transit, STC, VIP intercity. Enables "next departure" + later referral fees.

### Phase 5 — True live vehicles (later, only if 1–4 work)
Troski Pro trotro-driver GPS on launch corridors → "car loading now / left 5 min ago". Note the tension: Troski Pro is currently focused on delivery riders; live trotro GPS needs a dedicated driver-signup push on the 3 corridors. Text ETA first, map only as opt-in.

## 4. Metrics (is the habit forming?)

| Metric | Target after 8 weeks on launch corridors |
|---|---|
| Riders with ≥1 saved commute route | 40% of active users |
| Morning push open rate | ≥ 15% |
| Riders opening app ≥ 4 weekdays/week | 25% of active users |
| Launch stations with report < 30 min old at peak | ≥ 80% of peak slots |
| Wrong/retracted alerts | 0 |

Already logged: push sends (cron result). Needed: push open tracking + daily active per device.

## 5. Money without a wallet (parallel track, not blocking)

- **Data/insights B2B**: corridor demand, real fares vs GPRTU, missing routes → Ministry of Transport, AMA/assemblies, GPRTU, development-funded mobility studies.
- **Operator referrals**: intercity/train ticket clicks (STC, VIP, GRC).
- **Sponsored listings**: What's On / events, clearly labelled.
- Not now: ads in pushes (kills the habit), paid premium.

## 6. Open decisions for owner

1. The 3 launch corridors — agree with the proposal?
2. Budget for station reporters (5 people × peak hours) — yes/no, how long a trial?
3. Who approves alerts (owner, or hire an editor)?
4. Morning push time: keep 06:15, or earlier for Kasoa/Tema riders (05:30)?

## 7. Owner decisions (2026-10-09) — recommendations accepted

1. **Launch corridors:** Madina ↔ Circle, Kasoa ↔ Circle (via Kaneshie), Tema Station ↔ Accra.
2. **Push times:** morning **05:45**, afternoon **16:30** (Ghana = UTC; vercel.json, web 8a59515).
3. **Station reporters (Phase 2):** 4-week trial, 4 people — Madina, Kasoa, Circle (Madina + Kasoa bays), Tema Station; Mon–Fri 05:30–08:30 and 16:30–19:00; try GPRTU station bookmen/loaders first; report via the WhatsApp bot, tagged as reporter (migration 100, redesign wave 5). Daily rate set by owner; part in data bundles.
4. **Freshness target:** a report < 30 min old at each launch station in ≥ 80% of peak half-hours.
5. **Alert approver:** owner only, first 8 weeks; no alert without a source (GPRTU/official notice or on-site reporter).
6. **Crowd incentive:** double coins for queue reports on launch corridors at peak.
7. **Measurement:** build push-open tracking before the reporter trial.
8. **Generic push "save your route" line:** after the Android FCM fix + next store release.
