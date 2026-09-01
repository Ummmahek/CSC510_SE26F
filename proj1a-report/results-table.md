# D3 — Test results table

One row per test (or tightly-related group). "Expected" states what the use
case / README promises — not what the code does — so a FAIL reads as a defect
found, not a mistake made. Failures are findings: explain them, never hide
them. Rows marked **FAIL/finding** document a defect even when the Jest test
itself passes (the test asserts actual behavior; the row judges that behavior
against the use case). Tests titled `[DOC EXPECTATION]` assert the documented
behavior and are intentionally red for the demo video — their rows are
marked **FAIL (by design)**; each pairs with a green STAR/FINDING row and
stays red until the app is fixed.

## How to run (five batches, all 20 use cases)

From `proj2/` (after `npm install` in `proj2/`, `proj2/server/`, and — for
batch 4 — `proj2/client/`), except batch 4 which runs from `proj2/client/`:

```bash
# batch 1 — UC10/14/15/16/20: 44 tests, 41 pass + 3 intentional red
npx jest tests/uc10-redeem-points.test.js tests/uc14-manage-menu.test.js tests/uc15-claim-delivery.test.js tests/uc16-pickup-deliver.test.js tests/uc20-donation-impact.test.js --no-coverage --verbose

# batch 2 — UC8/11/13/17/18: 35 tests, 34 pass + 1 intentional red
npx jest tests/uc8-rate-order.test.js tests/uc11-voice-control.test.js tests/uc13-sales-insights.test.js tests/uc17-delivery-map.test.js tests/uc18-delivery-earnings.test.js --no-coverage --verbose

# batch 3 — UC1/3/4/7: 29 tests, 26 pass + 3 intentional red
npx jest tests/uc1-signup-role.test.js tests/uc3-manage-profile.test.js tests/uc4-browse-restaurants.test.js tests/uc7-track-order.test.js --no-coverage --verbose

# batch 4 — UC5 (client-only; run from proj2/client/): 7 tests, 6 pass + 1 intentional red
CI=true npx react-scripts test src/contexts/uc5-build-cart.test.tsx --verbose

# batch 5 — UC2/6/9/12/19: 5 tests, 3 pass + 2 red on real bugs
npx jest --config='{"rootDir":"..","testEnvironment":"node","testMatch":["**/proj1-26F/*.test.js"]}' --runTestsByPath ../proj1-26F/uc-usecases.test.js --runInBand --verbose
```

**Total: 120 tests — 110 pass, 10 red (8 `[DOC EXPECTATION]` + 2 asserting
documented behavior against real bugs).** (Batch 1's three red tests are
represented in the table by their paired green STAR-FINDING rows rather than
dedicated rows.) Raw output samples:
`uc-validation-notes.md` (batches 1–2), `raw-output/*.txt` (batches 3–4),
`../proj1-26F/proj1a.md` (batch 5).

## Environment note

Firestore is mocked (`proj2/tests/helpers/fakeFirestore.js`), not the real
emulator — Docker/gcloud/firebase-cli weren't available on the machines that
wrote batches 1 and 3 (batch 5 uses its own inline mock of
`config/firebase`; batch 4 is client-only and needs no database at all).
Batch 3 added `QuerySnapshot.forEach()` to the fake:
real Firestore has it and `customer.js`'s rating aggregation relies on it; all
pre-existing suites were verified unaffected. UC5 is client-only (there is no
cart endpoint), so it runs under the `proj2/client` CRA/jsdom runner. If
someone has the real emulator running (per D1 it worked in Docker), the
concurrency findings (UC10, UC15) are worth re-running against it.

## Results, ordered by use case

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC1 main flow: valid registration | Cover the happy path | 201, account created, credential not echoed | PASS |
| UC1 main flow: registered user can log in | UC1 postcondition "user can log in" | Same credentials authenticate via `/login` | PASS |
| UC1 ext 3a: invalid email / short password / unknown role | Doc'd extension (`auth.js:9-11`) | 400 | PASS |
| UC1 ext 3b: duplicate email | Doc'd extension (`auth.js:23-26`) | 400 | PASS |
| UC1 finding: geocode failure swallowed on signup | usecases.md ext 2a — address resolution needs a Maps key | Address handled, or signup fails cleanly | **FAIL/finding** — 201 with `location: null`; the non-OK geocode status returns null silently (`models/User.js:41-45`) and nothing signals it |
| UC1 finding: empty profile object accepted | Step 1 says "fills the role-specific profile" | Role-specific fields required | **FAIL/finding** — `profile: {}` → 201; only `isObject()` is checked (`auth.js:12`) |
| UC1 star finding: password stored in plaintext | usecases.md ext 4a; the code comment says "hash this password" (`auth.js:31`) | Password stored as a hash | **FAIL/finding** — the raw Firestore doc holds the submitted password verbatim |
| UC1 `[DOC EXPECTATION]`: stored password must be hashed | Assert the fix for the star finding as a red test | Stored value ≠ submitted value | **FAIL (by design)** — stored value is `"supersecret"`; stays red until `/register` hashes |
| UC2 main flow: login with valid credentials | Cover the happy path (`auth.js:47-82`) | 200 with the user payload | PASS (`proj1-26F/uc-usecases.test.js`) |
| UC3 main flow: edit a field, re-read it | Cover the happy path | 200, change persists and is visible on GET | PASS |
| UC3 auth: wrong password / non-customer role | Doc'd guards (`customer.js:25, 60`) | 401 | PASS |
| UC3 star finding: address change keeps stale coordinates | usecases.md ext 3a (`models/User.js:119-124`) | New address → new coordinates, or the request fails | **FAIL/finding** — 200 but `location` stays the old point; the geocode miss leaves coordinates untouched |
| UC3 finding: one-field edit wipes the rest of the profile | Step 2 is "User edits fields (address, phone, …)" | Other fields preserved | **FAIL/finding** — `update({ profile })` replaces the whole map (`customer.js:66`); setting `phone` deletes `name` and `address` |
| UC3 finding: phone type-check only on the customer route | usecases.md note "four endpoints, different contracts" | One consistent contract | **FAIL/finding** — `profile.phone: 12345` → 400 on `/api/customer/profile`, 200 on `/api/auth/profile` |
| UC3 finding: role check only on the customer route | Same note | Same authorization for the same operation | **FAIL/finding** — a restaurant user is blocked on `/api/customer/profile` (401) but edits fine via `/api/auth/profile` (200) |
| UC3 `[DOC EXPECTATION]`: address change must refresh coordinates | Assert the fix for the star finding as a red test | `location` ≠ old point after an address change | **FAIL (by design)** — `location` unchanged; stays red until the stale-coordinate path is fixed |
| UC4 main flow: GET /restaurants | Cover the happy path | Every registered restaurant, with rating and menu | PASS |
| UC4 finding: restaurant with no profile.name | Behaviour at `customer.js:96` | Restaurant listed, or an explicit reason it isn't | **FAIL/finding** — silently omitted from the list |
| UC4 ext 2a: rating recomputed on every read | usecases.md ext 2a (`customer.js:97-122`) | A rating is shown | PASS — confirms the doc: recomputed by scanning every delivered order per request, no stored average (the users doc has no `rating` field) |
| UC4 new guard (undocumented): distance sort, missing userId | Found on the endpoint (`customer.js:173-175`); not in usecases.md | 400 | PASS — new finding, not a doc'd extension |
| UC4 ext 3a/3b: unknown userId / no saved location | Doc'd extensions (`customer.js:183, 188`) | 404 / 400 | PASS |
| UC4 main flow: distance sort, nearest-first | Cover the happy path (step 3) | Sorted nearest-first with a mileage figure | PASS |
| UC4 finding (not automated): `console.log(restaurants[1].location)` | Found reading the handler (`customer.js:155`) | List endpoint works for any restaurant count | **FAIL/finding** — with 0 or 1 registered restaurants it throws a `TypeError` after `res.json()` sends 200 → `ERR_HTTP_HEADERS_SENT`; not automated (it would inject an unhandled-rejection warning into the raw output) — every UC4 test seeds ≥ 2 restaurants to avoid it |
| UC5 main flow: add / re-add bumps quantity, running total | Cover the happy path | Quantities merge, running total correct | PASS |
| UC5 main flow: adjust a quantity | Step 1 "adjusts quantities" | Total updates | PASS |
| UC5: `updateQuantity(≤ 0)` removes the line | `CartContext.tsx:58-61` | Line removed | PASS |
| UC5: removeItem / clearCart | Basic cart maintenance | Cart empties | PASS |
| UC5 finding: cross-restaurant cart, no guard | usecases.md ext 3a | One coherent order per restaurant, or the mix is blocked | **FAIL/finding** — both items sit in one cart; the rule is only applied by a silent split at checkout (`client/src/components/customer/Cart.tsx:106`) |
| UC5 star finding: cart lost on refresh | usecases.md ext 1a (`CartContext.tsx:37`) | Cart survives a refresh on the way to checkout | **FAIL/finding** — the cart is `useState` only and nothing is written to `localStorage`; a remount empties it |
| UC5 `[DOC EXPECTATION]`: cart survives a refresh | Assert the fix for the star finding as a red test | Items still present after remount | **FAIL (by design)** — empty after remount; stays red until the cart is persisted |
| UC6 finding: negative totalAmount accepted | usecases.md ext 2b — validation is presence-only (`orders.js:34-40`) | 400, no order created | **FAIL (real bug)** — 201, order created; the test asserts the documented behavior and stays red (`proj1-26F/uc-usecases.test.js`) |
| UC7 main flow: GET /customer order list | Cover the happy path | The customer's orders with current status | PASS |
| UC7: list scoped to the customer | `orders.js:93-95` | Only this customer's orders | PASS |
| UC7 ext 2a: missing customerId | Doc'd extension (`orders.js:89`) | 400 | PASS |
| UC7: customer with no orders | Boundary | 200 + empty list, not an error | PASS |
| UC7 star finding: confirmedAt tracks the wrong transition | usecases.md ext 2c (`orders.js:202`) | `confirmedAt` marks the "confirmed" transition | **FAIL/finding** — `→ confirmed` records no timestamp; `→ preparing` is what sets `confirmedAt`, so a "Confirmed at …" label really shows the cook-start time |
| UC7 finding: GET /:id is a stub | usecases.md main scenario (open an order to track it) | The real order for that id, or 404 | **FAIL/finding** — returns a hardcoded mock (`customerId: "customer123"`, one Pizza, `status: "pending"`) for any id, never reads Firestore (`orders.js:157-180`) |
| UC7 ext 2b: transitions unvalidated | usecases.md ext 2b; UC12 ext 3a (`orders.js:184`) | Status advances through the documented sequence | **FAIL/finding** — `pending → delivered` in one call is accepted; the tracked order then shows "Delivered" with `confirmedAt` and `readyAt` never set |
| UC7 `[DOC EXPECTATION]`: GET /:id returns the real order | Assert the fix for the stub as a red test | Response reflects the seeded order | **FAIL (by design)** — returns the mock; stays red until `/:id` reads the store |
| UC8 main + optional review | Happy path (`orders.js:245-303`) | 200, rating stored once | PASS |
| UC8 ext 1a: rating 0 / 6 / 3.5 / "four" | Doc'd validator (`orders.js:246`) | 400 each | PASS |
| UC8 ext 2a/2b/2c/2d: missing order / wrong customer / undelivered / already rated | Doc'd guards (`orders.js:262-278`) | 404 / 403 / 400 / 400 | PASS — and the first rating survives a second attempt |
| UC8 ext 3a: no stored average updated | Doc says averages are derived at read time (`customer.js:97-122`) | Restaurant doc byte-identical before/after rating | PASS (finding confirmed) |
| UC9 main flow: points awarded on delivery | Cover the earn path (`points.js:189-237`) | Earned transaction + updated totals persisted to the ledger | PASS (`proj1-26F/uc-usecases.test.js`) |
| UC9 earn rate vs README *(still not automated — candidate follow-up)* | README promises "10% of bill" (15% for Local Legends, `proj2/README.md:102-103`); code awards `Math.floor(orderAmount)` = 1 pt/$, no Local Legends branch (`points.js:195`) | $50 order → 5 points | **Expected FAIL** — docs and code disagree; see `usecases.md` UC9 1a |
| UC10 main flow: redeem at 1pt = $0.01 | Cover the happy path | Balance deducted, transaction logged | PASS |
| UC10 ext 2a/3a/3b: invalid points, insufficient balance, no record | Doc'd guards (`points.js:69, 92-97, 85-88`) | 400 / 400 / 404 | PASS |
| UC10 star finding: concurrent redemption double-spend | Doc flags no transaction around read-then-update (`points.js:82-127`) | Second concurrent redemption refused | **FAIL as a vulnerability, but not exactly as predicted.** Both concurrent requests get 200 (real double-spend: 120 pts of discount off a 100 pt balance). Stored balance lands at 40, not negative — both requests compute the same number off the same stale read. Only 1 of 2 "used" transactions survives in the log — the other is silently overwritten, so the audit trail undercounts the exploit. |
| UC10 new: POST /calculate-discount | Untested by the doc | Preview discount without deducting | PASS |
| UC11 main + trim | Happy path (`voice.js:31-77`) | 200 with one of the 5 action ids | PASS (Gemini mocked) |
| UC11 ext 1a/2a/2b: bad input / no API key / unparseable reply | Doc'd guards (`voice.js:35-42,71-75`) | 400 / 500 / 422 | PASS |
| UC11 ext 2c: upstream Gemini HTTP error | Error handler (`voice.js:83-87`) | Upstream status passed through | PASS — a Gemini 429 surfaces as our 429 |
| UC11 [DOC EXPECTATION]: voice can order food | The feature's own name promises ordering | 200 with an ordering action | **FAIL (by design)** — the action list is 5 navigation commands (`voice.js:6-12`); a food-ordering app's voice feature cannot order food |
| UC12 finding: status transitions unguarded | usecases.md ext 3a (`orders.js:184`) | A `pending → delivered` leap rejected | **FAIL (real bug)** — accepted; test asserts the documented workflow and stays red (`proj1-26F/uc-usecases.test.js`; corroborates the UC7 ext 2b row) |
| UC13 main: only own orders returned | Happy path (`orders.js:113-142`) | 2 of 3 seeded orders | PASS |
| UC13 data contract for client charts | Insights.tsx aggregates client-side | totalAmount/status/parseable dates | PASS |
| UC13 ext 2a: missing restaurantId | Doc'd guard (`orders.js:119`) | 400 | PASS |
| UC13 ext 2b: full raw list, no pagination | Doc'd scalability cost | All 60 seeded orders in one response | PASS (finding confirmed) |
| UC14 main flow: add/edit menu items | Cover the happy path | 200, menu persisted and readable via GET | PASS |
| UC14 ext 1a: missing ownerId on GET /menu | Doc'd extension | 400 | PASS |
| UC14 ext 3a: PUT /menu invalid body | Doc'd extension | 400 | PASS |
| UC14 ext 3b: PUT /menu unknown ownerId | Doc'd extension | 404 | PASS |
| UC14 ext 3c: PUT /profile "silently creates" a restaurant | usecases.md says 200 silent creation | 200 | **FAIL as predicted by the doc — but for the wrong reason.** `Restaurant.findByOwnerId()` (`restaurant.js:51`) is called but never defined anywhere on the model. Every call to PUT /profile 500s unconditionally (confirmed with and without a pre-existing restaurant record) — worse than the doc describes, not a silent-creation bug at all. |
| UC14 new: GET /profile | Endpoint exists, untested by the doc | Some response reflecting caller identity | **FAIL/finding** — it's a dead stub, always returns `{ user: null, restaurant: null }` regardless of input |
| UC15 main flow + ext 2a-2d: claim, conflict, not-ready, partner-not-found, partner-busy | Doc'd extensions (`delivery.js:111,116,123,134`) | 200 / 409 / 400 / 400 / 400 | PASS |
| UC15 race: two partners claim the same order concurrently | Doc/brief predicts "exactly one 200, one 409" | One 200, one 409 | **FAIL as predicted by the doc — same root cause as UC10.** No transaction around read-check-write (`delivery.js:100-146`); both requests get 200. Deterministic across 5+ reruns, not flaky. |
| UC15 new: GET /available, POST /reject | Untested by the doc | List ready+unassigned; release a claim back to ready | PASS |
| UC15 new finding: POST /reject has no ownership check | Found while adding /reject coverage | Only the assigned partner can reject | **FAIL/finding** — an uninvolved partner can un-assign someone else's legitimately claimed order, same bug shape as UC16 below |
| UC16 ext 1a: pickup never checks order exists | Doc'd extension (`delivery.js:204-209`) | Some handled error | **FAIL/finding** — uncontrolled 500 (not a clean 404) on a nonexistent order; also blindly overwrites status on an order in the wrong state |
| UC16 ext 2a: deliver on nonexistent order | Doc'd extension | 404 | PASS |
| UC16 star finding: wrong-partner delivery theft | Headline security bug per the brief | Only the assigned partner can complete + get paid | **FAIL/finding, fully confirmed.** Partner B (never assigned) completes Partner A's delivery, order marked delivered, Partner B credited $5, Partner A credited $0. `delivery.js:223-268` never compares caller vs. assigned partner. |
| UC16 new finding: `User.updateDeliveryStatus` undefined | Found while building the fixture above | Delivery completion succeeds cleanly | **FAIL/finding** — completing a delivery 500s in the *normal* case (rider has no other active order), after the order/points/earnings have already been persisted |
| UC16 new: unbounded fee/tip payout | Doc flags no cap (`delivery.js:244`) | Some cap | **FAIL/finding** — $999,999 + $999,999 credited with zero limit |
| UC16 new: GET /orders earning field | Untested by the doc | Computed `earning` = deliveryFee + tipAmount | PASS |
| UC17 source inspection (6 tests) | Router/SDK-dependent components can't load under the inherited client runner (`App.test.tsx`'s react-router-dom breakage); assert the fabricated-courier finding on source instead | Sole consumer is the customer page (whole-src scan); visible "Delivery Simulation" heading; interpolated marker; hardcoded 20 steps x 1000 ms; "Start Delivery" button; props contract admits no real position source | PASS (all findings confirmed in source) |
| UC18 main: GET /orders earning field | Happy path (`delivery.js:58-61`) | earning = deliveryFee + tipAmount | PASS |
| UC18: missing riderId | Doc'd guard (`delivery.js:42-44`) | 400 | PASS |
| UC18: non-numeric fee/tip | Coercion (`delivery.js:58-60`) | 0, not NaN | PASS |
| UC18: totalEarnings accumulates | Server ledger (`User.js:153-166`) | 5 + 5 = 10 after two deliveries | PASS (rider kept "busy" to dodge the known `updateDeliveryStatus` 500) |
| UC18 two-ledgers finding | totalEarnings written but never served | Response shape is orders-only; no order carries totalEarnings, each carries per-order earning | PASS (finding confirmed) |
| UC19 main flow: badge lookup for stored stats | Cover the evaluation path (`services/badgeService.js`) | Computed badge data for a valid customer | PASS (`proj1-26F/uc-usecases.test.js`) |
| UC20 main flow: floor(delivered/10) | Cover the happy path | 3 meals for 37 delivered orders | PASS |
| UC20 ext 2a: reject zero/negative mealsToAdd | Doc'd guard (`donations.js:47`) | 400 | PASS |
| UC20 star finding: unauthenticated counter inflation | Doc flags no bound on the increment endpoint (`donations.js:59`) | Some limit or auth check | **FAIL/finding** — any caller sets the stored counter to an arbitrary value (999,999,999 in one call), no auth, no bound |
| UC20 new: POST /record, GET /history | Untested by the doc | Log + retrieve donation entries correctly | PASS |
