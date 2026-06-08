# Verification Protocol — Troski

This is the **self-verification gate** every change must pass before it is
considered done. It exists so that orchestrated agents (and humans) prove their
work end-to-end instead of *claiming* success. The rule that motivated it: a
`useMemo`-missing crash shipped twice (`TalesScreen`, then `ServiceModePills` +
`StopRoutesPanel`) because nothing forced a compile check.

## The three layers

| Layer | Command | Gate type | Owner |
|-------|---------|-----------|-------|
| 1. Typecheck | `npm run typecheck` | **HARD — blocks.** Must be `0 errors`. | Every agent, before returning |
| 2. Lint | `npm run lint` | **No-regression.** Must not exceed the baseline. | Every agent, on touched files |
| 3. E2E (Maestro) | `npm run e2e` | **HARD on touched flows.** App must launch + render. | Main loop / before merge |
| 4. Visual | boot sim, view screen | Human/main-agent eyeball. | Main loop, per screen |

### Layer 1 — Typecheck (hard gate)
```bash
npm run typecheck      # tsc --noEmit, must print 0 errors
```
Baseline as of setup: **0 errors (GREEN).** Any new error blocks the change.

### Layer 2 — Lint (no-regression gate)
```bash
npm run lint
```
Baseline as of setup: **70 errors / 78 warnings** — all pre-existing legacy debt,
out of scope to fix wholesale. Rule: **do not increase** the error count, and
leave every file you touch with **no new** lint errors. Auto-fix safe issues with
`npx expo lint --fix`.

### Layer 3 — End-to-end (Maestro)
```bash
npm run e2e            # runs every flow in .maestro/
```
- `smoke.yaml` — always-on. App launches and renders a real screen (auth **or**
  home) without crashing. This is the minimum bar for *any* change.
- `home_tabs.yaml` — conditional. When signed in, sweeps all five tabs and
  screenshots each. No-ops (passes) on the auth screen, so it is safe in any state.

Requires the app installed on a booted simulator (see below) and Java 17.

### Layer 4 — Visual confirmation
The main agent boots the iOS simulator, opens the changed screen, and confirms it
visually against the Uber Base tokens in `CLAUDE.md`. Subagents cannot do this —
it is the main loop's job before declaring a screen done.

## Environment (one-time, already installed)
- **Java 17**: `/opt/homebrew/opt/openjdk@17` (Maestro needs a JDK)
- **Maestro CLI 2.6.0**: `~/.maestro/bin/maestro` (the `e2e` script bakes in the
  `JAVA_HOME` + PATH so it runs from any shell)
- **iOS build**: `CI=1 npx expo run:ios --device "iPhone 15 Pro"` builds, installs,
  and launches the dev client. Bundle id: `com.troski.app`.

## For orchestrated workflow agents
Every implementation agent's definition of done:
1. `npm run typecheck` → 0 errors (paste the count in your result).
2. No new lint errors in files you touched.
3. If you changed a user-facing screen, ensure the relevant Maestro flow still
   passes (or add/extend one).
4. Return the actual command output — never assert "it works" without it.

A finding/change that has not cleared Layer 1 is **not** a result. Report failures
with their output rather than smoothing them over.
