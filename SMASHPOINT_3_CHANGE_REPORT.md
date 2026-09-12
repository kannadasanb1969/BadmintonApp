SMASHPOINT 3 CHANGE REPORT

Validation scope: frontend rendering/optimistic-queue tests, backend route tests, real PostgreSQL service checks using connection-local temporary tables, source audit, and local health requests. Interactive browser clicks and cross-browser live polling were not exercised.

1. FIXTURE CLOSE REGISTRATION BUTTON: REMOVED

CLOSE REGISTRATION AVAILABLE FROM CORRECT PAGE: PASS

The fixture page retains registration phase, registration entries and fixture-generation validation. Tournament Registration management now executes the close mutation with confirmation instead of navigating to the fixture page. The Tournament Detail category card also retains the close action added during the earlier request.

2. OPEN REGISTRATION DEFAULT: UNCHECKED

NEWEST TOURNAMENT FIRST: PASS (render tests, including repeated initial render)

SORT FIELD: createdAt DESC. Backend already uses created_at DESC. Frontend sorts the filtered copy, handles invalid/missing timestamps, and preserves the store array. Empty results keep the filter controls accessible.

3. WINNING POINTS:

| Check | Result |
| --- | --- |
| 15 | PASS |
| 21 | PASS |
| 30 | PASS |
| FORCED DEFAULT 21 | REMOVED for new matches; existing persisted values retained |
| START REQUIRES WINNING POINT | PASS |
| MAX SCORE ENFORCED FRONTEND | PASS, including rapid queued clicks |
| MAX SCORE ENFORCED BACKEND | PASS, including real PostgreSQL checks |
| AUTO COMPLETE AT WINNING POINT | REMOVED |
| STATUS AT WINNING POINT | LIVE |
| MANUAL COMPLETE | PASS |
| TIE COMPLETE BLOCKED | PASS |
| WINNER GENERATION | PASS, higher score wins |
| RESULT GENERATION | PASS for terminal knockout match; existing separate result-generation endpoint retained |
| DECREMENT | PASS, minimum zero |
| PLAYER READ ONLY | PASS, source audit and read endpoint tests |
| LIVE SCORE SYNC | Existing two-second polling preserved; API reads verified LIVE/COMPLETED; interactive browser synchronization not exercised |

FRONTEND FILES CHANGED:

- src/features/fixtures/store/fixtureStore.ts
- src/features/matches/hooks/useOptimisticMatchScore.ts
- src/features/organizer/pages/CategoryFixturePage.tsx
- src/features/organizer/pages/MatchScoringPage.tsx
- src/features/organizer/pages/TournamentDetailPage.tsx
- src/features/organizer/pages/TournamentRegistrationsPage.tsx
- src/features/player/pages/PlayerTournamentListPage.tsx
- src/features/tournaments/services/tournamentService.ts
- tests/smashpoint-requirements.mjs
- tests/smashpoint-requirements.test.tsx
- SMASHPOINT_3_CHANGE_REPORT.md

BACKEND FILES CHANGED:

- src/index.js
- src/repositories/fixture.repository.js
- src/repositories/match.repository.js
- src/services/match.service.js
- src/services/result.service.js
- migrations/20260912_optional_winning_points.sql
- test/match.node.test.mjs

DATABASE SCHEMA CHANGE: YES. Existing matches.winning_points had NOT NULL DEFAULT 21, preventing an unselected new match. The migration removes NOT NULL and the default, without adding a field or changing existing values. The user applied this migration to the confirmed development/test database using the table-owner account. Column nullability and absent default were independently verified afterward.

FRONTEND BUILD: PASS — npm run build

FRONTEND REQUIREMENT TESTS: PASS — node tests/smashpoint-requirements.mjs

BACKEND MATCH TESTS: PASS — 7/7, node --test test/match.node.test.mjs

BACKEND FULL NODE SUITE: 30/33 PASS. Three tests in the unchanged auth.node.test.mjs fail: production disables fixed OTP and verification; expired OTP commits expiry state and cannot create a user; consumed OTP and attempt limit reject reuse. Authentication implementation was not modified.

REAL POSTGRESQL CHECKS: PASS — start selection, persisted limits, 15/21/30 ceilings, LIVE at the ceiling, decrement, manual completion, ties, final result/medal SQL. Tests used temporary tables, without changing tournament records.

REGRESSION SCOPE: Existing player, guest-player, eligibility and tournament node tests passed. Singles/doubles registration logic, fixture generation/publishing, bearer authentication and player polling were audited for preservation. Full browser registration-to-results journeys were not run.

BACKEND HEALTH: PASS — GET http://localhost:8787/health

DB HEALTH: PASS — GET http://localhost:8787/api/db-health

PRODUCTION DEPLOY: NOT PERFORMED

PUSH: NOT PERFORMED. Earlier automatic review rejected the push because the GitHub destination lacked explicit authorization; no retry was made.

BLOCKERS: No implementation or development migration blocker remains. Three unchanged OTP regression tests fail. Browser end-to-end validation remains unverified. GitHub push remains pending explicit destination approval.

Pre-existing unrelated frontend .gitignore/.env.local and backend .DS_Store/package.json/src/utils/cors.js changes were left untouched.

SMASHPOINT REGISTRATION + TOURNAMENT SORT + MANUAL MATCH COMPLETION: COMPLETE
