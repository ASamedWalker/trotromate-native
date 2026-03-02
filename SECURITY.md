# TrotroMate Native — Security Overview

## What's Protected

### Input Validation & Sanitization (`lib/security/validate.ts`)
All user input is validated and sanitized at the service layer before reaching Supabase:

- **Text sanitization** — strips script tags, event handlers, javascript: URIs, iframes
- **String length limits** — locations (200 chars), display names (100 chars), comments/captions (500 chars), notes (500 chars), vehicle numbers (20 chars)
- **Fare validation** — range 0.01–1000 GHS, rounded to 2 decimal places
- **Integer range checks** — passengers (0–200), vehicle count (0–500), delay minutes (0–300), estimated trip minutes (1–600)
- **Enum enforcement** — queue statuses, incident types, transport types, safety ratings, trip statuses, driver roles, train report types, directions, crowd levels, tale post types, safety categories
- **Phone validation** — Ghana format (+233XXXXXXXXX, 0XXXXXXXXX, 233XXXXXXXXX)
- **Device ID validation** — 32-char lowercase hex string

### Files With Validation Applied

| Service File | What's Validated |
|---|---|
| `reports.ts` | Locations, fare amount, queue status enum, incident type enum, vehicle count range |
| `safety.ts` | Locations, phone numbers, contact names, safety rating enum, trip status enum, category enum |
| `tales.ts` | Display name, caption, location, post type enum, image count (max 5), image size (max 10MB) |
| `comments.ts` | Display name, comment content |
| `driver.ts` | Display name, driver role enum, vehicle number, locations, passenger count, fare amount |
| `train.ts` | Report type enum, direction enum, crowd level enum, fare amount, delay minutes, notes |
| `routes.ts` | Locations, fare amount, transport type enum, sanitized search inputs |

### Trip Share Token Security
- Tokens strengthened from **8-char** (Math.random) to **32-char hex** using `crypto.getRandomValues()` when available
- Falls back to Math.random with 16 bytes (still 32-char) on older runtimes

### Image Upload Security (`tales.ts`)
- Max 5 images per submission
- Max 10 MB per image
- Filenames sanitized (only hex chars from device_id + timestamp)
- Failed uploads are filtered out (no placeholder URLs)
- Content type locked to `image/jpeg`

### Secure Storage
- **Device ID** stored in `expo-secure-store` on native platforms (hardware-backed keychain/keystore)
- Falls back to AsyncStorage only on web
- Supabase session tokens managed by Supabase SDK with secure storage

### .gitignore Protection
The following sensitive files are excluded from git:
- `.env` — Supabase keys and API URLs
- `google-services.json` — Google Play service account private key
- `*.key`, `*.p8`, `*.p12`, `*.pem`, `*.jks`, `*.mobileprovision` — signing certificates

---

## Known Limitations

### No User Authentication
The app uses device_id (32-char hex) for identification, not authenticated users. This is intentional for the growth phase.

1. **Device impersonation** — if someone obtains a device_id, they can act as that device
2. **Supabase anon key is public** — embedded in the app bundle via `EXPO_PUBLIC_*` env vars
3. **Open crowdsourced tables** — routes, fare_reports, queue_reports, incident_reports are intentionally readable/writable by anonymous users

### No Certificate Pinning
- The app relies on OS-level certificate validation
- No custom SSL pinning for Supabase or traffic API endpoints
- A compromised device could intercept HTTPS traffic

### No Client-Side Rate Limiting
- Rate limiting is only applied server-side (on the PWA API routes)
- The native app has no built-in request throttling
- Rapid submissions are blocked at the server, not prevented in the client

### Offline Queue Trusts Stored Data
- Reports queued in AsyncStorage are replayed as-is when connectivity returns
- Validation now happens at the service layer, so queued data is validated before submission
- AsyncStorage itself is not encrypted (standard Android/iOS app sandbox protection only)

---

## What Can and Cannot Be Accessed

| Data | Anonymous Access | Notes |
|------|-----------------|-------|
| Routes | Read + Write | Intentional — crowdsourced |
| Fare reports | Read + Insert | No delete allowed (server-side RLS) |
| Queue reports | Read + Insert | No delete allowed |
| Incident reports | Read + Insert | No delete allowed |
| Emergency contacts | Blocked | Service role only (server-side) |
| Push subscriptions | Blocked | Service role only |
| Trip shares (write) | Blocked | Service role only |
| Trip shares (read) | Public | Share links must work without auth |
| Tale posts | Read + Write | Scoped by device_id for delete |
| Tale comments | Read + Write | Scoped by device_id |
| Driver profiles | Read + Write | Scoped by device_id |

---

## Environment Variables

| Variable | Exposed to Client | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes (intentional) | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes (intentional) | Public anon key |
| `EXPO_PUBLIC_API_URL` | Yes (intentional) | PWA traffic API base URL |
| `MAPBOX_SECRET_TOKEN` | Build-time only | Mapbox SDK download token (not in app bundle) |

---

## Future: Authentication Phase

When adding real user authentication:

1. Integrate Supabase Auth (email/phone or social login)
2. Replace `USING (true)` RLS policies with `auth.uid()` checks
3. Add certificate pinning for Supabase endpoints
4. Add client-side rate limiting / debouncing
5. Encrypt AsyncStorage data (offline queue, favorites)
6. Link device_id to authenticated accounts

---

## Security Files Reference

| File | Purpose |
|---|---|
| `lib/security/validate.ts` | Input validation, sanitization, enum enforcement |
| `lib/services/reports.ts` | Fare, queue, incident report submission (validated) |
| `lib/services/safety.ts` | Trip sharing, emergency contacts, safety ratings (validated) |
| `lib/services/tales.ts` | Photo posts with image size/count limits (validated) |
| `lib/services/comments.ts` | Comment submission (validated) |
| `lib/services/driver.ts` | Driver registration and trip logging (validated) |
| `lib/services/train.ts` | Train report submission (validated) |
| `lib/services/routes.ts` | Route creation with sanitized search (validated) |
