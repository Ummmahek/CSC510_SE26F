# D4 — Traceability + verdict on the project's own tests

## Our tests ↔ use cases

Every UC needs at least one test (marker's fast check). Gaps must be
explained, not hidden.

One row per test — 120 tests plus UC4's one documented non-automated
finding — connecting each test to the use case (and extension) it exercises,
ordered by use case. Suite files: `proj2/tests/uc<N>-*.test.js`, except UC5
(`proj2/client/src/contexts/uc5-build-cart.test.tsx`, CRA/jsdom runner) and
UC2/6/9/12/19 (all in `proj1-26F/uc-usecases.test.js`). Who wrote which suite
is tracked by git history.

| Test | Use case (ext) | What it proves |
|---|---|---|
| UC1 main flow: valid registration | UC1 | Happy path — `/register` creates the account and returns a payload with no credential in it |
| UC1 main flow: registered user can log in | UC1 | Satisfies UC1's postcondition — the new account authenticates via `/login` |
| UC1 ext 3a: invalid email / short password / unknown role | UC1 (ext 3a) | The three documented input rejections all fire (`auth.js:9-11`) |
| UC1 ext 3b: duplicate email | UC1 (ext 3b) | Email dedup is enforced (`auth.js:23-26`) |
| UC1 finding: geocode failure swallowed on signup | UC1 (ext 2a) | An address that fails to geocode still yields 201 with `location: null` (`models/User.js:41-45`) — explains how UC4's distance sort can silently have nothing to sort by |
| UC1 finding: empty profile object accepted | UC1 (step 1) | "Fills the role-specific profile" is unvalidated — only `isObject()` (`auth.js:12`) |
| UC1 star finding: password stored in plaintext | UC1 (ext 4a) | Confirms ext 4a against the real store — the submitted password persists verbatim (`auth.js:31`) |
| UC1 `[DOC EXPECTATION]`: stored password must be hashed | UC1 (ext 4a) | Red assertion of the correct behaviour; stays red until `/register` hashes |
| allows a registered customer to log in with valid credentials | UC2 | Happy-path login verifies credentials and returns the user payload (`auth.js:47-82`) |
| UC3 main flow: edit a field, re-read it | UC3 | Happy path across `PUT` + `POST /api/customer/profile` |
| UC3 auth: wrong password / non-customer role | UC3 (preconditions) | Credential + role checks on the customer endpoint (`customer.js:25, 60`) |
| UC3 star finding: address change keeps stale coordinates | UC3 (ext 3a) | Confirms ext 3a — a geocode miss leaves the old `location`, so distance features go stale (`models/User.js:119-124`) |
| UC3 finding: one-field edit wipes the rest of the profile | UC3 (step 2) | `update({ profile })` replaces the whole map (`customer.js:66`) — editing one field loses the others |
| UC3 finding: phone type-check only on the customer route | UC3 (contracts note) | The four profile endpoints disagree — `profile.phone` is validated on `/customer`, not on `/auth` |
| UC3 finding: role check only on the customer route | UC3 (contracts note) | Same operation, two endpoints disagree on authorization (`auth.js:123` vs `customer.js:60`) |
| UC3 `[DOC EXPECTATION]`: address change must refresh coordinates | UC3 (ext 3a) | Red assertion of the correct behaviour; stays red until the stale-coordinate path is fixed |
| UC4 main flow: GET /restaurants | UC4 | Happy path for the list view (steps 1-2) — restaurants with ratings and menus |
| UC4 finding: restaurant with no profile.name | UC4 | Undocumented filter (`customer.js:96`) — a registered restaurant can vanish from the list |
| UC4 ext 2a: rating recomputed on every read | UC4 (ext 2a) | Confirms ext 2a — average is scanned from every delivered order per request, no stored value |
| UC4 new guard (undocumented): distance sort, missing userId | UC4 | 400 guard on the distance endpoint (`customer.js:173-175`); not in usecases.md — a new finding |
| UC4 ext 3a/3b: unknown userId / no saved location | UC4 (ext 3a, 3b) | 404 / 400 for the two bad-precondition cases (`customer.js:183, 188`) |
| UC4 main flow: distance sort, nearest-first | UC4 | Happy path for step 3 — Haversine sort ascending with a mileage figure (`customer.js:294`) |
| UC4 finding (not automated): `console.log(restaurants[1].location)` | UC4 | Documents a latent crash — `customer.js:155` throws after responding when fewer than 2 restaurants exist |
| UC5 main flow: add / re-add bumps quantity, running total | UC5 | Happy path (steps 1-2) for `CartContext` |
| UC5 main flow: adjust a quantity | UC5 (step 1) | `updateQuantity` + `getTotalPrice` keep the running total correct |
| UC5: `updateQuantity(≤ 0)` removes the line | UC5 | Documented removal behaviour (`CartContext.tsx:58-61`) |
| UC5: removeItem / clearCart | UC5 | Basic cart maintenance empties the cart |
| UC5 finding: cross-restaurant cart, no guard | UC5 (ext 3a) | The context never blocks a multi-restaurant cart — the "one coherent order" rule is only the silent checkout split (`Cart.tsx:106`) |
| UC5 star finding: cart lost on refresh | UC5 (ext 1a) | Confirms ext 1a — the cart is `useState` only, no persistence (`CartContext.tsx:37`) |
| UC5 `[DOC EXPECTATION]`: cart survives a refresh | UC5 (ext 1a) | Red assertion of the correct behaviour; stays red until the cart is persisted |
| blocks a negative total before creating an order | UC6 (ext 2b) | Red on the real bug: 201 with an order created — validation is presence-only (`orders.js:34-40`) |
| UC7 main flow: GET /customer order list | UC7 | Happy path for the tracking list (steps 1-2) |
| UC7: list scoped to the customer | UC7 | `where('customerId', ...)` isolates the caller's orders (`orders.js:93-95`) |
| UC7 ext 2a: missing customerId | UC7 (ext 2a) | Guard fires (`orders.js:89`) |
| UC7: customer with no orders | UC7 | Empty history is a valid 200 state, not an error |
| UC7 star finding: confirmedAt tracks the wrong transition | UC7 (ext 2c) | Confirms ext 2c — `confirmedAt` is stamped on `→ preparing`, not `→ confirmed` (`orders.js:202`) |
| UC7 finding: GET /:id is a stub | UC7 | Single-order lookup returns hardcoded mock data for any id and never reads the store (`orders.js:157-180`) |
| UC7 ext 2b: transitions unvalidated | UC7 (ext 2b; also UC12 ext 3a) | Status accepts any enum from any state — an order reaches `delivered` with no intermediate milestones (`orders.js:184`) |
| UC7 `[DOC EXPECTATION]`: GET /:id returns the real order | UC7 | Red assertion of the correct behaviour; stays red until `/:id` reads Firestore |
| main success scenario: a 1-5 star rating on an own delivered order is stored once | UC8 | Happy path — rating written once to the order (`orders.js:245-303`) |
| review is optional: rating without review stores an empty review string | UC8 | Omitted review persists as `''`, not undefined |
| extension 1a: invalid rating 0 -> 400 | UC8 (ext 1a) | Below-range rating rejected (`orders.js:246`) |
| extension 1a: invalid rating 6 -> 400 | UC8 (ext 1a) | Above-range rating rejected (`orders.js:246`) |
| extension 1a: invalid rating 3.5 -> 400 | UC8 (ext 1a) | Non-integer rating rejected (`orders.js:246`) |
| extension 1a: invalid rating "four" -> 400 | UC8 (ext 1a) | Non-numeric rating rejected (`orders.js:246`) |
| extension 2a: order not found -> 404 | UC8 (ext 2a) | Missing order → 404 (`orders.js:262`) |
| extension 2b: another customer's order -> 403 | UC8 (ext 2b) | Ownership enforced on rating (`orders.js:269`) |
| extension 2c: order not delivered yet -> 400 | UC8 (ext 2c) | Only delivered orders can be rated (`orders.js:273`) |
| extension 2d: already rated -> 400, and the first rating survives | UC8 (ext 2d) | Rating is immutable once set (`orders.js:278`) |
| extension 3a: rating is written only to the order document — restaurant doc byte-identical before and after | UC8 (ext 3a) | No stored average exists; averages are derived at read time (`customer.js:97-122`) |
| awards points for a completed order in the customer points ledger | UC9 | `awardPointsForOrder` (called directly, as the deliver route does) writes an earned transaction + updated totals (`points.js:189-237`) |
| main success scenario: redeem points at 1 point = $0.01, balance deducted and redemption logged | UC10 | Happy path (`points.js:68-140`) |
| extension 2a: points < 1 or non-integer -> 400 | UC10 (ext 2a) | Input validation on redemption (`points.js:69`) |
| extension 3a: insufficient balance -> 400 with available vs. requested points | UC10 (ext 3a) | Balance guard with a diagnostic body (`points.js:92-97`) |
| extension 3b: no points record for the customer -> 404 | UC10 (ext 3b) | Missing ledger → 404 (`points.js:85-88`) |
| STAR FINDING: concurrent redemptions double-spend a balance that should only cover ONE of them | UC10 (ext 5a) | Both concurrent requests get 200 — lost-update off one stale read; only one of two redemptions survives the audit log (`points.js:82-127`) |
| POST /calculate-discount previews the discount WITHOUT deducting any points | UC10 | Preview endpoint is side-effect-free (`points.js:142-186`) |
| POST /calculate-discount: insufficient balance -> 400, same guard as /use | UC10 | Preview shares the /use balance guard (`points.js:166-172`) |
| POST /calculate-discount: no points record -> 404 | UC10 | Preview shares the missing-ledger guard (`points.js:159-161`) |
| `[DOC EXPECTATION]` concurrent redemptions must not exceed the available balance | UC10 (ext 5a) | Red assertion of the correct concurrency behaviour; stays red until a transaction wraps read-then-update |
| main success scenario: spoken text is classified into one of the five known commands | UC11 | Happy path with Gemini mocked (`voice.js:31-77`) |
| a whitespace-padded model reply is trimmed before matching | UC11 | Reply normalization holds (`voice.js:67-68`) |
| extension 1a: missing or non-string userText {} -> 400 | UC11 (ext 1a) | Absent input rejected before any model call (`voice.js:35-37`) |
| extension 1a: missing or non-string userText {"userText":""} -> 400 | UC11 (ext 1a) | Empty input rejected before any model call |
| extension 1a: missing or non-string userText {"userText":42} -> 400 | UC11 (ext 1a) | Non-string input rejected before any model call |
| extension 2a: no GEMINI_API_KEY -> 500, feature dead | UC11 (ext 2a) | Missing key kills the feature with a 500 (`voice.js:39-42`) |
| extension 2b: unparseable model reply -> 422 with the raw text echoed | UC11 (ext 2b) | Unmatched model output → 422 + raw echo (`voice.js:71-75`) |
| extension 2c: upstream Gemini HTTP error status is passed through | UC11 (ext 2c) | A Gemini 429 surfaces as our 429 (`voice.js:83-87`) |
| `[DOC EXPECTATION]` a food-ordering app's voice feature should be able to add an item or place an order | UC11 (ext 3a) | Red assertion of ordering-by-voice — impossible: the action list is 5 navigation commands (`voice.js:6-12`) |
| requires a valid kitchen workflow before an order can be marked delivered | UC12 (ext 3a) | Red on the real bug: `pending → delivered` accepted with no transition guard (`orders.js:184`; corroborates UC7 ext 2b) |
| main success scenario: returns exactly the restaurant's own orders | UC13 | List is correctly scoped to the caller (`orders.js:113-142`) |
| data contract for the client-side aggregation: totalAmount, status, and serialized dates are present | UC13 | The fields the browser charts depend on survive serialization (`orders.js:127-137`) |
| extension 2a: missing restaurantId -> 400 | UC13 (ext 2a) | Guard fires (`orders.js:119`) |
| extension 2b: the endpoint returns the FULL raw order list | UC13 (ext 2b) | No server-side aggregation/pagination — all 60 seeded orders in one response |
| main success scenario: restaurant adds/edits menu items and customers see the update | UC14 | Happy path (GET/PUT /menu) |
| extension 1a: missing ownerId on GET /menu -> 400 | UC14 (ext 1a) | Guard fires (`restaurant.js:83`) |
| extension 3a: PUT /menu with an invalid body fails express-validator -> 400 | UC14 (ext 3a) | Body validation holds (`restaurant.js:116`) |
| extension 3b: PUT /menu for an ownerId with no matching restaurant user -> 404 | UC14 (ext 3b) | Unknown owner → 404 (`restaurant.js:131`) |
| MISMATCH vs usecases.md 3c: PUT /profile does not "silently create" — it 500s | UC14 (ext 3c) | Disproves the doc: `Restaurant.findByOwnerId` is undefined, every call 500s (`restaurant.js:51`) |
| follow-up: the same PUT /profile crash also happens when a Restaurant record already exists | UC14 | The endpoint is unconditionally broken, not just the no-prior-record edge |
| BONUS FINDING: GET /profile is a stub | UC14 | Always `{ user: null, restaurant: null }` regardless of caller (`restaurant.js:8-20`) |
| `[DOC EXPECTATION]` usecases.md 3c: PUT /profile should silently create a restaurant when none exists | UC14 (ext 3c) | Red assertion of the documented behaviour; stays red while the endpoint 500s |
| main success scenario: partner accepts a ready, unassigned order and it is assigned to them | UC15 | Happy path (POST /accept/:orderId) |
| extension 2a: another partner got it first -> 409 | UC15 (ext 2a) | Claim conflict signalled (`delivery.js:111`) |
| extension 2b: order no longer ready -> 400 | UC15 (ext 2b) | State guard fires (`delivery.js:116`) |
| extension 2c: partner record not found -> 400 | UC15 (ext 2c) | Unknown partner rejected (`delivery.js:123`) |
| extension 2d: partner already has an active order -> 400, one-at-a-time | UC15 (ext 2d) | One-active-order rule enforced (`delivery.js:134`) |
| RACE CONDITION: two partners concurrently claim the same ready order | UC15 | Both concurrent claims get 200 — the 2a guard has the same read-check-write race as UC10 (`delivery.js:100-146`) |
| main scenario step 1: GET /available lists only ready, unassigned orders | UC15 | Job board scoped correctly (`delivery.js:299-331`) |
| extension 2e: POST /reject releases a claimed order back to ready/unassigned | UC15 (ext 2e) | Reject path restores the order (`delivery.js:164-191`) |
| BONUS FINDING: POST /reject never checks the caller was the assigned partner | UC15 | An uninvolved rider can un-assign someone else's claim — same bug shape as UC16's theft |
| extension 1a: pickup never checks the order exists — updates blind, uncontrolled 500 | UC16 (ext 1a) | Nonexistent order → 500, not 404; the update is blind (`delivery.js:204-209`) |
| extension 1a (continued): pickup blindly overwrites status on an order in the wrong state | UC16 (ext 1a) | No state guard on pickup |
| extension 2a: order not found at delivery -> 404 | UC16 (ext 2a) | Deliver checks existence (`delivery.js:234-236`) |
| STAR FINDING (clean case): Partner B, never assigned, completes Partner A's delivery and is credited | UC16 (ext 2b) | Delivery theft fully reproduced with before/after earnings (`delivery.js:223-268`) |
| UNRELATED BUG: completing a delivery for a rider with no other active order 500s AFTER paying out | UC16 | `User.updateDeliveryStatus` is undefined — the normal case crashes after persisting order/points/earnings (`delivery.js:278`) |
| STAR FINDING (common case): response is 500 but the state corruption still fully lands | UC16 (ext 2b) | The theft is not masked by the crash — all writes committed before the 500 |
| note: an unreasonably large deliveryFee/tipAmount is accepted and paid out | UC16 (ext 3b) | No upper bound on the client-supplied pay inputs (`delivery.js:244`) |
| GET /orders includes a computed earning field | UC16 | Per-order earning = deliveryFee + tipAmount (`delivery.js:37-85`) |
| GET /orders requires a riderId -> 400 | UC16 | Guard fires (`delivery.js:42-44`) |
| `[DOC EXPECTATION]` only the assigned delivery partner should be able to complete an order and be paid | UC16 (ext 2b) | Red assertion of the correct authorization; stays red until riderId is checked against the assignment |
| the map is consumed ONLY by the customer order page (whole client/src scan) | UC17 | Sole consumer is `customer/Orders.tsx` — no delivery-partner screen references it |
| the page labels the feature a simulation: a visible <h3>Delivery Simulation</h3> heading | UC17 | The UI itself names the map a simulation (`Orders.tsx:503`) |
| the courier position is linearly interpolated between two fixed points | UC17 (ext 3a) | Marker position is `interpolate(restaurant, customer, progress)` — pure math, no data source |
| the animation is a hardcoded 20 steps on a 1000 ms setInterval | UC17 (ext 3a) | 20 seconds regardless of any real delivery (`DeliveryMap.tsx:89-104`) |
| the animation is started by a button the customer presses ("Start Delivery") | UC17 (ext 3a) | Trigger is a user click, not order state |
| no real position source can reach the component: props contract is {restaurant, customer, onDelivered?} | UC17 (ext 3a) | Any added input (order, partner id, live feed) breaks this pin (`DeliveryMap.tsx:8-12`) |
| main success scenario: GET /orders exposes a computed per-order earning = deliveryFee + tipAmount | UC18 | The number the earnings screen sums exists per order (`delivery.js:58-61`) |
| missing riderId -> 400 | UC18 | Guard fires (`delivery.js:42-44`) |
| non-numeric deliveryFee/tipAmount coerce to 0 in the displayed earning, not NaN | UC18 | `Number(x) || 0` coercion holds for both malformed-input paths (`delivery.js:58-60`) |
| server-side bookkeeping: totalEarnings accumulates across deliveries | UC18 | 5 + 5 = 10 proves summation, not overwrite (`User.js:153-166`) |
| two-bookkeeping-systems finding: totalEarnings is written on delivery but GET /orders never serves it | UC18 (ext 2a) | The ledger is write-only; the client recomputes from orders and the two can diverge silently |
| returns earned badge data for a customer with stored stats | UC19 | Badge evaluation resolves stored stats into computed badge data (`services/badgeService.js`) |
| main success scenario: meals donated = floor(delivered/10) | UC20 | The documented 1-per-10 rule holds (`donations.js:15`) |
| main scenario edge case: zero delivered orders -> zero meals donated | UC20 | Boundary holds |
| extension 2a (partial): POST /update rejects zero/negative meal amounts -> 400 | UC20 (ext 2a) | Only the zero/negative guard exists (`donations.js:47`) |
| STAR FINDING: any unauthenticated caller can inflate the stored donation counter without bound | UC20 (ext 2a) | Counter tampering fully reproduced (`donations.js:59`) |
| the counter has no upper bound and keeps compounding across repeated calls | UC20 (ext 2a) | Inflation compounds without limit |
| POST /record logs a donation entry | UC20 | Recording path works (`donations.js:96-126`) |
| POST /record rejects zero/negative amounts -> 400 | UC20 | Guard fires (`donations.js:101`) |
| GET /history returns recorded donations, most recent first | UC20 | History ordering holds (`donations.js:76-94`) |

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

### …and the remaining 15 UCs (same method, by test name)

| UC | Nearest own-test coverage (by name) | Blind to |
|---|---|---|
| **UC2** | `validateEmail` | The `/login` route: the plain-text comparison, the absence of any session/token |
| **UC6** | `calculateOrderTotal`, `isValidOrder`, `canPlaceOrder`, `calculateTax`, `calculateTipAmount`, `formatOrderId` — checkout math on hypothetical helpers (`calculateTax` was never built) | `POST /orders` itself: presence-only validation, negative totals accepted, the silent multi-restaurant split |
| **UC8** | `isValidRating` | The rate route's five guards, rating immutability, read-time-derived averages |
| **UC9** | `calculatePointsForOrder` — and its assertions encode the README's 10% rate (`calculatePointsForOrder(100) === 10`), i.e. the suite specifies the **documented** earn rate the shipped code contradicts (1 pt/$, `points.js:195`) | `awardPointsForOrder`, the delivery trigger, the 50-entry transaction cap |
| **UC10** | `calculateDiscountFromPoints`, `canUsePoints`, `calculateMaxDiscount`, `isValidDiscountCode` (discount codes were never built) | `POST /use`: the balance guard, the concurrency double-spend, the audit-log overwrite |
| **UC11** | — none | The entire voice feature |
| **UC12** | `isValidStatusTransition` (~20 tests), `canManageOrders` — encode a full order state machine | `orders.js` ships no transition rules at all — the exact gap UC7/UC12 tests exposed |
| **UC13** | `formatCurrency` at best | `GET /orders/restaurant`, the client-side aggregation, the no-pagination cost |
| **UC14** | — none | The whole menu/profile surface, including the unconditionally-broken PUT /profile |
| **UC15** | `getDefaultDeliveryStatus` | Accept/reject routes, the claim race, the /reject ownership hole |
| **UC16** | `isValidStatusTransition` (again — hypothetically), `calculateDeliveryFee`, `calculateTipAmount` | Pickup/deliver routes: the delivery theft, the post-payout crash, unbounded payout |
| **UC17** | `calculateDeliveryTime`, `calculateEstimatedDeliveryTime` — ETA math that never shipped | The fabricated map simulation |
| **UC18** | `calculateDeliveryFee`, `calculateTipAmount` | The computed earning field, the write-only totalEarnings ledger |
| **UC19** | — none | Badge rules live in `src/badges/`, untouched by the suite |
| **UC20** | — none | The donation counter, its derivation rule, and the unauthenticated inflation hole |

The pattern of the first table holds across all 20: the inherited suite
specifies helper-level math (sometimes for features that never shipped, and
in UC9's case for the documented behavior the shipped code contradicts) and
is blind to every route, screen, and state transition our tests exercised.
