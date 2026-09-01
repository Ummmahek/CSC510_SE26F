# D4 — Traceability + verdict on the project's own tests

## Our tests ↔ use cases

Every UC needs at least one test (marker's fast check). Gaps must be
explained, not hidden.

Rows are ordered by use-case number so coverage gaps are visible at a glance.
(Who wrote which suite is tracked by git history, not by table order.)

| Test | Use case(s) | What it proves |
|---|---|---|
| `proj2/tests/uc8-rate-order.test.js` (11 tests) | UC8 | All five documented guards hold; rating is immutable once set; no stored average exists (derived at read time) |
| `proj2/tests/uc10-redeem-points.test.js` (9 tests) | UC10 | Main flow + all documented guards; confirms concurrent double-spend (star finding, see results table for exact behavior vs. prediction); new: POST /calculate-discount covered |
| `proj2/tests/uc11-voice-control.test.js` (9 tests) | UC11 | All guards hold with Gemini mocked; upstream errors pass through; the headline gap (no ordering action) pinned by an intentional red test |
| `proj2/tests/uc13-sales-insights.test.js` (4 tests) | UC13 | Server returns exactly the restaurant's raw orders with the fields the browser aggregation needs; no server-side aggregation/pagination exists |
| `proj2/tests/uc14-manage-menu.test.js` (8 tests) | UC14 | Main flow + all documented extensions; disproves the doc's "silent creation" claim (real bug: PUT /profile 500s unconditionally); new finding: GET /profile is a dead stub |
| `proj2/tests/uc15-claim-delivery.test.js` (9 tests) | UC15 | Main flow + all documented extensions; confirms claim race (both requests get 200, not one-409); new finding: POST /reject has no ownership check either |
| `proj2/tests/uc16-pickup-deliver.test.js` (10 tests) | UC16 | Main flow extensions + headline finding: wrong-partner delivery theft, fully reproduced with before/after earnings; new finding: `User.updateDeliveryStatus` undefined crashes the common case |
| `proj2/tests/uc17-delivery-map.test.js` (6 tests) | UC17 | The customer-facing "tracking" map is a hardcoded 20-step/1s-tick simulation with no real position source (source-inspection; client runner broken as inherited) |
| `proj2/tests/uc18-delivery-earnings.test.js` (5 tests) | UC18 | Displayed earnings are computed per-order; the server's totalEarnings ledger is write-only and can diverge silently |
| `proj2/tests/uc20-donation-impact.test.js` (8 tests) | UC20 | Main flow + guard; confirms unauthenticated counter inflation (star finding); new: POST /record, GET /history covered |

### Orphans — use cases with no test (explain each)

- UC1–UC7, UC9, UC12, UC19: not yet written — assigned to the other two
  members per the team split; must be closed (or explained) before submission.
- (The earlier "voice ordering needs a Gemini key" gap is resolved: UC11 is
  now tested with the Gemini HTTP call mocked.)

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
