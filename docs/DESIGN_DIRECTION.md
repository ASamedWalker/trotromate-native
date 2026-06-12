# Troski Design Direction — Mobility-App Research Synthesis (June 2026)

Source-verified research into the design/engineering blogs of Uber, Lyft, Transit,
Citymapper, Grab, Gojek, Discord, Shopify, and Coinbase, plus African informal-transit
research. Every claim marked **[verified]** survived 3-vote adversarial fact-checking
against the original source. Run: deep-research workflow, 107 agents, 25 sources.

**The thesis:** Uber/Lyft polish + Transit's crowdsourcing engine + Grab/Gojek's
low-end-network craft = a trotro app nobody else can copy, because the moat is the
community data loop, not the UI.

---

## 1. What the research VALIDATES in Troski today

These existing decisions match what the best-in-class apps arrived at independently —
keep them and lean in harder:

| Troski decision | Industry validation |
|---|---|
| Baloo 2 rounded font | Transit 6.0 replaced Interstate with a custom **rounded, friendly** typeface (Puffin Transit): "friendly, round, skimmable, charismatic" — warmth is a deliberate transit strategy, not a compromise **[verified]** ([Transit 6.0](https://blog.transitapp.com/six-o/)) |
| Supersized fare on route cards | Transit's "ETA cards" enlarged the key number from 18pt to **60pt** and put it first in hierarchy across all screens **[verified]** (same post) |
| Per-line deterministic colors | Transit 6.0's dark mode derives its palette programmatically **from route colors** **[verified]** (same post) |
| No-cash Rewards framing | Transit: per-line leaderboards + GO points; **20% of riders use GO specifically for gamification** **[verified]** ([AutoGO](https://blog.transitapp.com/autogo/)) |
| GPRTU co-design | Uber Base principles: "designing **with**, not designing **for**" people with lived experience **[verified]** ([Base Principles](https://base.uber.com/6d2425e9f/p/434f39-principles)) |
| Crowdsourced upfront fares | Uber's 2016 redesign: upfront fares at the selection step make choice "clearer and simpler" **[verified]** ([Designing the new Uber app](https://medium.com/uber-design/designing-the-new-uber-app-16afcc1d3c2e)) |

## 2. Load-bearing principles to adopt (mapped to screens)

### P1. "Where to?" is the app — destination-first architecture
Uber rebuilt its entire 2016 app around one question: *"Where to?"* — everything
builds from the destination **[verified]**. Troski's Home buries "Where to?" as one
card among services. **Move:** make destination entry the hero of Home (top, huge,
thumb-reach); services grid is secondary. The trotro answer to "where to?" is a
corridor + station, not a dispatched car — same question, different answer surface.

### P2. The app works ahead of the user
Uber computes the pickup point *while* you're still choosing a product, and pre-fills
your likely destination before you type **[verified]**. **Move:** prefetch route
detail + fares the moment search results render (before the tap); precompute the
morning commute card at app open; warm the Mapbox style cache.
→ `routes/search.tsx`, Home commute card, TanStack Query `prefetchQuery`.

### P3. One number dominates every card
Transit's ETA cards: the single datum the rider came for (ETA there; **fare/next
departure** for us) gets display-size type, everything else consolidates beneath
**[verified]**. Done on Lines route cards; extend to Train departures, route detail
sheets, wallet balance (done), Rewards gauge (done).

### P4. Payment failure is the fastest way to lose a user
Lyft Pay team: "Nothing erodes customer trust faster than a broken payment
experience — it needs to work every time"; their principles: **Transparency & trust,
Control & flexibility, Context** **[verified]** ([design.lyft.com](https://design.lyft.com/)).
**Move:** Wallet gets explicit pending/processing/failed states with plain-language
copy, idempotent retries, and the MoMo confirmation webhook (already tracked in
CLAUDE.md) becomes a P1 — the "GH₵ X added ✓" moment IS the trust moment.

### P5. Glanceable persistent status beats notification spam
Lyft judged push notifications inadequate for ride state ("crowded, fleeting,
quickly out-of-date") and built Live Activities — 26 ride states × 4 presentations
**[verified]**. Confirms CLAUDE.md's bus-arrival build order (Live Activity first).
**Bonus pattern for low-data contexts:** when no map is available, Lyft flattens the
route into a **10-step progress bar** where the vehicle moves one step per initial-ETA
minute **[verified]** — perfect for trotro arrival on lock screen and 2G fallback.

### P6. Crowdsourcing only works wrapped inside a feature that pays the contributor
Transit's GO is "Waze for transit": the rider gets step-by-step value (when to leave,
when to get off, adjusted ETAs) and **as a side effect** broadcasts vehicle position
to riders down the line **[verified]** ([175 cities](https://blog.transitapp.com/transit-adds-crowdsourced-real-time-in-175-cities-a90ec97685ec/)).
Phone-sourced positions have **1–2s latency vs ~15s for bus transponders** — crowd
data can *beat* formal AVL, it's not a degraded fallback **[verified]**.
In-ride micro-surveys timed to the trip get **~75% answer rates** **[verified]**
([Rate-My-Ride](https://blog.transitapp.com/about-rate-my-ride/)).
**This is Troski's moat. See Trip Mode below.**

### P7. Two hard preconditions for crowdsourcing: density + opt-in
Transit: it works because of rider density and an **opt-in** feature; covert
background tracking = "say goodbye to those loyal users. You nasty battery thief!"
**[verified]**. **Move:** launch live tracking corridor-by-corridor (Circle, Kaneshie,
Madina first), never city-wide; tracking is always an explicit user action.

### P8. Close the loop — show contributors what their data built
Transit surfaces crowd ratings back as per-line reliability scores **[verified]**.
Troski already shows "Based on N reports"; extend to a per-line **fare-confidence
score** and reliability grade on Lines cards.

### P9. Essentials free forever; monetize convenience, never trust
Transit's paywall gates only power-user conveniences; "You will always know when your
next ride is coming, no matter what" **[verified]** — and they explicitly refuse ads
and data-selling as a trust principle **[verified]**
([Sustainable for the long haul](https://blog.transitapp.com/sustainable-for-the-long-haul/)).
**Move:** fares/routes/next-vehicle always free. Monetize wallet/booking convenience
now, a Royale-style supporter tier later. No ads in Pulse.

### P10. Audit blind spots before redesigning
Uber Base's principles page is entirely about product inclusion: unpack team identity
to find blind spots before designing **[verified]**. For Troski: smartphone tier
(low-end Android), data cost, literacy, language (Twi/Ga/Pidgin), and *who actually
pays* (the mate interaction) are the blind-spot checklist for every new screen.

### P11. Atomic components, not one-off screens
Lyft's LPL: atomic elements → shared internal components → consistency + lower
maintenance **[verified]** ([LPL](https://design.lyft.com/building-a-design-system-library-3a1f0d09088f)).
Evidence we need this: the June 2026 Baloo lineHeight clip bug had to be fixed in
**6 places across 4 files** because fare/number display is re-implemented per screen.
**Move:** extract `<HeroNumber>`, `<FareText>`, `<RouteRow>`, `<StatCard>`,
`<SectionHeader>` primitives; TroskiCoin already proves the pattern.

### P12. Dark mode is a majority transit feature
**>50% of Transit users run dark mode (75% after sundown)** **[verified]**. Trotro
commutes start pre-dawn. Dark mode is currently disabled in Troski — re-enabling is a
real (large) roadmap item: rebuild properly with the line-color-derived palette trick,
don't resurrect the old half-working theme.

## 3. Performance & "crisp feel" practices (React Native)

Verified anchor: **Grab uses skeleton screens at launch specifically for weak networks
and low-end devices** — reduces perceived latency **[verified]**
([Grab engineering](https://engineering.grab.com/driving-sea-forward-through-people-focused-design)).
The rest below is the published playbook of production RN apps (Shopify 5-years-RN /
FlashList, Coinbase, Discord, Gojek Project Butter — consulted, not independently
verified):

1. **Loading policy — never blank, cached-first, rarely skeleton.** Preference order:
   (a) **cached-data-first**: render last-known fares/routes/balance instantly
   (TanStack Query `staleTime`/`placeholderData`) and refresh silently — this, not
   skeletons, is why Uber's rider app feels like it has no loading states;
   (b) **shimmer placeholder** only for true first-loads with no cache — Uber Base
   ships this officially as the "Placeholder" component (45° shimmer), Grab documents
   it for weak networks; (c) **map screens never skeleton** — progressive map render
   with the sheet filling in; (d) **spinners only inside buttons**. The Lines tab's
   current bare centered spinner is the one pattern no one defends — replace first.
2. **Anticipatory prefetch** (P2 above) — perceived speed beats actual speed.
3. **FlashList v2** for Pulse feed and Lines list (Shopify's recycling list).
4. **Optimistic UI** — fare reports, likes, coin awards render instantly, reconcile after.
5. **Motion tokens** — standardize on Material 3 durations (~200–300ms standard
   transitions, emphasized easing for hero moments) + always respect reduce-motion.
   One `lib/motion.ts` with named durations/easings instead of ad-hoc values.
6. **Haptics discipline** — light impact on selection, success notification on
   payment/report success (already partly done).
7. **Image/app-size budget** — expo-image everywhere (done), audit the 1254px service
   PNGs into properly sized variants, watch bundle size (Gojek treats app size as a
   conversion metric in emerging markets).
8. **Watch the frame budget on low-end Android** — the existing CLAUDE.md reanimated
   bans exist for this reason; profile on a cheap device, not just the iPhone sim.

## 4. Standout features (prioritized for the trotro context)

### P0 — the moat
1. **Trip Mode — "GO for trotro"** (the single most important thing we can build).
   In-ride companion: pick your alighting stop → app tracks the ride, tells you
   "2 stops to Abeka Lapaz", wakes nappers before their stop, shows the fare to have
   ready — and as a side effect broadcasts vehicle position to riders waiting
   down-line (1–2s fresh, beats any transponder) and asks one-tap micro-questions at
   the right moments ("How much did the mate charge?" → ~75% answer rates).
   Unifies four existing roadmap items: live tracking, arrival notifications, fare
   crowdsourcing, Rewards missions. Nobody else navigates the trotro ride itself.
2. **Fare Check + dispute flow** — the "what should I pay?" answer at the decision
   moment (exists), plus per-line fare-confidence score (P8), time-of-day fare
   patterns, and a one-tap overcharge report that feeds the GPRTU loop.
3. **Lock-screen arrival (Live Activity)** — bus approaching + Lyft's 10-step
   map-free progress bar as the low-data presentation. Already first in CLAUDE.md's
   notification build order; research confirms the order is right.

### P1 — engagement engine
4. **Per-line leaderboards** — "Top reporter: Kaneshie ↔ Circle" per corridor,
   feeding the existing Pulse contributor tiers (Transit-verified pattern).
5. **AutoTroski boarding detection** — guess the corridor from motion + geometry,
   one-tap "On this car?" to start Trip Mode (Transit's AutoGO: 1M+ trips started
   via the one-tap prompt).
6. **Skeleton + prefetch pass** (section 3) — this is the "smooth/crisp" feel ask.
7. **Dark mode rebuild** with line-color-derived palette (P12).

### P2 — deepen the wedge
8. **Station Mode** for mega-terminals (Circle, Kaneshie, Madina): which yard/queue
   for your destination, crowd-sourced queue length (Queue Status stub exists).
   Start with 2–3 stations — density precondition (P7).
9. **Offline/low-data pack** — corridor maps + fare tables cached; the 10-step
   progress pattern as the no-map tracking view; SMS alert fallback.
10. **Twi/Ga/Pidgin localization + voice announcements** ("mate mode") — the
    inclusion checklist (P10) made concrete. Validate demand with Pulse polls first.

## 5. What NOT to copy from Uber/Lyft

- **Dispatch-first architecture** — trotro is corridor-based, not point-to-point;
  "Where to?" transfers, "a car comes to you" does not.
- **Algorithmic/surge pricing UI** — fares are negotiated/union-anchored; Troski's
  job is *transparency about the consensus price*, never computing a price. An
  Uber-style fare estimate would read as the app taking the operators' side.
- **Push notifications as the ride-status channel** — Lyft's own verdict: crowded,
  fleeting, out-of-date. Persistent glanceable surfaces instead.
- **Covert background location** — Transit's explicit warning; opt-in only (P7).
- **Five-star ratings of individual workers** — rating a specific mate/driver can
  threaten livelihoods in an informal sector and invite retaliation; rate the LINE
  (reliability, fare fairness, crowding) like Transit does, not the person.
- **Ads / data monetization** — Transit's refusal is a trust strategy (P9).
- **Assuming schedules exist** — anything GTFS-shaped ("next scheduled departure")
  is fiction here; show *observed* frequency from crowd data instead.
- **Cautionary tale:** WhereIsMyTransport mapped informal transit across African
  cities as a B2B data play and shut down in 2023 — the consumer utility + payments
  loop is the business, the map alone is not.

## 6. Suggested build order (next 3 design sprints)

1. **Sprint 1 — "Crisp"**: skeleton system + prefetch + motion tokens + component
   primitives extraction (P11). Pure feel, no new product surface.
2. **Sprint 2 — "Trip Mode v1"**: manual start from route detail ("GO"), alight-stop
   alarm, in-ride fare micro-survey, position broadcast on the 3 densest corridors.
3. **Sprint 3 — "Trust loop"**: fare-confidence scores on Lines, per-line
   leaderboards, MoMo confirmation webhook + payment-state polish.

---
*Verified claims: 24/25 (1 refuted: Transit's "65% of vehicle trips improved by
crowdsourcing" scale stat — do not cite it). Full claim list with quotes lives in the
research run output; sources are linked inline above.*
