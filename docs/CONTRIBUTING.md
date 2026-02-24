# Contributing to Troski

Thank you for your interest in contributing to Troski! This app is built to improve daily transit for millions of Ghanaians who rely on the trotro system. Every contribution makes a real difference.

---

## Getting Started

### Prerequisites

- **Node.js** >= 20 (we use 25.x in production)
- **npm** (comes with Node)
- **Expo Go** app on your phone — [Android](https://play.google.com/store/apps/details?id=host.exp.exponent) | [iOS](https://apps.apple.com/app/expo-go/id982107779)
- **Git**

### Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/trotromate-native.git
cd trotromate-native

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
```

**Environment variables:** You'll need Supabase credentials to connect to the backend. Ask a maintainer for development credentials, or set up your own Supabase project using the migrations in `lib/supabase/migrations/`.

```bash
# 4. Start the dev server
npx expo start
```

Scan the QR code with Expo Go on your phone. That's it — you're running Troski locally.

### Running on Emulator

```bash
# Android emulator
npx expo start --android

# iOS simulator (macOS only)
npx expo start --ios
```

---

## Project Overview

Read [ARCHITECTURE.md](ARCHITECTURE.md) for a comprehensive overview of the codebase. Here's the quick version:

```
app/           → Screens (file-based routing via Expo Router)
components/    → Reusable UI components
lib/services/  → Business logic & API calls
lib/hooks/     → Custom React hooks (data fetching)
lib/types/     → TypeScript type definitions
lib/utils/     → Utility functions
lib/supabase/  → Database client & migrations
assets/data/   → Bundled fallback data (OSM transport)
scripts/       → Data pipeline scripts
docs/          → Documentation
```

**Key patterns:**
- Each feature has a **service** (API logic), a **hook** (React Query wrapper), and a **screen** (UI)
- Styling uses **NativeWind** (Tailwind classes in React Native)
- State management: **React Query** for server state, **React Context** for global app state
- Maps use **Mapbox GL** via `@rnmapbox/maps`

---

## How to Contribute

### 1. Find an Issue

- Check the [Issues](https://github.com/ASamedWalker/trotromate-native/issues) page
- Look for `good first issue` or `help wanted` labels
- Comment on the issue to claim it before starting work

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming convention:
- `feature/` — new features
- `fix/` — bug fixes
- `refactor/` — code improvements
- `docs/` — documentation updates

### 3. Make Your Changes

- Follow the existing code patterns (see Architecture docs)
- Use TypeScript — no `any` types unless absolutely necessary
- Use NativeWind for styling (Tailwind classes)
- Keep components focused — one component per file
- Add types for new data structures in `lib/types/`

### 4. Test Your Changes

```bash
# Type check
npx tsc --noEmit

# Run on device/emulator and manually verify
npx expo start
```

### 5. Submit a Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a PR against `main` with:
- Clear title describing the change
- Description of what and why
- Screenshots/recordings for UI changes
- Note any migration changes needed

---

## Areas Where We Need Help

### Frontend (React Native / Expo)
- UI/UX improvements — animations, transitions, polish
- Accessibility — screen reader support, dynamic font sizes
- Performance — reduce re-renders, optimize list rendering
- New screens — driver companion app, advanced route planner

### Backend (Supabase / PostgreSQL)
- Database optimization — indexes, query performance
- New API endpoints — ride tracking, payment integration
- Data aggregation — better fare/queue statistics
- Push notification logic — smarter alert triggers

### Data & Maps
- Mapbox layer improvements — custom map styles, 3D terrain
- OSM data enrichment — more transport stops, okada stations
- Route geometry — improve route corridor accuracy
- Geocoding — better station location data

### Design
- App icon and branding refresh
- Onboarding flow redesign
- Dark mode refinements
- Component library documentation

### DevOps & Infrastructure
- CI/CD pipeline (GitHub Actions)
- Automated testing (Jest, Detox)
- Error monitoring (Sentry integration)
- Analytics setup

### Documentation
- API documentation
- Component storybook
- User guides
- Translation/localization (Twi, Ga, Ewe, Hausa)

---

## Code Style

- **TypeScript** everywhere — strict mode
- **NativeWind/Tailwind** for styling — avoid inline `StyleSheet.create` for new components
- **Functional components** with hooks — no class components
- **Named exports** for components and hooks
- **Default exports** only for screen files (Expo Router requirement)
- Keep files under 300 lines — split into smaller components/hooks if needed
- Use `@/` path alias for imports (e.g., `import { useApp } from '@/lib/contexts/AppContext'`)

---

## Database Changes

If your feature requires database changes:

1. Create a new migration file in `lib/supabase/migrations/`
2. Name it with the next sequential number: `019_your_migration.sql`
3. Include both the schema change AND any RLS policies
4. Document the migration in your PR description
5. A maintainer will apply it to the production Supabase instance

---

## Communication

- **GitHub Issues** — bug reports, feature requests, discussions
- **Pull Requests** — code review and feedback
- **Reddit** — community discussions (link TBD)

---

## License

This project is currently private with all rights reserved. Contributors agree that their contributions become part of the project under the same terms. We may open-source specific components in the future.

---

## Code of Conduct

- Be respectful and constructive
- Focus on the problem, not the person
- Welcome newcomers — everyone starts somewhere
- Remember: this app serves real people with real transit needs in Ghana

Thank you for helping build something meaningful.
