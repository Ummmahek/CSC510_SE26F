# D4 — Traceability + verdict on the project's own tests

## Our tests ↔ use cases

Every UC needs at least one test (marker's fast check). Gaps must be
explained, not hidden.

| Test | Use case(s) | What it proves |
|---|---|---|
| `test_rejects_redeeming_more_points_than_available` | UC6 | Balance check refuses over-redemption (ext 3a) |
| `test_concurrent_redemptions_cannot_double_spend` | UC6 | Redemption is NOT safe under concurrency (ext 5a) |
| `proj2/tests/uc14-manage-menu.test.js` (7 tests) | UC14 | Main flow + all documented extensions; disproves the doc's "silent creation" claim (real bug: PUT /profile 500s unconditionally); new finding: GET /profile is a dead stub |
| `proj2/tests/uc20-donation-impact.test.js` (8 tests) | UC20 | Main flow + guard; confirms unauthenticated counter inflation (star finding); new: POST /record, GET /history covered |
| `proj2/tests/uc10-redeem-points.test.js` (8 tests) | UC10 | Main flow + all documented guards; confirms concurrent double-spend (star finding, see results table for exact behavior vs. prediction); new: POST /calculate-discount covered |
| `proj2/tests/uc15-claim-delivery.test.js` (9 tests) | UC15 | Main flow + all documented extensions; confirms claim race (both requests get 200, not one-409); new finding: POST /reject has no ownership check either |
| `proj2/tests/uc16-pickup-deliver.test.js` (9 tests) | UC16 | Main flow extensions + headline finding: wrong-partner delivery theft, fully reproduced with before/after earnings; new finding: `User.updateDeliveryStatus` undefined crashes the common case |

### Orphans — use cases with no test (explain each)

- *(example)* UC-voice-ordering: no test — requires a Gemini API key we do
  not have; gap acknowledged.

### Orphans — tests mapped to no use case

- *(should be empty; if a test lands here, say what it is for or delete it)*

## Verdict on the project's own tests (evidence collected 2026-08-28)

Inventory — test artifacts exist in three places; **zero are runnable**:

1. `proj2/tests/example.test.js` — 151 tests over 28 business-logic
   functions. Cannot run: it imports `../src/utils/businessLogic` (line 30).
   **Correction from an earlier pass of this section:** the file was not
   "never committed" — `git log --all --name-status -- proj2/src/utils/businessLogic.js`
   shows it was added (`a5bc8eb`), modified (`f75213b`), then **deleted**
   (`88bedaf`, "feat: add more missions, define more flexible structure for
   adding badges", author `seojinseojin`) — all three commits predate our
   fork, so this is an inherited regression in the *prior* project's own
   history, not something introduced by our team. The badges/missions
   refactor deleted a file an unrelated test suite depended on and nobody
   caught it, which is itself worth a line in the report: it's a live
   example of "old code rots" from the assignment brief, not a hedge.
2. `proj2/client/src/App.test.tsx` — untouched CRA boilerplate ("renders
   learn react link"). Fails before the assertion: App.tsx line 2 import
   (react-router-dom v7 ESM) cannot be resolved by CRA 5's Jest.
3. `proj2/server/` — jest + supertest installed as devDependencies; zero
   test files exist ("0 matches").

CI forensics — `.github/workflows/ci.yml:38` sets `continue-on-error: true`
on the test step (the lint step above it is `false`), so the green "Build
Passing" badge is configured to ignore test failures. A Codecov token is
also committed in plaintext at line 44.

TODO: map the 151 test *names* (readable even though unrunnable) onto our 20
use cases to show what coverage was intended vs. what was blind (e.g.
delivery-partner flows, all HTTP routes — supertest installed, never used).
