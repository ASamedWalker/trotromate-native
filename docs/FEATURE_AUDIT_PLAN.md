# Trotromate Full-Feature Audit (goal, started 2026-07-11)

**Directive:** enumerate every feature → user story + expected behavior (from code) → single
canonical spreadsheet → test every story, document errors → fix logistical/UX errors → re-test.

## Canonical spreadsheet
`docs/FEATURE_TRACKER.csv` (16-col schema) is THE single source of truth. It already held 120
native features (last full pass 2026-07-04). This audit extends + refreshes it — no second sheet.

Schema (16 cols):
`ID, Area, Feature, UserStory, UserRole, Route, ExpectedBehavior, AcceptanceCriteria, EdgeCases, TestSteps, CurrentStatus, ErrorsFound, Severity, FixStatus, RetestStatus, Notes`

## Phases
1. **Enumerate + reconcile.** Keep existing 120 native rows; add gaps: recent native work
   (What's On/see-all/events), the entire Admin web surface, the WhatsApp bot + user-facing
   backend. New rows start `CurrentStatus=Not Tested`. Row-ID prefixes: existing native (A/W/R/…),
   native-gaps `NG*`, admin `ADM*`, whatsapp/api `WA*`.
2. **Test every user story.** Method = rigorous code-walk verification (trace each story through
   the actual code: states, API calls, edge/empty/error/offline paths), plus runtime where
   feasible (web/admin/backend via node; native via simulator if the run harness is available).
   Record `CurrentStatus` (Passed/Failed), `ErrorsFound`, `Severity`. Verification method noted.
3. **Fix** every logistical error + UX error found. Commit+push per fix (GitHub → Vercel/OTA).
   Record `FixStatus`.
4. **Re-test** every affected user story post-fix. Record `RetestStatus`.

## Honesty rule
Each row's Notes states the verification method ("code-walk" vs "runtime"). Nothing claimed
"Passed" without either a code trace or an actual run. Failures recorded verbatim.
