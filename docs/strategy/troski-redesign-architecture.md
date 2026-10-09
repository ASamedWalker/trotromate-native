# Troski redesign architecture — "Ghana's Transit app"

_2026-10-09. Plan only (fable-architect). Inputs: `docs/strategy/transit-app-design-research.md`, `docs/strategy/troski-commute-habit-plan.md`, `CLAUDE.md`, release tab layout, `ReleaseHome`, `MyRoutesCard`, `useFavorites`, `routes/[id]`, `(tabs)/routes`, `train/index`, `stations/index`, `queue/status`, backend `/api/commute`, `commute-card.ts`, migration 099, `schema.sql`. "Assumption" = not verified in code. Status: **awaiting owner decisions (§7)** — nothing built yet._

## Decision

**Lines-first, map-never-by-default, honest-status Troski.** Five tabs in store release: **Home · Lines · Stations · Train · Pulse**. Home = the rider's own corridors as line cards (hero fare + queue status word + report age) over a nearby-stations list, with official alerts on top and the next train below. Rewards leaves the tab bar (coins chip + Profile). Every status carries a freshness mark; trotros never get a countdown, trains do. Build in six OTA-shippable waves behind `RELEASE_MODE`; only one backend migration wave (alerts) gates anything.

## Why

- Transit's own home is a coloured *list* of lines; the map is context (research §1). Dropping the map as a core surface is faithful to the pattern and satisfies the data-cost lens.
- The habit hook already exists in code: `MyRoutesCard` + `/api/commute` + `describeCommute` share one honesty contract (fare source label, queue status + `reportedAt`). The redesign promotes that card from one block among six to the organising principle of the app.
- Trotro "lines" are terminal-to-terminal corridors (`routes.from_station_id/to_station_id`, `from_location/to_location`), so Transit's "nearby lines" becomes "nearby stations, then the corridors leaving each" — stations need a first-class surface. Today's `app/stations/index.tsx` is a Mapbox screen; `queue/status.tsx` is a flat list. One list-based Stations tab replaces both as the entry point.
- Rewards as a tab contradicts the Transit model it copies (GO recognition lives inside the product, not as a destination). The 2026-10-07 Rewards redesign is untouched; only its entry points move.
- Everything in waves 0–3 and 5–6 is JS-only (OTA). Tab changes, new screens, new hooks: no native dep, no store build. Android FCM is a separate build.

## 1. Thesis

1. Troski is the screen you open at 06:10 to see *your* corridors: fare, queue at your boarding station, how old that report is, anything wrong today.
2. Lines and stations are the identity; the map is an opt-in detail, never the home.
3. Honesty is the design system: a status word + report age for trotros, a real countdown only for trains, "No recent report" instead of a guess.
4. Contribution is the engine (Transit GO adapted): one-tap queue/fare reports, confirmations, "your report reaches N commuters", coins as recognition.
5. Alerts are subscription-by-relevance: save a line → get its disruptions (push + Home strip + Pulse pinned).

## 2. Information architecture

### Tab bar (RELEASE_MODE), left → right

| Tab | Route file | Role | Replaces |
|---|---|---|---|
| **Home** | `(tabs)/index.tsx` → `components/home/ReleaseHome.tsx` | My lines, alerts, nearby stations, next train | current ReleaseHome |
| **Lines** | `(tabs)/lines.tsx` (label `nav.lines`, fare-first content) | Browse/search all corridors; fare is the hero number on each card | "Fares" label |
| **Stations** | NEW `(tabs)/stations.tsx` | Nearby + all stations as a list: queue status, freshness, report CTA. "Map" link opens the existing Mapbox screen | `/queue/status` + `/stations` map as entry points |
| **Train** | `(tabs)/train.tsx` | Unchanged positioning (info-only), honesty fixes | — |
| **Pulse** | `(tabs)/tales.tsx` | News + official alerts pinned on top + community | — |

**Demoted / merged / removed (release mode):**
- **Rewards tab → out.** Entry = coins chip in Home header (`ReleaseHome.tsx:205`) + Profile row (`(tabs)/profile.tsx:41`). `rewards.tsx` stays as a hidden tab route.
- **"Fares" → "Lines".** One i18n key. Fare stays the hero on every line card; the Lines header subtitle keeps "GPRTU fares + what riders paid". (Open question 1.)
- **`TodaysFares` leaves Home.** Duplicates the Lines tab's `fareOfDay` (`routes.tsx:137`).
- **Queue status screen (`/queue/status`)** becomes the Stations tab body (reuse its list + stale gating; drop the standalone route once the tab ships).
- **Stations map (`/stations`)** stays reachable from the Stations tab header "Map" and from station detail; never the default.
- **Alerts live in three places, one source:** Home strip (top), route/station detail chip, Pulse pinned. Bell (`/(tabs)/activity`) stays for personal notifications.
- **Report** has no tab. Entry points: Home "At the station?" prompt, Stations tab FAB, station/route detail CTAs, Rewards Earn card. `(tabs)/report.tsx` stays a hidden route.
- **Profile** via header avatar (currently `/settings` in `ReleaseHome.tsx:176`; change to `/(tabs)/profile`).
- Full (non-release) mode keeps Home·Lines·Train·Wallet·Pulse and `FullHomeScreen` untouched.

### Navigation map

```
Home ─┬─ search bar ──────────► routes/search (plan) ──► routes/[id]
      ├─ Alert strip ─────────► Pulse (pinned alert) / alert detail sheet
      ├─ My lines card ───────► routes/[id]  (♥ = save + "notify me?")
      ├─ Nearby stations (3) ─► stations/[id] (NEW)   · "See all" ► Stations tab
      ├─ "At <station>? Report the queue" ► report/queue?station_id=…
      ├─ Next train card ─────► Train tab ► train/[lineId]
      ├─ coins chip ──────────► (tabs)/rewards (hidden tab)
      └─ bell ────────────────► (tabs)/activity

Lines ── corridor cards (launch corridors first) ► routes/[id] ──┬─ Report fare / queue
                                                                 ├─ station rows ► stations/[id]
                                                                 └─ "Map" (opt-in) ► routes/detail
Stations ── list (Nearby | Busiest | A–Z) ► stations/[id] ──┬─ lines from here ► routes/[id]
                                                            ├─ Report queue ► report/queue
                                                            └─ "Map" ► stations (Mapbox)
Train ── board + lines ► train/[lineId]
Pulse ── pinned alerts ► alert sheet · feed ► post · composer
```

## 3. Screen-by-screen spec

### 3.1 Home (`components/home/ReleaseHome.tsx`)
**Purpose:** answer "my commute, right now" in one scroll, zero taps.
**Blocks, in order:**
1. Brand band (keep): greeting, location name, coins chip, bell. Tagline by variant: morning "Heading out?", afternoon "Heading home?" (same `currentVariant()` rule as `MyRoutesCard`).
2. Search bar (keep position; thumb reach). Placeholder "Where to? Station or line".
3. **Alert strip** (wave 4): ≤2 active official alerts matching saved corridors/stations, else city-wide; severity colour, title, age; tap → alert sheet. Hidden when none.
4. **My lines** (`MyRoutesCard` rework): one line card per saved route (max 3, "N more" → Lines tab `saved` filter). Card = `LineBadge` (code + colour) · "From → To" · hero fare (HeroText 28, `~` + REPORTED label when not GPRTU) · queue status word + `FreshnessDot` + age · alert chip if any. Footer CTA "At the station? Report the queue".
5. **Nearby stations** (NEW `components/home/NearbyStationsCard.tsx`): 3 nearest stations (client haversine on `fetchStations()` coords + `FALLBACK_STATION_COORDS`; reuse `findNearbyStops`/`haversineKm`): name, distance, queue status word, freshness, "N lines". No GPS → 3 busiest `is_major` + "Turn on location for nearby". "See all" → Stations tab.
6. **Next train** (`NextTrainCard`, keep; real countdown allowed).
7. What's On (`ReleaseWhatsOn`), Riders asking (keep). Adinkra strip stays as separator.

**States:** loading = skeleton rows; empty saved = "Save your route" nudge → Lines; stale = status greyed + "No recent report" + report CTA (never hidden); error = names from local favourites, no status, plus `OfflineBanner`.
**Data:** `/api/commute` (existing), `fetchStations()` + `station_queue_stats` (existing), alerts endpoint (NEW, wave 4), bundled train schedules.
**Transit pattern:** nearby-list home, pinned lines rising, ETA card → status card.

### 3.2 Route / corridor detail (`app/routes/[id].tsx`)
**Purpose:** Transit's "all-powerful route screen" without a map.
**Blocks:** hero (keep adinkra dark hero; add `LineBadge`; fare HeroText 44 with honest label) → **Queue at boarding station** (NEW: status word + freshness + age + "Report"; `station_queue_stats` by `from_station_id` or name, same `findQueue` rule as the server) → **Alerts on this line** (wave 4) → Stops & stage fares → Where to board → Fares over time → On Pulse → Rider tips (all existing) → bottom bar: ♥ Save + Report fare. Hide "riders sharing live" row in RELEASE_MODE (verify `FEATURES.liveBuses` gating).
**♥ behaviour (Transit pin):** on first save, inline prompt "Get alerts for this line?" → `alerts:true` on the favourite record (local); from wave 4 sent via an extended `set_commute_routes`. Never a modal.
**Opt-in map:** "View on map" → `routes/detail.tsx` with a one-time "uses more data" caption.
**GO rule:** no GO entry here (owner rule).

### 3.3 Station detail (NEW `app/stations/[id].tsx`)
**Purpose:** "Is there a car loading / how long is the queue?" + which lines leave here.
**Blocks:** header (name, location, distance) → **Queue hero**: status word HeroText 32 in status colour (grey when stale) + `FreshnessDot` + "Reported 12 min ago · 3 reports last hour" (`report_count_last_hour` exists) → primary CTA **"Report the queue here"** (56px) + secondary "Still like this? Confirm" (wave 5) → **Lines from here**: routes with `from_station_id = id OR to_station_id = id`, fallback name match; row = `LineBadge`, destination, fare + source label → **Recent reports** (last 5, with age) → active incidents within 1 km → "Map" link (opt-in).
**States:** no fresh report = "No recent report" in grey, CTA emphasised; no linked lines = "No lines linked yet — know one? Tell us on Pulse".
**Data:** `stations`, `station_queue_stats`, `queue_reports`, `routes`, `incident_reports` via new `lib/hooks/useStationDetail.ts`. No migration.

### 3.4 Stations tab (NEW `app/(tabs)/stations.tsx`)
Segmented **Nearby | Busiest | A–Z** (reuse `components/stations/SortTabs`), local search, rows: name, distance, status word + `FreshnessDot` + age. Header "Map" → existing Mapbox screen. Floating "Report queue". No location on Nearby → prompt + fall back to Busiest. Data: `useStations()` (realtime-invalidated, offline-cached).

### 3.5 Search / plan (`app/routes/search.tsx`)
Keep the screen. Local station/line matches first; Mapbox geocoding only on no local match (data cost). Home/Work shortcuts persisted in AsyncStorage. Result tap → `routes/[id]` in RELEASE_MODE (not the map).

### 3.6 Train (`app/train/index.tsx`, `train/[lineId].tsx`)
Keep layout. Honesty pass (CLAUDE.md train backlog 1, 3, 6, 7): "Scheduled" + report age instead of fake ON TIME/LIVE; currency util; titles by direction; "Trains" header. Countdown stays. `LINE_COLORS` reused by `LineBadge`. No booking (owner rule).

### 3.7 Pulse / news (`components/TalesScreen.tsx`)
**Pinned alerts rail** on top (official `post_type='alert'`, not expired; wave 4): severity bar, title, scope chips, age; tap → alert detail bottom sheet (not nested). Feed + composer unchanged. Internal `tale*` naming untouched.

### 3.8 Report flow (`app/report/queue.tsx`, `app/report/fare.tsx`)
Two taps: station (prefilled from `station_id`, else nearest, else picker) → status chip → submit. Success: coins toast + **"Reaches N commuters who board at <station>"** (wave 5). **AutoGO adaptation:** on Home focus, if GPS within 250 m of a station and no report by this device in 30 min, a dismissible row "At <station>? Report the queue" (foreground location only).

### 3.9 Profile / Rewards
Profile from the Home avatar; add "My lines" row and "Alerts" toggle (wave 4). Rewards content unchanged; Community Impact later shows "Your reports reached N commuters this week" (wave 5). No money framing.

## 4. Visual language

### Corridor / line identity
- **Unit:** corridor = unordered terminal pair. Code from 3-letter terminal codes (CIR Circle, MAD Madina, KAS Kasoa, KNS Kaneshie, TEM Tema, LPZ Lapaz, ACH Achimota, LEG Legon, DAN Dansoman, SPX Spintex…), e.g. `MAD·CIR`. Full "Madina → Circle" stays the title. Train badges keep `LINE_COLORS`.
- **Colour:** 8-colour palette, brand orange excluded (reserved for actions): blue `#1D4ED8`, teal `#0F766E`, violet `#6D28D9`, rose `#BE123C`, amber-brown `#92400E`, green `#15803D`, indigo `#3730A3`, slate `#334155` — all ≥4.5:1 with white text, each with a `tint`. Launch corridors hand-assigned (proposal: Madina–Circle blue, Kasoa–Circle/Kaneshie teal, Tema–Accra violet); others = stable hash of route id; non-corridor routes = neutral slate.
- **Storage:** wave 0 = client constant `lib/constants/corridors.ts`. Wave 4 = `corridors` table + `routes.corridor_id` (needed for alert targeting); constant becomes fallback.

### Freshness indicator (`components/FreshnessDot.tsx`)
| Age | Mark | Status colour | Text |
|---|---|---|---|
| < 30 min | filled dot | full | "12 min ago" |
| 30 min – 2 h | hollow ring | 60 % | "1h ago" |
| > 2 h or none | grey dash | grey | "No recent report" |

Matches `QUEUE_FRESH_MS = 2h` in `stations/index.tsx` / `queue/status.tsx`. No animation (no reanimated in ScrollView on Android; a pulse would imply "live"). Always paired with age text and in `accessibilityLabel`.

### Typography (Baloo 2, `HeroText` for ≥20 px)
`hero.xl 56` train countdown · `hero.lg 44` route fare · `hero.md 32` station queue word · `hero.sm 28` card fare · `hero.xs 22` status chip. Never hand-set lineHeight.

### Dark mode
Stays **disabled** (owner decision). Palette chosen dark-safe so a later switch is a token change.

### Density, icons, accessibility
24 px gutter, 28 px sections, one hero number per card, 3 items per Home list before "See all". Lucide icons, no emoji in UI. Status = word + mark, never colour alone. 44 px targets, 56 px primary report CTA, contrast ≥4.5:1.

## 5. Data / backend changes

| Change | Where | Migration | Wave | Blocked on |
|---|---|---|---|---|
| Client corridor constants | native `lib/constants/corridors.ts` | no | 0 | owner confirms corridors |
| Station detail queries | native hook over existing tables | no | 2 | — |
| Nearby stations | client haversine over `fetchStations()` | no | 1 | — |
| `queue_reports.source` (`rider`/`reporter`/`whatsapp`) | `100_queue_report_source.sql` | **yes** | 5 | Phase 2 reporters |
| Alerts: `tale_posts.post_type` + `'alert'`, `expires_at`, `severity`, `alert_scope jsonb` | `101_pulse_alerts.sql` | **yes** | 4 | alert approver |
| `corridors` table + `routes.corridor_id` | `102_corridors.sql` | **yes** | 4 | — |
| `GET /api/alerts/active` (cached 60 s) | `trotromate/app/api/alerts/active/route.ts` | no | 4 | 101 |
| Targeted alert push (commute_routes → corridor scope) | `broadcast-notifications.ts` | no | 4 | 101, 102, Android FCM build |
| `commute_routes.alerts boolean` + RPC param | `103_commute_alerts.sql` | **yes** | 4 | — |
| `GET /api/reports/impact?station_id=` | API route | no | 5 | — |
| `/api/commute` adds `alert` per item | existing route | no | 4 | 101 |
| Push-open tracking | later | yes | post-6 | metrics only |

Nothing touches wallet, booking, or okada tables.

## 6. Phased rollout

All native work ships **OTA** (JS only). New IA renders only when `RELEASE_MODE` is true (store channel, or `EXPO_PUBLIC_RELEASE_MODE=1` locally); full mode untouched. A **store build** is needed only for the Android FCM fix; wave 4 pushes depend on it for Android.

### Wave 0 — shared primitives (risk 1)
- T0.1 `components/FreshnessDot.tsx` + `lib/utils/freshness.ts` (`fresh|aging|stale`). Verify: typecheck; thresholds at 29/31/121 min.
- T0.2 `components/LineBadge.tsx` + `lib/constants/corridors.ts`. Verify: render in `routes/[id]` hero behind RELEASE_MODE.
- T0.3 `lib/theme.ts` `hero` size tokens.

### Wave 1 — Home (risk 2)
- T1.1 `MyRoutesCard` → line cards (badge, HeroText fare, status word, FreshnessDot). Verify: release mode, Android + iOS, 0/1/3 saved routes, airplane mode.
- T1.2 NEW `NearbyStationsCard`; remove `TodaysFares` from `ReleaseHome`; avatar → `/(tabs)/profile`. Verify: location on/off, no-GPS fallback.
- T1.3 Home "At <station>? Report the queue" prompt (250 m, 30-min suppression). Verify: simulator at Circle `5.5696,-0.2133`.

### Wave 2 — Stations tab + station detail (risk 2)
- T2.1 NEW `app/(tabs)/stations.tsx`; `_layout.tsx` release tabs → `index, lines, stations, train, tales`; `rewards` hidden; `StationsIcon`; `nav.stations` (EN + Twi). Verify: tab order both platforms; rewards reachable from coins chip.
- T2.2 NEW `app/stations/[id].tsx` + `useStationDetail`. Verify: fresh / stale / no report; zero linked routes.
- T2.3 `report/queue.tsx` accepts `station_id`. Verify: report from detail shows on return.

### Wave 3 — Lines tab + route detail (risk 2)
- T3.1 Lines label + `LineBadge`, HeroText fare, FreshnessDot; launch corridors pinned. Verify: scroll perf with 324 routes.
- T3.2 `routes/[id]`: queue-at-boarding block, ♥ → "Get alerts?" inline, "View on map" link, live row hidden. Verify: save/unsave still syncs.
- T3.3 `routes/search.tsx`: local matches first, geocode on miss; results → `routes/[id]` in release.

### Wave 4 — Alerts (risk 3; migrations, owner applies)
- T4.1 Migrations 101/102/103 with DRY_RUN; Codex review before owner applies.
- T4.2 Admin create-alert form, `/api/alerts/active`, `/api/commute` alert field, targeted push + unit test for scope matching.
- T4.3 Native: `AlertStrip`, detail chips, Pulse pinned rail, alert sheet, Profile toggle, `useFavorites` sends `alerts`. Verify: corridor alert vs citywide; expiry hides.

### Wave 5 — Contribution loop (risk 2)
- T5.1 Migration 100 `queue_reports.source`; WhatsApp bot tags `whatsapp`/`reporter`.
- T5.2 "Still like this? Confirm" via existing `report_confirmations` (one per device).
- T5.3 `/api/reports/impact` + success line + Rewards impact line.

### Wave 6 — Train honesty (risk 1)
- T6.1 "Scheduled" + age instead of fake ON TIME/LIVE; currency util; direction titles; "Trains" header. Verify: Sunday no-service, Saturday service, countdown unchanged.

**Switch plan:** each wave → preview OTA per platform (`--platform ios`, then `--platform android`) → owner device check → production per platform. App config version is 1.1.5 (matches store builds); confirm both store platforms are on 1.1.5 before any production OTA.

## Files not to touch
- `app/wallet/**`, `app/booking/**`, `app/scan/**`, `app/trip/**`, `lib/hooks/useTrip.ts`, `lib/services/tripChannel.ts`
- Mapbox internals of `app/routes/detail.tsx`, `app/stations/index.tsx` (opt-in maps; link only)
- `app/(tabs)/rewards.tsx` internals, `components/RewardIcons.tsx`
- `lib/constants/train-schedule.ts` data, `lib/services/trainReminders.ts`
- Any `tale*` identifier/table/type; applied migrations ≤ 099; `FullHomeScreen`; `lib/config/release.ts` semantics

## Acceptance criteria
- Release tab bar: Home · Lines · Stations · Train · Pulse; full mode unchanged; Rewards reachable from coins chip + Profile.
- No trotro surface shows a countdown or a coloured status older than 2 h; every status shows an age or "No recent report", also in `accessibilityLabel`.
- Home renders with 0 saved routes, no location, offline — no blank cards.
- Station detail opens from Home, Stations tab, route detail; a report from it shows on return.
- Alerts appear only for matching corridors/stations or citywide; gone at `expires_at`.
- `npm run typecheck` + `npm run lint` pass after each wave.

## Verification commands
```
cd /Users/samed/trotromate-native && npm run typecheck && npm run lint
cd /Users/samed/trotromate-native && EXPO_PUBLIC_RELEASE_MODE=1 npx expo start   # new IA
cd /Users/samed/trotromate-native && npx expo start                              # full mode unchanged
cd /Users/samed/trotromate && npm run test:bot                                    # commute-card + (wave 4) alert-scope tests
CI=1 npx eas-cli update --branch preview --platform ios && CI=1 npx eas-cli update --branch preview --platform android
```
Maestro `npm run e2e` exists; add Home → station → report flow after wave 2.

## 7. Risks, scope guard, open questions

**Risks**
- `routes.from_station_id/to_station_id` are nullable; name matching misses aliases (e.g. "Circle Odorna"). Audit station links on the 3 launch corridors before wave 2.
- Queue data is sparse until Phase 2 reporters; lots of "No recent report" at first — the honest state; the CTA is the fix.
- Alert quality kills trust: wave 4 ships only with a named approver.
- Android push broken until the FCM build; wave 4 pushes iOS-only until then.
- Changing Home contradicts Transit's "sacred home" — fine pre-production; settle this layout, then freeze it.
- Assumption: no `is_official` column on Pulse posts; wave 4 introduces the alert type instead.

**Do not build:** live map as core/default; vehicle dots; traffic overlays in release; fake trotro ETAs / "on time" badges / synthetic queue estimates; dark mode, custom typeface, new animation libs, Lottie; train booking; wallet dependencies; okada/pragya surfaces; a Rewards or Report tab; paid tiers; ads in pushes; paid LLMs; background location / motion detection.

**Open questions for the owner**
1. Tab label: **Lines** (recommended) or keep **Fares** (SEO wedge)?
2. Confirm **Rewards leaves the tab bar** for **Stations** (coins chip + Profile remain).
3. Confirm the 3 launch corridors + colours (Madina–Circle blue, Kasoa–Circle/Kaneshie teal, Tema–Accra violet).
4. Who approves alerts (gates wave 4)?
5. Remove `TodaysFares` from Home (recommended) or keep as a compact row under My lines?
