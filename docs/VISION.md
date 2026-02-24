# Troski — Vision & Roadmap

## The Opportunity

Ghana's trotro system is the backbone of urban transport — millions of daily commuters with no digital infrastructure. No real-time information, no fare transparency, no route planning. **Whoever digitizes this first wins the market.**

Troski is not just a transit app. It's the foundation for a full mobility platform.

---

## Phase 1 — Community-Powered Transit Intelligence (Current)

**Goal:** Become the app every trotro rider in Accra opens before they commute.

**What we've built:**
- Crowdsourced fare reports with real-time averages
- Station queue status (empty → packed)
- Route search and planning with transfer hubs
- 2,386 transport stops mapped from OpenStreetMap (trotro, bus, train, taxi)
- 566 route corridors visualized on the map
- Train system integration (Tema-Accra commuter line)
- Gamification engine (points, streaks, levels, badges, leaderboard)
- Trotro Tales (photo sharing for community engagement)
- Offline-first architecture with report queueing
- Push notifications for fare drops and queue alerts

**Revenue:** None yet. Focus is user acquisition and data collection.

---

## Phase 2 — Payments & Digital Fares

**Goal:** Process trotro fare payments through the app.

**Key moves:**
- Mobile Money integration (MTN MoMo, Vodafone Cash, AirtelTigo Money)
- QR code or NFC-based fare payment at stations
- Driver/mate companion app for receiving payments
- Transaction fee revenue model (1-2% per fare)
- Digital fare receipts for riders
- Fare splitting for group rides

**Data unlocked:**
- Exact ridership numbers per route and time
- Revenue per route (informs fleet deployment)
- Payment velocity and spending patterns
- Daily/weekly/monthly commuter behavior

**Scalability reference:** *Designing Data-Intensive Applications, 2nd Edition* — Chapter 1 (Reliability, Scalability, Maintainability) and Chapter 5 (Replication) become critical here. Payment systems need:
- Exactly-once processing guarantees
- Multi-region replication for low latency
- Event sourcing for audit trails
- Idempotent transaction handlers

---

## Phase 3 — Electric Trotro Fleet

**Goal:** Deploy our own fleet of electric trotro vans/buses on the highest-demand routes.

**Why electric:**
- Fuel costs are a major expense for trotro operators in Ghana
- Electric vehicles have dramatically lower per-km operating costs
- Ghana's electricity grid is more stable than fuel supply chains
- Environmental and PR advantage
- Government incentives for green transport

**Data advantage:**
By Phase 3, we'll have years of:
- Route demand patterns (which routes, what times, how many riders)
- Queue length data (where supply falls short)
- Fare elasticity (what riders will pay)
- Transfer hub analysis (optimal fleet positioning)

This means we don't guess where to deploy vehicles — **the data tells us exactly.**

**Fleet operations:**
- GPS-tracked vehicles with live ETA
- Scheduled departures (vs. the current "fill and go" model)
- Dynamic pricing based on demand
- Driver performance monitoring
- Vehicle maintenance scheduling from telemetry

**Scalability reference:** *DDIA 2nd Ed* — Chapter 3 (Storage and Retrieval) for time-series telemetry data, Chapter 11 (Stream Processing) for real-time vehicle tracking, Chapter 12 (The Future of Data Systems) for combining batch and stream processing.

---

## Phase 4 — Data Platform & Ecosystem

**Goal:** Leverage accumulated transport data for adjacent ventures.

**Opportunities:**

### Logistics & Delivery
- Same-day package delivery using trotro network knowledge
- Last-mile delivery optimization using route corridor data
- Partnership with e-commerce platforms (Jumia, Tonaton)

### Urban Planning Partnerships
- Sell anonymized transport data to city planners
- Traffic pattern analysis for infrastructure projects
- Public transport optimization consulting for government

### Insurance Products
- Micro-insurance for trotro riders (per-trip coverage)
- Driver insurance based on actual driving data
- Health insurance bundled with commute subscriptions

### Advertising Platform
- Location-based ads at station proximity
- Route-specific advertising (businesses along corridors)
- Commuter audience targeting for brands

### Financial Services
- Micro-loans for trotro operators (vehicle financing)
- Savings products for daily commuters
- Revenue-based financing using transaction data

**Scalability reference:** *DDIA 2nd Ed* — Chapter 10 (Batch Processing) for large-scale data analysis, Chapter 6 (Partitioning) for multi-tenant data serving, Chapter 9 (Consistency and Consensus) for distributed financial transactions.

---

## Expansion Strategy

### City-by-city in Ghana
1. **Accra/Tema** (current) — 4M+ metro population
2. **Kumasi** — 2nd largest city, major trotro network
3. **Takoradi/Cape Coast** — Western corridor
4. **Tamale** — Northern Ghana hub

### West Africa
- **Lagos, Nigeria** — Danfo/BRT system, 20M+ population
- **Abidjan, Cote d'Ivoire** — Gbaka minibus system
- **Dakar, Senegal** — Car rapide system

The architecture is designed to be multi-city from day one — each city is a separate dataset with shared infrastructure.

---

## Scalability Principles (from DDIA)

As the platform grows, these principles from *Designing Data-Intensive Applications* guide our technical decisions:

| Principle | Application |
|-----------|-------------|
| **Reliability** | Offline-first design, queue-based report submission, idempotent operations |
| **Scalability** | Read-heavy workload (many readers, few writers), horizontal scaling via Supabase/Postgres partitioning |
| **Maintainability** | TypeScript everywhere, clear service boundaries, React Query for cache management |
| **Event Sourcing** | All reports are append-only events; derived views (fare stats, queue stats) are materialized from events |
| **CQRS** | Separate write path (report submission) from read path (stats views, leaderboard) |
| **Partitioning** | Data naturally partitions by city/region — each expansion is an independent partition |
| **Stream Processing** | Real-time subscriptions (Supabase Realtime) for live queue updates and fare changes |
| **Batch Processing** | Periodic aggregation for leaderboards, statistics, and data exports |

---

## Key Metrics to Track

| Metric | Phase 1 Target | Phase 2 Target |
|--------|---------------|----------------|
| Monthly Active Users | 10,000 | 100,000 |
| Daily Reports Submitted | 500 | 5,000 |
| Routes Covered | 100+ | 500+ |
| Cities | 1 (Accra) | 3 |
| Fare Transactions/Day | — | 10,000 |
| Fleet Vehicles | — | — |

---

## Competitive Moat

1. **Network effects** — More users = more reports = better data = more users
2. **Data advantage** — Years of route demand data that competitors can't replicate
3. **Community** — Gamification creates loyal contributors, not just consumers
4. **Local knowledge** — Built by people who ride trotro, for people who ride trotro
5. **Offline-first** — Works in areas with poor connectivity (critical for Ghana)

---

*"The best time to digitize Ghana's transport was 10 years ago. The second best time is now."*
