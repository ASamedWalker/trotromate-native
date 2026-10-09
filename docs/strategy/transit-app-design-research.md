# Transit app design research, and what Troski should take from it

_2026-10-09. Companion to `troski-commute-habit-plan.md`. Research only; no code changed. "(unverified)" marks claims I could not confirm from a fetched source._

## 0. Current Troski state (for reference)

- Tabs: Home, Lines (labelled Fares in store release), Train, Wallet (hidden in release mode), Pulse, plus Rewards in release mode (`app/(tabs)/_layout.tsx`). Floating pill tab bar, brand orange `#FF4D1C`.
- Home has a `MyRoutesCard` that shows up to 3 saved routes. Each shows the fare (GPRTU or reported), the queue status with a colour dot, and the report age. The morning/afternoon variant switches at noon, and it shares `describeCommute` with the 06:15 and 16:00 pushes, so the card and the push agree. Favourites are still local-only, with server sync planned in Phase 1 of the habit plan.

## 1. Transit's information architecture

**Lines-first home, not map-first.** Transit's home is "a map with your location and a list of nearby transit lines including their next departure time" ([How to use Transit](https://help.transitapp.com/article/93-how-to-use-transit)). The list is the product and the map is only context. The 5.0 redesign post says the team kept the colored Nearby list because "homescreens are sacred". A 2014 redesign reportedly cost them about 20% of users overnight ([Transit 5.0](https://blog.transitapp.com/the-big-5-0-transit-gets-a-makeover-eb169ecee240/)). This matters for Troski: a list-led home is Transit's own default, so we are not abandoning their pattern by skipping the map.

**Line cards.** Each card has a route badge in the agency's colour, a direction or destination, the nearest stop, and the next departures. Transit 6.0 added an "ETA card" component whose ETA font went from 18pt to 60pt. It carries alerts, crowding, accessibility status, cancellations and alternatives, but "the ETA comes first" ([Transit 6.0](https://blog.transitapp.com/six-o/)). Departures render as countdowns ("in 28 min") rather than clock times. A real-time prediction gets animated "radio waves" next to the number, and a scheduled-only departure does not ([support article](https://help.transitapp.com/article/93-how-to-use-transit)). That one icon is the whole honesty mechanism.

**Pinning and favourites.** Tapping a line lets you pin it. A pinned line then rises to the top of the nearby list whenever you are near it. On pinning, the app asks whether to turn on service-alert notifications for that line ([support](https://help.transitapp.com/article/93-how-to-use-transit)). Pinning therefore does two jobs: it personalises the list, and it sets the notification subscription.

**Search and home/work.** 5.0 moved the search bar to the middle of the screen for thumb reach. Search shows "Instant ETA" predictions to frequent places such as home and work ([5.0 post](https://blog.transitapp.com/the-big-5-0-transit-gets-a-makeover-eb169ecee240/)). The exact home/work setup UI was not described in the sources I fetched (unverified).

**Line/route detail.** 5.0 collapsed route map, service alerts, vehicle locations and schedule into one "all-powerful route screen" ([5.0 post](https://blog.transitapp.com/the-big-5-0-transit-gets-a-makeover-eb169ecee240/)). One screen per line is the unit of depth.

**GO.** GO is Transit's navigation mode with step-by-step notifications: when to leave, when to change lines, when to get off. It is also the crowdsourcing switch. A rider who taps GO broadcasts the vehicle's position to riders downstream, with 1 to 2 seconds of latency against about 15 seconds for a typical agency transponder ([AutoGO post](https://blog.transitapp.com/autogo/)). The reward loop has four parts:
- The rider sees "how many nearby riders you're helping".
- A monthly helpfulness rank per line.
- Line leaderboards, with over 1M monthly leaderboard checks.
- Thank-you messages from waiting riders.

AutoGO guesses which vehicle you are on when you open the app, and over 1M trips have started that way ([AutoGO](https://blog.transitapp.com/autogo/)). Transit also gathers about 10M monthly rider answers on crowding, delays and stop conditions (same post). Coverage: in several bus-heavy cities, GO improves real-time data on up to 65% of vehicle trips ([MacRumors summary](https://www.macrumors.com/2018/08/17/transit-app-real-time-data-175-cities/); the 65% figure comes from a search summary, so treat it as approximate).

**Royale** is the paid tier, covered in section 5. Its customisation covers themes, app icons, an avatar and nickname, and leaderboard emojis ([Mass Transit](https://www.masstransitmag.com/technology/passenger-info/mobile-applications/article/21234959/transit-launches-subscription-based-royale)).

**Service alerts** are attached to the line, shown in the ETA card, and delivered by push only for pinned lines (opt-in at pin time). This is subscription by relevance, not broadcast.

## 2. Visual language

- **Colour is identity.** The line colour comes from the agency's real branding, so the badge looks the same on the street signage and in the app. 6.0 pushed "bigger, bolder, bubblier colours" ([6.0](https://blog.transitapp.com/six-o/)).
- **Dark mode is first-class.** More than 50% of users run dark mode, rising to about 75% after sunset. Transit built a programmatic colour picker that derives dark-mode tones from each agency's route colours ([6.0](https://blog.transitapp.com/six-o/)). A line colour that fails contrast is adjusted by algorithm per city, not by hand.
- **Typography.** Custom typeface Puffin Transit (Bold Monday), a humanist sans that replaced Interstate, with tweaked "3" and "4" numerals for glance legibility ([6.0](https://blog.transitapp.com/six-o/)). The big numeral is the hero element.
- **Density.** 6.0 increased margins and type size ("whitespace"), so it is less dense than the earlier versions. The principle is "avoid making you relearn Transit". The team attributes the 2014 user loss to changing the home screen.
- **Style.** 5.0 mixed light skeuomorphism (subtle shadows for hierarchy), flat colour and cards ([5.0](https://blog.transitapp.com/the-big-5-0-transit-gets-a-makeover-eb169ecee240/)).
- **Iconography, motion, onboarding, empty states, accessibility:** not documented in the posts I fetched (unverified). What is verified: the radio-waves animation as a status signal, accessibility status inside the ETA card, and colour adjustment for contrast.

## 3. Notifications and habit loops

Verified: pin-time opt-in for service alerts; GO's leave-now / change / get-off prompts; thank-you pushes to contributors; AutoGO prompts on app open ([AutoGO](https://blog.transitapp.com/autogo/)). Not verified: the details of Transit's morning-commute or trip-reminder pushes (unverified).

The loop, as far as sources show:
1. Open the app, see a nearby list.
2. Pin the line you use.
3. Get alerts for that line.
4. Ride with GO, and get thanked and ranked.

The habit hook is "my line, right now", with no search. Troski already has the equivalent in `MyRoutesCard` and the 06:15 / 16:00 pushes.

## 4. Low-data and no-realtime areas

- Where there is no feed, Transit falls back to scheduled times, which are visibly unmarked (no radio waves). Honest labelling comes first, then upgrades to real-time as data arrives.
- Crowdsourcing bootstraps real-time. The 175-city expansion rested on opt-in GO plus a large user base per city. Earlier crowdsourcing "hasn't worked" because of low critical mass or covert background tracking ([blog](https://blog.transitapp.com/transit-adds-crowdsourced-real-time-in-175-cities-a90ec97685ec/)). Transit publishes no minimum-density threshold for switching a line from scheduled to crowdsourced real-time (stated in the post).
- Transit also fixed NYC's lettered subway lines by crowdsourcing ([NYC post](https://blog.transitapp.com/how-were-bringing-real-time-countdowns-to-nyc-s-lettered-lines-482d3b8f9899/)).
- Lesson for Accra: the density problem is the same, and Transit solved it with scale. We have no scale yet, so seed with paid reporters (Phase 2 of the habit plan) and surface the age of every report.

## 5. Monetisation (brief)

- Royale: about US$4.99 a month or US$24.99 a year, with regional pricing ([Mass Transit](https://www.masstransitmag.com/technology/passenger-info/mobile-applications/article/21234959/transit-launches-subscription-based-royale)). It gates far-future departures and distant lines, plus customisation and leaderboard perks. Core real-time, alerts and routing stay free ([Transit blog](https://blog.transitapp.com/sustainable-for-the-long-haul/)).
- Revenue also comes from fare-payment partnerships with 50+ agencies. There are no ads and no data sale (same post).
- Agencies can gift Royale to all riders (Denver RTD, St. Louis Metro and others). A no-questions free tier exists for riders who cannot afford it ([agency gifting](https://site.transitapp.com/news/first-agencies-gifting-royale)).
- Relevance to Troski: ads and paid tiers are not for now (the owner has said the product is not production-ready). The transferable idea is to keep the commute core free and monetise cosmetics or partnerships later.

## 6. Other apps, briefly

- **Citymapper:** polished trip planner with strong brand voice and "get off here" prompts (general knowledge, not fetched here; unverified).
- **Moovit:** merges official feeds with user reports (delays, crowding, driver satisfaction) and covers places without official data, including Ghana per a roundup ([Wikipedia](https://en.wikipedia.org/wiki/Moovit), [Fast Company](https://www.fastcompany.com/91324141/best-travel-transit-map-app-abroad-apple-google-maps-citymapper-moovit-rome2rio-naver)). It is the closest global competitor to Troski for "trotro info". How good its Accra trotro data is I did not verify (unverified).
- **Google Maps:** no rider-reported transit alerts at platform level ([comparison](https://unstar.app/blog/transit-citymapper-moovit-google-maps-trainline-public-transit-apps-ranked-2026)). Its blind spot is informal fares and queues, which is Troski's wedge.
- **Nairobi matatu ecosystem:** Digital Matatus built the first open map and GTFS of an informal system, and noted over five competing routing apps, including Ma3Route ([Digital Matatus](https://www.digitalmatatus.com/pdf/CUPUM_book_chapter.pdf), [Engineering for Change](https://www.engineeringforchange.org/solutions/product/digital-matatus/)). Ma3Route crowdsources traffic and matatu information across app, web and SMS ([Crunchbase](https://www.crunchbase.com/organization/ma3route)). Lessons from the chapter (summarised by the fetch tool, not read line by line): fare transparency is hard, stops are not standardised, and crowdsourcing is essential infrastructure. Users want fares, crowding and alternatives, not just wayfinding. Success came from designing for actual behaviour.
- **WhereIsMyTransport:** named as a competitor in the Nairobi space; I found nothing on its product design (unverified). **Lagos apps:** nothing found (unverified).

## 7. What Troski should borrow / adapt / avoid

| Transit pattern | Accra trotro reality | Verdict |
|---|---|---|
| Lines-first home, list over map | Fits the no-live-map rule exactly | **Borrow.** Keep Home as a ranked list of "my corridors". |
| Nearby lines by GPS | Trotro "lines" are origin-destination corridors from a station, not stops on the street | **Adapt.** Nearby stations (location-aware), then the corridors leaving each. |
| Line colour badge as identity | No agency livery. Corridors/stations are the identity | **Adapt.** Give each launch corridor (Madina-Circle, Kasoa-Circle, Tema-Accra) a stable colour and short code badge. Contrast-check on dark and light. |
| Giant countdown ("in 4 min") | There is no timetable, and a fake countdown would be a lie | **Avoid.** Use a big status word and number instead: "Long queue", "Loading now", "GH₵8.70". The report age ("12 min ago") sits right next to it. |
| Radio-waves real-time vs scheduled marker | Equivalent is fresh vs stale | **Adapt.** A freshness indicator: pulse or filled dot for under 30 min, hollow grey for under 2h, "No recent report" after that. Never invent a status (already a habit-plan rule). |
| Train departures | Real timetable exists | **Borrow directly.** Countdown to next train works on the Train tab, with the real-time-style marker meaning scheduled. |
| Pin line, then alerts for that line | Same idea as saved routes plus Phase 3 alerts | **Borrow.** Saving a route asks "notify me about disruptions on this?". Needs server-synced favourites (Phase 1). |
| ETA card bundles alerts, crowding, accessibility | Card = fare + queue + alert | **Borrow.** One card per saved route, with an alert chip. |
| One route screen for everything | Route detail with fare history, queue by station, incidents, Pulse posts | **Borrow.** |
| GO (opt-in broadcast, "you helped N riders", leaderboards, thank-yous) | No live position, so no GO-style tracking. Contribution = queue and fare reports | **Adapt strongly.** "Your report helped N riders" counters, a per-corridor reporter leaderboard, "thanks" taps from riders. Rewards/coins already exist; add the visible social reward. |
| AutoGO | Could be location-prompted ("At Madina station? Report the queue?") | **Adapt.** A one-tap prompt when the user is at a station. Cheap on data. |
| Low-density bootstrap by scale | We lack scale | **Borrow with ops.** Paid station reporters plus one-tap "still true?" confirmations. |
| Dark mode first-class, programmatic colour contrast | Android-heavy, battery and data aware | **Borrow.** Also keep type large and images minimal. |
| Big bold numerals, custom typeface | Fare and queue are the hero values | **Borrow.** Large fare figure; font is already `Baloo 2` on the landing page. |
| Royale subscription | Not now | **Defer.** Keep commute core free, consider cosmetics or partners later. |
| Sacred home screen | Hold to this | **Borrow.** Settle Home layout, then change it rarely. |
| Map-heavy line detail | Conflicts with data-cost lens | **Avoid** as a core surface. Optional, tap-to-open only. |

## 8. Suggested next steps

1. Make the freshness indicator (section 7, row 5) a shared component and use it on Home, station and queue screens.
2. Pick colours and short codes for the 3 launch corridors, and add corridor badges to `MyRoutesCard`.
3. Design the "you helped N riders" reporter feedback loop before the paid-reporter pilot.
4. Gaps for follow-up research: Transit's actual onboarding and empty states (needs the app itself or screenshots); Moovit and Google Maps behaviour in Accra tested on device.

## 8. Visual check against Transit's real screens (2026-10-09)

Source: the 6 iPhone screenshots on Transit's US App Store listing (apps.apple.com/us/app/transit-subway-bus-times/id498151501), viewed directly in Chrome. These are marketing screenshots, so they show Transit's best-case states.

| Screen | What it actually shows | Troski mockups before this check |
|---|---|---|
| **Home: "See all nearby departures instantly"** | Map fills the top ~45% as context. A green "Where to?" bar with a Home shortcut ("32 min") sits on the seam. Below it, **each line is a full-width block filled with the line's colour**: route badge or number (big, white), "→ direction", stop name, and the countdown huge on the right with a radio-wave mark. No white cards and no dividers; the colour *is* the card. | White cards with a small corridor badge. **Off.** |
| **Track your ride** | Huge route name ("M9"), a "4th" rank chip, a big **GO** button, and three departure tiles (2 / 11 / 19 min) where the first is filled in the line colour. Below: ratings chips (★4.6, 70%, Contactless), walk time and stop. | Not covered. |
| **Disruption info** | The line detail screen is **entirely in the line colour** (E = deep blue). A big line letter, direction, then **"Alerts enabled · Mon–Fri 8–10 AM, 5–7 PM"**: alerts are scheduled around the rider's commute. The alert card shows type, text, "Posted on…" and **"Source: MTA"**. A push banner on top. | Route detail had a dark hero, no alert schedule, no source line. **Partly off.** |
| **Find the fastest trip** | The planner header is in brand green with from/to fields. Results are a timeline of coloured line pills, "Go in 2 min" with a real-time mark, and total minutes. | Not covered (trip planning is Phase 4+ for Troski). |
| **Step-by-step** | Map plus "Your stop is next!", a progress bar with the rider avatar, a big next-stop card in the line colour, "Exit NE". A points counter ("602") sits top-left. | Not covered (GO Mode exists in the full app only). |
| **Rate your ride** | GO crowdsourcing: **"How many open seats do you see on this bus?" with 3 big playful tiles** ("Lots of open seats" / "Few if any seats" / "Packed like sardines"), plus Back and Skip. The points counter is visible. | Report screen had 5 plain radio rows. **Off: Transit's version is lighter and more fun.** |

**What changes for Troski:**
1. **Line cards become colour blocks**: corridor colour fills the card, with white text, a big code, "→ destination", the boarding station, and on the right the **fare as the big number** with the queue status under it. No countdown on trotro cards.
2. **Route/corridor detail turns the whole header the corridor colour**, adds "Alerts on: Mon–Fri 05:30–08:30, 16:30–19:00" (matches our push times and reporter hours), and alert cards show **"Source: GPRTU / Troski reporter / …"**.
3. **Queue reporting copies the 3-tile micro-survey shape**, not the copy: "Cars waiting / Short wait / Long queue" style tiles with Ghanaian phrasing, plus Back/Skip, asked in context ("How's the queue at Madina?"). Tiles use drawn icons, not emoji (our UI rule).
4. **Visible contribution score** (Transit's points counter) maps to our coins chip; keep it on Home and in the report flow.
5. **Keep the deviations**: no map on Home (data cost), no fake countdowns, Baloo 2 instead of Transit's custom face, Troski orange as the brand (Transit uses green). We adapt the patterns, not Transit's look.
