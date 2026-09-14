COMPLETED TOURNAMENT PROPAGATION REPORT

TOURNAMENT: karthik 2026 (TRN000002)

TOURNAMENT STATUS BEFORE: PUBLISHED

CATEGORY STATUS BEFORE: No separate lifecycle status column; registrationPhase=CLOSED.

FIXTURE STATUS BEFORE: PUBLISHED, KNOCKOUT, exactly one match.

FINAL MATCH STATUS: COMPLETED, score 21–3, completedAt=2026-09-10T10:45:54.238Z.

RESULT EXISTS: NO before repair; YES after repair.

MEDAL HISTORY BEFORE: No records for this tournament. Historical medals were not modified during the scoped repair.

WINNER: Karthik (PLR000001)

RUNNER-UP: sudha (PLR000002)

ROOT CAUSE: The old match completion saved the match winner but did not create its results row. Fixtures & Results could display the match-derived winner, while the player list depended on the empty results collection. Tournament reads did not expose completion summaries, and retrying completion returned immediately for an already completed match without repairing its missing result.

BACKEND LIFECYCLE FIX: PASS

A shared final-match query requires a published knockout fixture, all matches completed, a unique highest-round terminal match, two participants, and a winner consistent with the non-tied score. Result summaries must match that verified final. Early rounds, pending siblings, ambiguous top rounds, draft fixtures and mismatched results cannot mark completion.

The existing PUBLISHED workflow/visibility status remains unchanged. A separate derived completionStatus is returned for categories and tournaments, together with camelCase result summaries. No new lifecycle database columns are required. All categories must complete before the tournament completionStatus becomes COMPLETED. For a single-category completed tournament, its result is also returned at tournament level.

Manual completion persists the result within its existing transaction. An authenticated retry of an already completed final can repair a missing result idempotently. Existing scoring bounds, manual-only completion and result/medal generation remain in place.

FINAL MATCH -> CATEGORY COMPLETED: PASS

CATEGORY -> TOURNAMENT COMPLETED: PASS

PLAYER LIST API COMPLETED STATUS: PASS — completionStatus=COMPLETED

PLAYER LIST API WINNER: PASS — Karthik

PLAYER LIST API RUNNER-UP: PASS — sudha

NO N+1: PASS — seven bulk SQL queries for lists containing either one or fifty completed tournaments. The updated frontend consumes embedded summaries directly; the previous bulk-result fallback remains available for older API responses.

PLAYER CARD COMPLETED BADGE: PASS

PLAYER CARD WINNER: PASS

PLAYER CARD RUNNER-UP: PASS

OPEN FILTER: PASS — karthik 2026 excluded

REGISTRATION CLOSED FILTER: PASS — karthik 2026 excluded

COMPLETED FILTER: PASS — karthik 2026 included

ALL FILTER: PASS — karthik 2026 included with results

CURRENT karthik 2026 REPAIRED: PASS

Only the missing result summary was inserted, using the existing final's participant IDs, winner ID and original completion timestamp. All match columns were compared before and after and remained identical, including the 21–3 score. No winners, scores, historical medals or notifications were changed. Parent completion is derived by the API rather than overwriting publication/registration status fields.

AUTOMATIC REFRESH: PASS — initial fetch, focus/visibility refresh and a ten-second refresh for visible pages. Selected filters survive refresh; no hard browser reload is needed.

VALIDATION:

- Real current data tested in local Chrome through Vite at http://localhost:5173 with the local backend at http://localhost:8787.
- Real PostgreSQL temporary-table tests passed for early rounds, unfinished matches, unique final, single-match completion, mismatched results, multiple categories and doubles/guest names.
- Match, tournament and completion unit tests: 13/13 passed.
- Full backend node suite: 32/35 passed. The same three unchanged OTP tests still fail: production fixed-OTP behavior, expired OTP handling and consumed/attempt-limit handling. Authentication code was not modified.
- Frontend result/filter regression tests passed, including embedded summaries without a separate result cache and rejection of stale cached results when the backend says IN_PROGRESS.

FILES CHANGED FOR THIS TASK:

Frontend:
- src/features/tournaments/types/tournament.types.ts
- src/features/player/components/TournamentCardResults.tsx
- src/features/player/pages/PlayerTournamentListPage.tsx
- tests/tournament-card-results.test.tsx
- COMPLETED_TOURNAMENT_PROPAGATION_REPORT.md

Backend:
- src/repositories/completion.repository.js
- src/repositories/match.repository.js
- src/repositories/result.repository.js
- src/services/match.service.js
- src/services/tournament.service.js
- test/completion.database.test.mjs
- test/completion.node.test.mjs
- test/match.node.test.mjs

DB SCHEMA CHANGE: NO for this task.

BUILD: PASS — npm run build

BACKEND HEALTH: PASS — GET /health

DB HEALTH: PASS — GET /api/db-health

PRODUCTION DEPLOY: NOT PERFORMED

This task's changes are local and have not been committed or pushed. Earlier unrelated working-tree changes were preserved.

COMPLETED TOURNAMENT WINNER/RUNNER-UP PROPAGATION: COMPLETE
