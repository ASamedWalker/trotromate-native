# Troski — Market Strategy Analysis

**Date:** 2026-07-07 · **Author:** Fable (strategy synthesis) on 4 web-research passes + repo grounding
**Claim labels:** `[fact]` researched fact with source · `[fact-NV]` researched fact, needs further verification · `[code]` code-based observation (file cited) · `[inf]` inference · `[hyp]` hypothesis
**Scope:** analysis only — no app changes. Companion docs: `troski-competitor-tracker.md`, `troski-partnership-targets.md`, `../ux/troski-ui-ux-upgrade-analysis.md`.

---

## 1. Executive summary

Troski's market position is stronger than the crowded app landscape suggests, for one reason: **every prior attempt at this market died on data-refresh economics, and Troski's architecture is the first designed around cheap, continuous refresh.** The canonical public Accra route dataset is frozen at September 2017 `[fact]` ([DT4A GTFS](https://git.digitaltransport4africa.org/data/africa/accra/tree/master/GTFS)); Trufi's Trotro App is delisted `[fact]` ([OSM wiki](https://wiki.openstreetmap.org/wiki/Trotro_App)); WhereIsMyTransport raised ~$27M and shut down in Oct 2023 selling data to cash-strapped governments `[fact]` ([TechCabal](https://techcabal.com/2023/10/26/whereismytransport-shutting-down/)); Trotro.Live pivoted toward parcels `[fact]` ([Digilogic](https://digilogic.africa/trotro-live-digitising-transportation-information/)).

The window is real but closing: two near-identical crowdsourced-fare competitors launched in 2026 (Trostar, TrotroWays) `[fact]`, and GPRTU has publicly announced it wants a cashless system and has no named tech partner `[fact]` ([Adomonline](https://www.adomonline.com/gprtu-eyes-cashless-transport-system-to-curb-armed-robbery-attacks-on-drivers/)).

**Recommended strategy (one path):** win *fare truth + freshness* as the wedge; convert that into a GPRTU branch-level data partnership within 12 months; monetize via the already-built events/ads surface and later booking fees; position EV minibus work as *data broker/matchmaker* (no balance-sheet risk) with a Chinese-OEM pilot brokered on union routes — Ghana's EV import-duty waiver for public-transport EVs runs to 2032 `[fact]` ([trade.gov](https://www.trade.gov/market-intelligence/ghana-electrical-vehicle-tariffs)), which puts a clock on this.

## 2. The transportation problem in Ghana

- Paratransit (trotro) serves up to **86% of Accra residents**; ~**80% of motorized trips** `[fact]` ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2950196225000080), [AccraMobile](https://wiki.lafabriquedesmobilites.fr/wiki/Accra_Mobility)).
- The network is entirely informal: no schedules, no published fare charts online, no live vehicle positions, queue order controlled by station "bookmen" `[fact]` ([Spooner et al. 2023](https://www.researchgate.net/publication/375826485_Informal_transport_workers_in_Accra_Livelihoods_Organisation_and_Issues)).
- Fares change as flat national % announcements negotiated between the Ministry of Transport and GRTCC (GPRTU + PROTOA + others) `[fact]` ([Graphic](https://www.graphic.com.gh/news/general-news/negotiations-with-the-transport-operators-are-still-ongoing-ministry-of-transport.html)) — 15% cut May 2025, 20% rise June 2026 `[fact]` ([GhanaWeb](https://www.ghanaweb.com/GhanaHomePage/NewsArchive/See-list-of-new-transport-fares-effective-May-24-1984833), [Citinewsroom](https://www.citinewsroom.com/2026/05/public-transport-fares-to-go-up-by-20-from-june-2/)). Competing associations sometimes announce contradictory figures, creating rider confusion `[fact]` ([Chronicle](https://thechronicle.com.gh/the-fare-confusion-in-ghana-a-miscommunication-with-real-consequences/)).
- The state's replacement attempt (Aayalolo BRT-lite, ~$95M) degraded from 75 to 10 operational buses by 2020 and now competes with trotros without lane advantage `[fact]` ([Citinewsroom](https://citinewsroom.com/2020/05/gapte-reduces-operational-aayalolo-buses-from-75-to-10/), [Ghanamma](https://www.ghanamma.com/2025/04/28/multi-million-dollar-world-bank-aayalolo-brt-now-competing-for-passengers-with-trortro/)).
- Net: uncertainty (fare, wait, route) is the product gap — not vehicle supply. `[inf]`

## 3. Why informal transport is hard to digitize

1. **Data decays fast, collection is expensive.** WhereIsMyTransport's manual/gig collection never got COGS down; routes change constantly `[fact]` ([Startup Graveyard](https://startupgraveyard.africa/blog/case-study-what-really-happened-to-whereismytransport)). One-off donor mapping (AccraMobile3, 2017) had no refresh pipeline `[fact]`.
2. **No schedules exist to publish.** Trotros depart when full; "timetable" apps import garbage-in (Moovit's Accra pages show 2017-era codified routes as if live) `[fact]` ([Moovit Accra](https://moovitapp.com/index/en/public_transit-Accra-5501)).
3. **The union is the operating system.** Fares, queue order, route allocation run through GPRTU locals and bookmen; tech that ignores them gets rejected — GPRTU publicly said Tap n' Go "can never work as trotro" `[fact]` ([GhanaWeb](https://www.ghanaweb.com/GhanaHomePage/business/Tap-n-Go-ticketing-system-can-never-work-as-trotro-GPRTU-1917814)).
4. **The buyer with money isn't the government.** African city authorities are cash-strapped data customers `[fact]` (WIMT lesson); donors fund studies, not operations `[inf]`.
5. **Rider device/data constraints.** Low-end Android, expensive data — Troski already ships Data Saver because "data costs money in Ghana" `[code]` (`CLAUDE.md`, GO Mode).

## 4. Core commuter pain points

Ranked `[inf]` from research + product telemetry design:
1. **Fare uncertainty / overcharging** — per-drop-off fares exist only on physical station charts; % changes cause confusion `[fact]` (Chronicle above).
2. **Wait/queue opacity** — loading order is the bookman's paper ledger `[fact]` (Spooner).
3. **Route discovery for unfamiliar journeys** — Google Maps effectively blank for trotro `[fact-NV]` (corroborated: [TrotroWays](https://trotroways.com/), [AccraTrotro guide](https://accratrotro.com/navigating-accras-public-transport-system-a-guide/)).
4. **Safety/confidence** (night travel, harassment, breakdowns) `[hyp]` — needs primary research.
5. **Cash friction** — exact change with the mate; robbery risk drives GPRTU's own cashless interest `[fact]` (Adomonline above).

## 5. Operator/union pain points

- **Armed robbery of drivers carrying daily cash sales** — GPRTU's stated motive for wanting cashless `[fact]` (Adomonline).
- **Daily-sales target system**: driver rents vehicle, pays fixed daily amount to owner, keeps residual — owners lack utilization visibility; drivers bear revenue risk `[fact]` (Spooner et al.).
- **Fare compliance**: unions must police unapproved fares after each % announcement `[fact]` ([3news](https://3news.com/news/be-on-lookout-for-drivers-who-charge-new-fares-transport-ministry-to-police/)).
- **Fuel + spare-parts cost pressure** (the stated cause of the June 2026 +20%) `[fact]`.
- **No data tools**: no union has route-level ridership, dwell, or revenue data `[inf]` — exactly what Troski GO Mode + booking generates `[code]` (`lib/hooks/useTrip.ts`, booking pipeline).

## 6. Competitor landscape (structure)

Three rings `[inf]`:
- **Ring 1 — direct**: Ghana trotro info/fare apps (Trostar, TrotroWays, Trotro.Live, AccraTrotro, ghTrotro).
- **Ring 2 — indirect**: global transit apps with nominal Accra coverage (Moovit, Google Maps), payment schemes (Tap n' Go, MoMo rails, Hubtel), intercity ticketing (STC, VIP Jeoun).
- **Ring 3 — substitutes**: ride-hailing (Bolt/Uber/Yango/inDrive), newly legal okada, walking + asking the mate (the true incumbent).

Full per-entity detail: `troski-competitor-tracker.md`.

## 7. Direct competitors

| Who | Status | Read |
|---|---|---|
| **Trostar** (MC Multimedia) | Launched 7 Apr 2026; routes, fare estimation, marketplace, offline `[fact]` ([OpenPR](https://www.openpr.com/news/4470623/trostar-launches-in-ghana-to-digitize-transport-and-build)) | Newest direct clone of Troski's pitch; traction unknown |
| **TrotroWays** | Live web app; claims 50k+ daily riders, 400+ routes, Kumasi Q3 + Lagos Q4 2026 `[fact-NV self-reported]` ([trotroways.com](https://trotroways.com/)) | Claims look inflated for web-only `[inf]`, but the ambition (multi-city, crowdsourced fares, rewards) mirrors Troski exactly |
| **Trotro.Live / trotro.digital** | Semi-dormant consumer product; station-manager fare dashboards + parcels pivot `[fact]` (Digilogic) | Its station-manager data channel is the one idea worth copying `[inf]` |
| **AccraTrotro.com** | Live editorial/SEO site; owns "accra trotro fares" search intent `[fact]` ([accratrotro.com](https://accratrotro.com/)) | Not an app threat; a distribution lesson |
| **ghTrotro** | APK on Aptoide, provenance unverified `[fact-NV]` | Noise |

## 8. Indirect competitors

- **Tap n' Go** — state-launched Feb 2024, live on Metro Mass/Aayalolo only; GPRTU rejected trotro integration `[fact]` ([MMTL](https://mmt.gov.gh/the-vice-president-of-the-republic-of-ghana-has-officially-launched-the-tap-n-go-digital-app-platform-for-metro-mass-transit-limited/), GhanaWeb above). The cautionary tale: card-first, union-later fails.
- **Moovit / Google Maps** — programmatic/absent Accra coverage on 2017 data `[fact]`; no fare/queue layer. Ceiling risk only if someone hands them fresh GTFS `[inf]`.
- **Hubtel** — no transit product today, but the most capable fast-follower if trotro payments show traction `[inf]` ([hubtel.com](https://hubtel.com/)).
- **STC / VIP Jeoun** — intercity ticketing already digital (own apps/sites) `[fact]` ([stcticketing.gov.gh](http://www.stcticketing.gov.gh/), [vipbustickets.com](https://www.vipbustickets.com/)); adjacency, not competition.
- **myTrotro** — despite the name, event ticketing + intercity booking `[fact]` ([Play](https://play.google.com/store/apps/details?id=com.mytrotro.app)).

## 9. Substitute solutions

- **Ride-hailing** (Bolt, Uber, Yango, inDrive — all active in Accra `[fact]` ([viewGhana](https://viewghana.com/ride-hailing-services-in-ghana-what-you-need-to-know/))): squeezes trotro at the premium end; not mass-market at Ghanaian incomes `[inf]`.
- **Okada** — legalized 11 Dec 2025 (Road Traffic Amendment Bill: licensed riders, training, gear) `[fact]` ([GNA](https://gna.org.gh/2025/12/parliament-passes-road-traffic-amendments-bill-to-legalise-okada-operations/), [Citinewsroom](https://www.citinewsroom.com/2025/12/parliament-passes-bill-to-legalise-okada/)). Will squeeze short hops; also a future supply partner and EV two-wheeler pathway `[fact]` ([GhanaWeb/GCCE](https://www.ghanaweb.com/GhanaHomePage/business/039-Okada-039-bill-creates-new-pathway-for-electric-mobility-in-Ghana-GCCE-2014339)). Trotro/taxi operators opposed the bill `[fact]`.
- **Ask-the-mate / word of mouth** — the real incumbent; free, always available, sometimes wrong. Troski must beat it on trust, not just information `[inf]`.

## 10. Comparison table

| | Troski | Trostar | TrotroWays | Trotro.Live | AccraTrotro | Moovit/GMaps | Tap n' Go |
|---|---|---|---|---|---|---|---|
| Surface | Native app + web `[code]` | App | Web app | Web (dormant) | Content site | Apps | NFC card + app |
| Fares | Per-drop-off + crowd + GPRTU-track `[code]` | Estimates | Crowd + surveys | Station-manager | Static editorial | None | Payment only |
| Live positions | GO Mode crowd-GPS `[code]` | No | No | No | No | No | No |
| Queue status | Yes `[code]` | No | No | No | No | No | No |
| Train | Schedules + reminders `[code]` | No | No | No | No | No | No |
| Wallet/booking | MoMo via Paystack `[code]` | No | No | No | No | No | Card |
| Offline | Yes `[code]` | Claimed | Claimed | — | n/a | Partial | n/a |
| Union relationship | None yet | Unverified | Unverified | Station-manager adjacent | None | None | **Rejected by GPRTU** |
| Revenue | Ads/events live; fees later `[code]` | Marketplace | Unclear | Parcels | SEO ads | Ads | Fees |

`[inf]` Feature table from research above; competitor cells reflect public claims, not audits.

## 11. Troski differentiation

1. **Only product combining fare truth + queue + live positions + train + payments in one app** `[code]` — every competitor has one slice.
2. **Refresh economics designed-in**: crowd reports with rewards loop, GO Mode passive GPS, per-drop-off fare capture `[code]` (`docs/DESIGN_DIRECTION.md`) — the exact failure point of all predecessors `[fact]`.
3. **% -reprice architecture matches how Ghana fares actually work**: `reprice_segment_fares()` applies national % announcements in one operation `[code]` (migration 052) — a maintained fare table is cheap to keep current `[inf]`.
4. **Transaction rail already live** (Paystack MoMo wallet, booking, tickets) `[code]` — none of Ring 1 has payments.
5. **566 OSM routes mapped vs the 2017 public dataset's ~300** `[code]` (`docs/ACCRA_TROTRO_MYMAPS.md`; [AccraMobile3](https://wiki.openstreetmap.org/wiki/AccraMobile3)) — already the freshest route asset `[inf]`.

## 12. Weaknesses in Troski's current concept

1. **No union relationship** — the site explicitly says "not affiliated with government or GPRTU" `[fact]` ([troski.me](https://www.troski.me)); H4 (union moat) is entirely unbuilt.
2. **No verified traction narrative** — no press, no published numbers `[fact]` (research pass found nothing); competitors will out-announce even with worse products `[inf]`.
3. **Trust hazards live in-app**: scan-to-pay mock accepts any PIN; no MoMo top-up confirmation moment `[code]` (`docs/DEFERRED_BACKLOG.md` P0).
4. **Honesty gaps**: train screen shows fake "ON TIME"; stale data rendered as fresh `[code]` (`CLAUDE.md` train backlog).
5. **Solo-founder concentration risk** — consumer app + driver app + BD + compliance `[inf]`.
6. **SEO/web invisibility vs AccraTrotro** on fare search intent `[inf]`.
7. **Data-freshness flywheel unproven** — rewards exist but contributor retention unmeasured `[hyp]`.

## 13. Strategic wedge

**Fare truth, always current.** `[inf — recommendation]`

Why this wedge: (a) it is the #1 pain `[inf]`; (b) Ghana's % -announcement system makes a national fare table *maintainable by one company* — seed per-drop-off baselines once, reprice on announcements `[code]` (already built); (c) it compounds into the union relationship (GPRTU needs fare-compliance visibility after every announcement `[fact]`), into payments (known fare → bookable fare), and into the data moat (fresh fares = the dataset nobody else has `[fact]`).

Sequence: fare truth → daily habit → queue/GO density → union MoU → payments → operator tools → EV data. Do not lead with payments (Tap n' Go's mistake `[fact]`) or with government sales (WIMT's mistake `[fact]`).

## 14. Ghana launch strategy

Already soft-launched (Play Store live `[fact-NV]`). Recommended focus `[inf]`:
1. **Corridor-first density**: pick 2–3 corridors (Circle–Madina, Kaneshie–Kasoa, Accra–Tema) and win them completely — fresh fares, seeded queue reporters, GO Mode critical mass — before breadth.
2. **Web/SEO fare pages**: publish every corridor fare as an indexable page (AccraTrotro owns this intent today `[fact]`); the app is the retention layer, web is acquisition.
3. **Post-announcement moments**: every GPRTU/GRTCC % change is a national news moment — ship updated fares within hours + press outreach ("Troski already has the new fares"). June 2026's +20% was such a moment `[fact]`.
4. **Station presence**: bookman/station-master relationships at 3 mega-terminals for queue data legitimacy (needs union local + MMDA blessing `[fact]` — see §17).
5. **Kumasi second** (donor pipeline: World Bank/PPIAF Kumasi BRT prep is active `[fact]` ([PPIAF](https://www.ppiaf.org/activity/ghana-technical-assistance-mobilizing-private-capital-bus-rapid-transits-kumasi))) — and TrotroWays has announced Kumasi Q3 2026 `[fact-NV]`.

## 15. Regional West Africa expansion logic

- Model transfers where paratransit dominates + MoMo rails exist: Lomé, Abidjan, Dakar, Lagos `[inf]`.
- Sequence only after Ghana density; the asset that travels is the *playbook* (fare table maintenance + union engagement + crowd refresh), not the data `[inf]`.
- Watch: TrotroWays claims Lagos Q4 2026 `[fact-NV]`; Dakar's electric BRT shows francophone West Africa attracts mobility DFI money `[fact]` ([ITDP](https://itdp.org/2024/03/22/dakar-senegals-electric-brt-leads-the-way-for-african-cities/)).
- Recommendation: no expansion spend in the next 12 months; document the playbook as you execute Ghana `[inf]`.

## 16. Partnership strategy

Priority-ordered `[inf]` (full tracker: `troski-partnership-targets.md`):
1. **GPRTU branch/local level** — data + cashless pilot (see §17). The single highest-leverage relationship.
2. **PROTOA** — parallel MoU for owner-run stations `[fact]` (separate station networks).
3. **GIZ/donors** — the 2023 GIZ Ghana MaaS study is effectively a feasibility study for Troski `[fact]` ([PDF](https://changing-transport.org/wp-content/uploads/2023_Mobility_Study_Ghana_MaaS_Opportunities.pdf)); position as the private implementation layer for donor data/capacity programs (SECO GUMAP ended 2023, successors likely `[fact]`).
4. **Ghana Railway Co.** — formalize train schedule/status feed (already shipping schedules `[code]`).
5. **OSM Ghana / DT4A** — publish route updates back to the commons; credibility + defensive citation `[inf]`.
6. **Chinese OEM + financier** — Phase 2, §19.
7. **Kofa** — okada/two-wheeler energy angle only, not minibus `[fact]` (~2 kWh packs).

## 17. GPRTU/operator/terminal engagement strategy

Structure reality: national → regional branches → route/terminal locals; fares national, operations local `[fact]` ([Wikipedia](https://en.wikipedia.org/wiki/Ghana_Private_Road_Transport_Union), Spooner).

Play `[inf]`:
1. **Enter at one friendly local** (a terminal where Troski already has queue reporters), not national HQ. Deliver value first: free fare-chart digitization + a compliance dashboard for the % announcement cycle.
2. **The bookman is user #1** for queue tools — digitize his ledger, don't bypass it `[fact]` (loading order is his power base).
3. **National MoU second**, using the local as proof. GPRTU's stated cashless ambition (driver robbery motive) is the hook `[fact]` — Troski's wallet + tickets is a ready pilot; frame as *union-branded, Troski-powered*.
4. **Never frame fare transparency as anti-driver**: position as protection against the *confusion* that competing announcements cause (documented pain `[fact]` — Chronicle) and faster compliance after official changes.
5. **MMDA blessing** for any physical station presence (AMA controls lorry park land `[fact]` ([GBC](https://www.gbcghanaonline.com/general/accra-cmb-station/2025/))).
6. Verify current leadership before outreach (chairman reported as Nana Nimako Bresiama `[fact-NV]`; GS unknown).

## 18. EV minibus strategy

**Role: data broker + pilot matchmaker. Not operator, not financier.** `[inf — recommendation]`

- The vehicle class exists: GoMetro/flx eKamva (SA) — 15-seat, 70 kWh, ~200 km, 45-min DC charge `[fact]` ([GoMetro](https://gometroapp.com/minibus-taxi-future-revealed-with-ekamva-ev-launch/)); Joylong E6 12–14 seat, 74–86 kWh, ~280–300 km, already exported `[fact]` ([TradeTrucks](https://www.tradetrucks.com.au/detail/joylong-e6-1214-seater-full-electric-minibus-785503)). **No EV-minibus pilot exists in Ghana** `[fact — absence]`; an Accra union-route pilot would be a West-African first `[inf]`.
- Accra duty cycles (<200 km/day typical `[inf]` — verify with GO Mode data) fit these batteries with depot charging.
- **Battery swap is NOT the minibus path**: Kofa/Spiro/Ampersand packs are motorcycle-scale `[fact]`; minibus swap unproven anywhere in Africa `[fact — absence]`. Depot/terminal charging is the model.
- **Financing template**: BasiGo pay-as-you-drive — diesel-comparable upfront, per-km fee covers battery + charging + maintenance; 100+ buses Kenya/Rwanda, $41.5M raised, 1,000-bus target `[fact]` ([Bus-News](https://bus-news.com/africa-basigo-deploys-100-electric-buses-in-kenya-and-rwanda/), [Condia](https://thecondia.com/basigo-secures-41-5m-to-drive-electric-bus-expansion-in-kenya-and-rwanda/)). Maps cleanly onto Ghana's daily-sales custom `[inf]`.
- **Troski's asset**: corridor duty-cycle + ridership + fare data = underwriting input every financier needs and nobody in Ghana has `[inf]`. Sell/contribute data into the pilot; take a brokerage/telematics position (Roam's fleet-telemetry move validates the layer `[fact]` ([CleanTechnica](https://cleantechnica.com/2026/03/04/roam-launches-ai-enabled-real-time-monitoring-solution-for-electric-fleets-in-kenya/))).

## 19. Chinese EV minibus company outreach strategy

- **Targets (order):** Joylong (minibus-class EV in production, partnership-hungry `[inf]`), Higer + King Long (proven BasiGo Africa deployments `[fact]` ([electrive](https://www.electrive.com/2026/06/26/basigo-expands-rwandan-e-bus-fleet-to-52-vehicles/), [Mobility Rising](https://www.mobility-rising.com/p/basigo-commences-a-new-line-of-e-bus-assembly))), BYD last (biggest, least partnership-hungry `[inf]`). Yutong has Ghana distribution (Autolast) but diesel `[fact]` ([Autolast](https://www.autolastgh.com/all-car-brands/yutong)) — a distributor conversation, not OEM.
- **Pitch**: not "buyer" — *route intelligence + demand aggregation + union channel + duty-free window*. Precedent: BasiGo's import → local assembly (AVA/KVM) → multi-OEM sourcing playbook `[fact]` ([China-Global South](https://chinaglobalsouth.com/2024/05/30/chinese-ev-tech-in-kenyas-mass-transport-the-basigo-story/)).
- **Ask**: 2–5 unit corridor pilot with telematics, union local as operator, financier partner (DFI/bank) carrying vehicles. Troski contributes data + app integration + rider demand.
- **Incentive stack to present**: 8-year import-duty waiver for public-transport EVs (to 2032) + GADP SKD/CKD tax holidays (10-yr CKD) + locally-assembled EVs VAT zero-rated `[fact]` ([HKTDC](https://research.hktdc.com/en/article/MTU3Mzc0MDczMA), [GADP](https://ghanaautodevcentre.org/ghana-automotive-development-policy-gadp/)).

## 20. Charging / maintenance / financing considerations

- **Charging**: public network unusable for fleets (few dozen chargers at best, one station logged 1,215 use-hours in 4+ years) `[fact]` ([Techlabari](https://techlabari.com/ghanas-ev-revolution-is-largely-held-back-by-lack-of-charging-infrastructure/)). Pilot = **depot charging at a terminal** (overnight + midday top-up). New commercial EV tariff makes cost modelable: **GH¢2.016/kWh + GH¢500/mo** (effective Apr 2026) `[fact]` ([EnergyNewsAfrica](https://energynewsafrica.com/ghana-introduces-gh%C2%A22-00-kwh-electricity-tariff-for-commercial-ev-charging-stations/)). Open questions: terminal grid capacity, ECG reliability, land rights (MMDA), overnight vehicle custody under the owner-driver model `[inf]`.
- **Maintenance**: Abossey Okai parts ecosystem is ICE-oriented `[fact-NV]`; OEM after-sales/training commitment must be a pilot condition `[inf]`. SolarTaxi is the local assembly/skills partner candidate `[fact]` ([FSD Africa](https://fsdafrica.org/impact-stories/greening-transport-in-ghana-transforming-mobility-with-electric-vehicles/)).
- **Financing**: BasiGo PAYD template (§18); Ghana bank/DFI underwriting on Troski corridor data; charging regs still in draft `[fact]` — regulatory timing risk.

## 21. Business model options

| Option | Status | Verdict `[inf]` |
|---|---|---|
| Events/ads (sponsored placements) | **Live** `[code]` (`WhatsOnAccra`, admin, ad_metrics) | Near-term cash; scale with sales effort |
| Booking/service fees (GH₵0.25 flat today) | Built, low volume `[code]` | Core once density; % vs flat = owner decision pending `[code]` (DEFERRED_BACKLOG) |
| Operator/union SaaS (compliance dashboard, queue tools, fleet) | Not built | The B2B path that respects WIMT's lesson — sell to unions/owners, not government `[inf]` |
| Data licensing (donors, OEMs, financiers, researchers) | Not built | Real but lumpy; donors (GIZ/WB) cite-and-pay for exactly this `[inf]`; conflicts with "no data selling" trust stance — resolve as *licensed aggregates, never individual data* (owner policy call) |
| EV brokerage/telematics | Not built | Long-horizon option value (§18) |
| Parcels (Trotro.Live's pivot) | Not built | **Do not build** — off-wedge distraction `[inf]` |

Regulatory guardrails: keep wallet float with licensed parties (Paystack) — self-issued e-money = DEMI licence, **GHS 20M minimum capital** `[fact]` ([BoG](https://www.bog.gov.gh/wp-content/uploads/2020/07/Licensing-Requirements-for-EMI-and-PSP-latest.pdf), [Graphic](https://www.graphic.com.gh/business/business-news/bog-pegs-minimum-capital-for-mobile-money-companies-at-gh-20m.html)). E-levy repealed Apr 2025 — top-up friction down `[fact]` ([momocalc](https://momocalc.com/mtn-momo)). GRA e-VAT/VSDC clearance applies to Troski's own fees once VAT-registered; passenger transport itself is typically VAT-exempt `[fact-NV — confirm with tax advisor]` ([GRA](https://gra.gov.gh/e-services/e-vat/), [Fonoa](https://www.fonoa.com/resources/blog/ghana-e-vat-e-invoicing-2026)).

## 22. Data moat strategy

The moat is **freshness, not coverage** `[inf]` — coverage was solved in 2017 and rotted `[fact]`.
1. Per-drop-off fare baselines + % reprice on announcements (built `[code]`).
2. Crowd validation loop with rewards (built; retention unmeasured `[hyp]`).
3. GO Mode passive route/duty-cycle traces (built; density pending `[code]`).
4. Station-manager/bookman channels (Trotro.Live's idea, executed with union blessing `[inf]`).
5. Publish *aggregates* to OSM/DT4A for credibility; keep the live layer proprietary `[inf]`.
6. Every dataset stamped with `effective_date`, `source`, age shown in UI — honesty as moat (stale-data death spiral killed predecessors `[fact]`).

## 23. Community-powered data strategy

- Rewards loop exists (points, streaks, tiers `[code]`); measure contributor retention before scaling incentives `[hyp — H6]`.
- Primary sourcing = own collection + GPRTU official; crowd = validation (owner's documented position `[code]` `docs/FARE_REPORTING_RESEARCH.md`).
- WhatsApp bot as low-smartphone on-ramp: fare query + report by chat `[hyp]` — cheap experiment, large reach; USSD if telco economics allow `[hyp]`.
- Seed reporters at target corridors (paid/free-data stipends) only until organic density; WIMT's gig-collection cost curve is the warning `[fact]`.

## 24. Trust and safety strategy

- **Honest data or no data**: show report age, "Scheduled" vs fake "ON TIME" `[code — known gap]`; never render stale as live.
- **Money trust**: fix top-up confirmation moment + remove/gate scan-to-pay mock before scale `[code — P0]`.
- **Rate the line, never the mate** (already policy `[code]`) — preserves driver goodwill, critical for union optics.
- **No individual data sales — aggregates only**, stated publicly `[inf]` (resolves §21 tension).
- **Safety features** (night mode, SOS, share-trip exist `[code]`) — market them; safety is a stated ambition and a differentiation axis vs info-only competitors `[inf]`.
- **Neutrality**: "not affiliated" positioning becomes "official data partner" only via MoU — never imply endorsement before it exists (legal/political risk) `[inf]`.

## 25. MVP roadmap (already past MVP — "V1 completion" roadmap)

`[inf]` Priorities from this analysis, no code yet:
1. **Fare-truth hardening**: drop-off capture in fare reports (gap `[code]`), fare age badges, % -reprice ops drill.
2. **Trust fixes**: top-up confirmation, scan-to-pay gating, train honesty.
3. **Web fare pages (SEO)** — acquisition layer.
4. **Corridor density program** (2–3 corridors, seeded reporters, GO Mode push).
5. **Union pilot toolkit**: fare-compliance dashboard demo for one GPRTU local.
6. Defer: parcels, intercity ticketing, expansion, EV operations.

## 26. 90-day action plan

| # | Action | Output |
|---|---|---|
| 1 | Verify GPRTU current leadership + map 3 candidate locals (terminals where Troski has users) | Outreach shortlist |
| 2 | Build fare-compliance demo dashboard (repriced fare table per corridor) — internal tool, no app changes | Union pitch asset |
| 3 | First GPRTU local meeting; offer free fare-chart digitization | Relationship opened |
| 4 | Ship trust fixes (top-up confirmation, scan-to-pay gate, fare age) — needs owner approval per protected-areas rule | Trust baseline |
| 5 | Publish 20 SEO fare pages (top corridors) on troski.me | Acquisition channel |
| 6 | Corridor density sprint: Circle–Madina — seeded reporters + GO Mode push notification campaign | H2/H5 evidence |
| 7 | Read GIZ MaaS study `[fact]` (PDF above); contact author org re: private-layer positioning | Donor channel |
| 8 | Instrument: contributor retention, fare-report freshness, ad click-through | H1/H6 metrics |
| 9 | Draft one-page EV pilot concept (Joylong/Higer + PAYD + duty waiver + union route) — document only | OEM outreach asset |
| 10 | Baseline traction narrative: publish first public numbers (routes covered, reports, corridors fresh) | Press/credibility |

## 27. 12-month roadmap

- **Q1 (days 0–90)**: above.
- **Q2**: GPRTU local pilot live (queue tool with bookman + fare dashboard); measure; iterate. Ads sales motion for events surface. WhatsApp fare-bot experiment.
- **Q3**: branch-level MoU attempt on pilot evidence; union-branded cashless *ticketing pilot* on one route (wallet exists `[code]`); Kumasi groundwork (donor-aligned). Watch Trostar/TrotroWays moves.
- **Q4**: EV pilot brokering — OEM + financier + union local + MMDA/ECG depot conversation, on 9 months of corridor data; decide Kumasi launch; first data-licensing deal (donor/researcher, aggregates).
- **Continuous**: fare table maintained through every GRTCC announcement (the wedge is a weekly discipline, not a feature) `[inf]`.

## 28. Risks and assumptions

| Risk | Severity | Mitigation |
|---|---|---|
| GPRTU politics — competing factions, fare transparency read as anti-driver `[fact]` (contradictory announcements documented) | High | Local-first entry, driver-protective framing, union-branded pilots |
| Data freshness flywheel fails (H6) `[hyp]` | High | Measure retention now; seeded reporters as bridge; kill-criteria per §29 |
| Competitor locks union first (Trostar/TrotroWays/Hubtel) `[inf]` | High | Speed on §17; the 90-day plan front-loads it |
| Solo-founder bandwidth `[inf]` | High | One B2B motion at a time (union first, EV is documents-only until Q4) |
| Payments regulatory drift (BoG perimeter, e-VAT platform rules 2026) `[fact]` | Medium | Stay in Paystack perimeter; tax advisor engagement before ticketing scale |
| EV timing — economics 3–5 yrs out `[inf]`; duty waiver expires 2032 `[fact]` | Medium | Broker-not-operator stance caps downside |
| Traction claims arms race (TrotroWays' 50k/day) `[fact-NV]` | Low | Publish verified numbers; honesty as brand |
| Key assumptions: riders change behavior on fare info `[hyp — H1]`; mates/drivers tolerate digital tickets `[hyp — H3]`; bookmen cooperate for queue data `[hyp — H5]` | — | §29 experiments |

## 29. Recommended next experiments

1. **H1 fare-behavior test**: corridor with fresh fares vs control — does usage/retention differ? (analytics only)
2. **H6 contributor retention**: cohort analysis of reporters vs non-reporters — is the rewards loop paying for itself?
3. **H5 bookman pilot**: one terminal, one bookman, paper→app queue ledger for 2 weeks — does he keep using it?
4. **H2 GO density**: push campaign on one corridor — concurrent GO trips at peak; define the "useful" threshold empirically.
5. **H3 ticket acceptance**: 10 drivers on one route accept QR tickets for a week (union local blessing) — measure friction.
6. **WhatsApp bot smoke test**: fare-lookup bot, measure query volume vs app (no build until demand signal).
7. **Ads willingness-to-pay**: 5 event promoters/cinemas — what do they pay for a sponsored slot? (events surface is live `[code]`)
8. **EV pilot letter-of-intent test**: one-pager to Joylong/Higer distributors + 2 DFIs — does anyone reply? (zero build)

---
*Verification note: all `[fact]` URLs retrieved 2026-07-07 via live web research (4 research passes, ~55 searches/fetches). `[fact-NV]` items need one more source or primary confirmation before external use. `[code]` items cite this repo and were current at analysis date.*
