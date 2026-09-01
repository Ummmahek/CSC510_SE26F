# D4 — Traceability + verdict on the project's own tests

## Our tests ↔ use cases

Every UC needs at least one test (marker's fast check). Gaps must be
explained, not hidden.

Rows are ordered by use-case number so coverage gaps are visible at a glance.
(Who wrote which suite is tracked by git history, not by table order.)

| Test | Use case(s) | What it proves |
|---|---|---|
| `proj2/tests/uc1-signup-role.test.js` (8 tests) | UC1 | Happy path + both doc'd rejections; star finding: password persisted in plaintext (red `[DOC EXPECTATION]` pins the fix); geocode failure swallowed (201 with `location: null`); empty profile accepted |
| `proj1-26F/uc-usecases.test.js` (UC2 test) | UC2 | Happy-path login verifies credentials and returns the user payload |
| `proj2/tests/uc3-manage-profile.test.js` (7 tests) | UC3 | Happy path + credential/role guards; star finding: address change keeps stale coordinates (red test pins the fix); one-field edit wipes the profile map; the four profile endpoints disagree on validation and authorization |
| `proj2/tests/uc4-browse-restaurants.test.js` (6 tests + 1 documented non-automated finding) | UC4 | Happy paths for list and distance sort; rating derived at read time confirmed; nameless restaurants silently omitted; undocumented missing-userId guard; latent post-response crash at `customer.js:155` documented |
| `proj2/client/src/contexts/uc5-build-cart.test.tsx` (7 tests, CRA/jsdom runner) | UC5 | Cart quantity/total logic correct; star finding: cart is `useState` only and dies on remount (red test pins persistence); no multi-restaurant guard |
| `proj1-26F/uc-usecases.test.js` (UC6 test) | UC6 | Asserts the documented negative-total rejection — red on the real bug: 201 with an order created (presence-only validation) |
| `proj2/tests/uc7-track-order.test.js` (8 tests) | UC7 | List happy path + scoping + guards; star finding: `confirmedAt` stamped on the wrong transition; GET /:id is a hardcoded stub (red test pins the fix); transitions unvalidated |
| `proj2/tests/uc8-rate-order.test.js` (11 tests) | UC8 | All five documented guards hold; rating is immutable once set; no stored average exists (derived at read time) |
| `proj1-26F/uc-usecases.test.js` (UC9 test) | UC9 | `awardPointsForOrder` (called directly, as the deliver route does) writes an earned transaction and updated totals to the points ledger; the full delivery trigger is exercised by UC16's suite (the earn-rate-vs-README finding remains non-automated — see results table) |
| `proj2/tests/uc10-redeem-points.test.js` (9 tests) | UC10 | Main flow + all documented guards; confirms concurrent double-spend (star finding, see results table for exact behavior vs. prediction); new: POST /calculate-discount covered |
| `proj2/tests/uc11-voice-control.test.js` (9 tests) | UC11 | All guards hold with Gemini mocked; upstream errors pass through; the headline gap (no ordering action) pinned by an intentional red test |
| `proj1-26F/uc-usecases.test.js` (UC12 test) | UC12 | Asserts the documented kitchen workflow — red on the real bug: `pending → delivered` accepted with no transition guard (corroborates UC7's finding) |
| `proj2/tests/uc13-sales-insights.test.js` (4 tests) | UC13 | Server returns exactly the restaurant's raw orders with the fields the browser aggregation needs; no server-side aggregation/pagination exists |
| `proj2/tests/uc14-manage-menu.test.js` (8 tests) | UC14 | Main flow + all documented extensions; disproves the doc's "silent creation" claim (real bug: PUT /profile 500s unconditionally); new finding: GET /profile is a dead stub |
| `proj2/tests/uc15-claim-delivery.test.js` (9 tests) | UC15 | Main flow + all documented extensions; confirms claim race (both requests get 200, not one-409); new finding: POST /reject has no ownership check either |
| `proj2/tests/uc16-pickup-deliver.test.js` (10 tests) | UC16 | Main flow extensions + headline finding: wrong-partner delivery theft, fully reproduced with before/after earnings; new finding: `User.updateDeliveryStatus` undefined crashes the common case |
| `proj2/tests/uc17-delivery-map.test.js` (6 tests) | UC17 | The customer-facing "tracking" map is a hardcoded 20-step/1s-tick simulation with no real position source (source-inspection: the component depends on the Google Maps SDK and the inherited `App.test.tsx` breakage blocks router-dependent rendering, so the finding is asserted on source) |
| `proj2/tests/uc18-delivery-earnings.test.js` (5 tests) | UC18 | Displayed earnings are computed per-order; the server's totalEarnings ledger is write-only and can diverge silently |
| `proj1-26F/uc-usecases.test.js` (UC19 test) | UC19 | Badge evaluation returns computed badge data for a customer with stored stats |
| `proj2/tests/uc20-donation-impact.test.js` (8 tests) | UC20 | Main flow + guard; confirms unauthenticated counter inflation (star finding); new: POST /record, GET /history covered |

### Orphans — use cases with no test (explain each)

- **None — all 20 use cases have at least one test.** Documented findings that
  remain non-automated: UC9 earn-rate vs README (results-table row), UC4's
  post-response crash at `customer.js:155` (results-table row), and UC10
  ext 5b/6a — points deducted before order creation with no rollback, and one
  discount applied to every per-restaurant order (`usecases.md` UC10; client
  Cart.tsx logic, discussed in `uc10-redeem-points.test.js:181-192`).

### Orphans — tests mapped to no use case

- None — every test names the use case (and extension) it exercises.

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

### Do the inherited tests cover UC1, UC3, UC4, UC5, UC7? Where are they blind?

The suite is unrunnable, but its test *names* are readable, so intent can
still be judged:

| UC | Nearest own-test coverage (by name) | Blind to |
|---|---|---|
| **UC1** | `isValidUserRole`, `getDefaultDeliveryStatus`, `validateEmail`, `validatePhoneNumber` — standalone validators | The `/register` route itself: duplicate-email rejection, password storage, geocoding, the response shape |
| **UC3** | `validateEmail`, `validatePhoneNumber` only | All four profile endpoints, address re-geocoding, the whole-map overwrite, the contract divergence between endpoints |
| **UC4** | `isLocalLegend`, `calculateDeliveryTime`, `calculateDeliveryFee` — restaurant-attribute helpers | `GET /restaurants` and `/restaurants-by-distance`: the rating aggregation, the Haversine sort, the `profile.name` filter, the `restaurants[1]` crash |
| **UC5** | `calculateOrderTotal`, `isValidOrder` — cart-total / line-item math on a hypothetical helper | `CartContext` itself: quantity merging, persistence, cross-restaurant carts — none of the actual React state logic |
| **UC7** | `isValidStatusTransition` (~20 tests) — asserts a full order state machine | `orders.js` has **no such state machine**; the own suite tests transition rules the shipped code never implements. Also blind to `GET /customer`, the mock `GET /:id`, and the `confirmedAt` mislabel |

**Overall:** the project's own tests aim exclusively at pure helper functions
in a `businessLogic` module that (a) does not ship and (b) sits a layer
*below* every real entry point. Not one of them drives an Express route or a
React context. Our tests reach each UC through its actual interface (an HTTP
route, or the `useCart` hook). `isValidStatusTransition` is the sharpest
illustration of the blindness: ~20 passing-by-name tests encode an order
state machine that `orders.js` simply does not have — which is exactly how
UC7's "jump straight to delivered" defect survived.

TODO: extend the name-mapping above to the remaining 15 UCs (e.g.
`calculatePointsForOrder(100) === 10` encodes the README's 10% rate — the
UC9 docs/code conflict — and `calculateTax`/`isValidDiscountCode` specify
features that were never built).
