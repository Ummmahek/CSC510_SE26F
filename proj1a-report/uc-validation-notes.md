# Project 1A: Use-case validation notes

Method notes, environment assumptions, findings, and raw output samples for
test batches 1-2 (UC8, 10, 11, 13, 14, 15, 16, 17, 18, 20 — ordered by UC
number throughout; batches 3-5 covering the other ten UCs are indexed in the
assumptions section below). The per-test rows live in the shared
`results-table.md` and `traceability-table.md`; this file is the methodology
behind them.

## Code link

- Tests: `proj2/tests/uc8-rate-order.test.js`, `uc10-redeem-points.test.js`,
  `uc11-voice-control.test.js`, `uc13-sales-insights.test.js`,
  `uc14-manage-menu.test.js`, `uc15-claim-delivery.test.js`,
  `uc16-pickup-deliver.test.js`, `uc17-delivery-map.test.js`,
  `uc18-delivery-earnings.test.js`, `uc20-donation-impact.test.js`
- Shared helpers: `proj2/tests/helpers/` (`fakeFirestore.js`, `buildApp.js`,
  `deliveryFixtures.js`)
- Use-case source: `proj1a-report/usecases.md`

## How to run

From `proj2/` (after `npm install` at root and in `server/`):

```bash
npx jest tests/uc8-rate-order.test.js tests/uc10-redeem-points.test.js tests/uc11-voice-control.test.js tests/uc13-sales-insights.test.js tests/uc14-manage-menu.test.js tests/uc15-claim-delivery.test.js tests/uc16-pickup-deliver.test.js tests/uc17-delivery-map.test.js tests/uc18-delivery-earnings.test.js tests/uc20-donation-impact.test.js --no-coverage --verbose
```

Expected: **79 tests — 75 pass, 4 intentional failures.** Tests titled
`[DOC EXPECTATION]` assert what the documentation promises instead of what the
code does; they are meant to stay red for the demo video:

| Test (marked `[DOC EXPECTATION]`) | File | Fails with |
|---|---|---|
| Concurrent redemptions must not exceed the available balance | `uc10-redeem-points.test.js` | `Expected: 1, Received: 2` |
| A food-ordering app's voice feature should be able to order food | `uc11-voice-control.test.js` | `Expected: 200, Received: 422` |
| PUT /profile should silently create a restaurant when none exists | `uc14-manage-menu.test.js` | `Expected: 200, Received: 500` |
| Only the assigned delivery partner should be able to complete an order and be paid | `uc16-pickup-deliver.test.js` | `riderBDoc.data().totalEarnings` expected `0`, received `5` |

All other tests assert actual observed behavior directly, calling out every
divergence from `usecases.md` in their own titles and in the shared tables.

## Environment assumptions (stated, not hidden)

- **Firestore is mocked** (`proj2/tests/helpers/fakeFirestore.js`), not the real
  emulator — Docker/gcloud/firebase-cli weren't available on the machine that
  wrote the first batch. The mock mirrors real Firestore where it matters
  (update() on a missing doc rejects; reads/writes resolve asynchronously so
  genuine races can happen), but it is a simulation. If someone gets the real
  emulator running (per D1 it worked in Docker), the two concurrency findings
  (UC10, UC15) are worth re-running against it.
- **UC11 mocks the Gemini HTTP call** at the exact axios entry file the server
  code resolves (`axios/dist/node/axios.cjs`). Two resolution traps documented
  in the test header: a bare `jest.mock('axios')` fails loudly (axios only
  exists in `server/node_modules`), while mocking the package *directory*
  resolves to a different registry key, silently mocks nothing, and lets the
  suite make REAL calls to Google.
- **UC17 uses source-inspection tests**: the use case is client-only; the
  inherited `App.test.tsx` breakage (react-router-dom unresolvable) blocks
  router-dependent rendering and `DeliveryMap` additionally depends on the
  Google Maps SDK. Router-free components CAN be tested under the
  `proj2/client` CRA/jsdom runner — `uc5-build-cart.test.tsx` (batch 4)
  proves it — so UC17's tests assert the fabricated-courier finding against
  the component source with cited lines instead of rendering it.
- **Batch 3 extended the fake** with `QuerySnapshot.forEach()` (real Firestore
  has it; `customer.js`'s rating aggregation requires it). All earlier suites
  verified unaffected.
- **This file's samples cover batches 1–2 (UC8/10/11/13/14/15/16/17/18/20).**
  Batch 3–4 samples (UC1/3/4/5/7) live in `raw-output/*.txt`; batch 5
  (UC2/6/9/12/19) in `../proj1-26F/proj1a.md`. Run commands for all five
  batches are consolidated in `results-table.md`.

## Findings and explanations (by use case)

**UC10 — double-spend confirmed, with a specific mechanism worth spelling out.**
`points.js:82-127` reads the points doc, computes the new balance/transaction in plain JS,
then calls `update()` — no `db.runTransaction()`. Two concurrent redemption requests for 60
points each on a 100-point balance both read `availablePoints: 100` before either writes,
so both pass the balance check and both get HTTP 200. The stored balance settles at 40 (not
negative) because both requests compute `100 - 60` independently from the same stale read
— whichever `update()` lands last just overwrites the field with the same number, a
lost-update, not a cumulative decrement. The `transactions` array is fully overwritten
(not appended) on each write too, so only one of the two redemptions survives in the
audit log even though both actually happened.

**UC11 — the voice feature of a food-ordering app cannot order food.**
The Gemini classifier's action list is five navigation commands (`voice.js:6-12`):
logout, open profile, go home, open cart, total price. Nothing adds an item or
places an order, so even a perfectly-behaving model cannot produce an ordering
action — pinned by the intentional `[DOC EXPECTATION]` red test.

**UC14 — PUT /profile is completely broken, not just the "silent creation" edge case.**
`restaurant.js:51` calls `Restaurant.findByOwnerId(user.id)`, but that method is never
defined anywhere on the `Restaurant` model (confirmed by grepping the whole repo). Calling
it throws a `TypeError`, caught by the route's own `catch`, surfacing as a 500 — for every
call, regardless of whether a restaurant record already exists. `usecases.md`'s claim that
this path "silently creates" a restaurant does not hold.

**UC15 — the same race exists in job-claiming, and a second, previously undocumented bug
in /reject.** `delivery.js:100-146` (`POST /accept/:orderId`) has the identical
read-check-write race as UC10. Separately, while adding coverage for `POST /reject/:orderId`
(`delivery.js:164-191`), we found it never checks that the caller is the partner who
actually claimed the order — an uninvolved rider can call `/reject` on someone else's
claimed order and it succeeds, wiping out their legitimate claim.

**UC16 — the headline finding, plus an unrelated crash discovered while testing it.**
`delivery.js:223-268` (`POST /deliver/:orderId`) never compares the `riderId` in the
request body against `orderData.deliveryPartnerId`. A completely uninvolved partner can
mark someone else's order delivered and get credited the payout. Separately: `delivery.js:278`
calls `rider.updateDeliveryStatus('free')`, a method never defined on `User` — this fires
whenever the delivering rider has no other active order, which (per UC15's one-order-at-a-time
rule) is the *normal* case. So most ordinary deliveries 500 at the very end, even though the
order, points, and earnings have already been correctly persisted by that point.

**UC17 — the "tracking" map is a fabricated simulation.**
The courier marker is linearly interpolated from restaurant to customer over a
hardcoded 20 steps × 1000 ms (`DeliveryMap.tsx:26-29, 84-105`), started by a
"Start Delivery" button the customer presses themselves. The component's whole
props contract is `{restaurant, customer, onDelivered?}` — no order, partner id,
or live position can even reach it. The UI labels it "Delivery Simulation".

**UC18 — two bookkeeping systems for the same money.**
`POST /deliver` writes `totalEarnings` on the rider's user document
(`User.js:153-166`), but no screen ever reads it back: `GET /orders` is built
solely from order documents and the client recomputes earnings from the order
list (`Insights.tsx:23-43`). The ledger is write-only and can diverge silently.

**UC20 — the counter-inflation vulnerability is real, but doesn't (yet) reach the customer.**
`donations.js:59` lets any unauthenticated caller add an arbitrary amount to the stored
`counter` field, with only a zero/negative check. But `GET /stats` (the endpoint the
customer-facing donation display actually calls) never reads that field into its
response — it always recomputes `floor(deliveredOrders / 10)` fresh. So the write-side hole
is fully exploitable, but its stated consequence ("displayed count matches the tampered
counter") isn't currently true.

## Raw test output samples (by use case)

Command run: `npx jest tests/uc8-rate-order.test.js --no-coverage --verbose`

```
PASS tests/uc8-rate-order.test.js
  UC8: Rate a delivered order (Customer)
    √ main success scenario: a 1-5 star rating on an own delivered order is stored once (orders.js:245-303) (80 ms)
    √ review is optional: rating without review stores an empty review string (53 ms)
    √ extension 1a: invalid rating 0 / 6 / 3.5 / "four" -> 400 (orders.js:246) (4 tests)
    √ extension 2a: order not found -> 404 (orders.js:262) (18 ms)
    √ extension 2b: another customer's order -> 403 (orders.js:269) (18 ms)
    √ extension 2c: order not delivered yet -> 400 (orders.js:273) (22 ms)
    √ extension 2d: already rated -> 400, and the first rating survives (orders.js:278) (69 ms)
    √ extension 3a (documented derivation): rating is written only to the order document — the restaurant document is byte-identical before and after (orders.js:291-294) (68 ms)

Tests:       11 passed, 11 total
```

Command run: `npx jest tests/uc10-redeem-points.test.js --no-coverage --verbose`

```
FAIL tests/uc10-redeem-points.test.js
    √ main success scenario: redeem points at 1 point = $0.01, balance deducted and redemption logged (points.js:68-140) (80 ms)
    √ extension 2a: points < 1 or non-integer -> 400 (points.js:69) (8 ms)
    √ extension 3a: insufficient balance -> 400 with available vs. requested points (points.js:92-97) (19 ms)
    √ extension 3b: no points record for the customer -> 404 (points.js:85-88) (19 ms)
    √ STAR FINDING: concurrent redemptions double-spend a balance that should only cover ONE of them (points.js:82-127, no transaction around read-then-update) (50 ms)
    √ POST /calculate-discount previews the discount WITHOUT deducting any points (points.js:142-186) (37 ms)
    √ POST /calculate-discount: insufficient balance -> 400, same guard as /use (points.js:166-172) (19 ms)
    √ POST /calculate-discount: no points record -> 404 (points.js:159-161) (19 ms)
    × [DOC EXPECTATION] concurrent redemptions must not exceed the available balance (EXPECTED TO FAIL -- see STAR FINDING above for the real behavior) (38 ms)
Test Suites: 1 failed, 1 total
Tests:       1 failed, 8 passed, 9 total
```

Command run: `npx jest tests/uc11-voice-control.test.js --no-coverage --verbose`

```
FAIL tests/uc11-voice-control.test.js
  UC11: Control the app by voice (Customer)
    √ main success scenario: spoken text is classified into one of the five known commands (voice.js:31-77) (42 ms)
    √ a whitespace-padded model reply is trimmed before matching (voice.js:67-68) (5 ms)
    √ extension 1a: missing or non-string userText {} / {"userText":""} / {"userText":42} -> 400 (voice.js:35-37) (3 tests)
    √ extension 2a: no GEMINI_API_KEY -> 500, feature dead (voice.js:39-42) (2 ms)
    √ extension 2b: unparseable model reply -> 422 with the raw text echoed (voice.js:71-75) (3 ms)
    √ extension 2c: upstream Gemini HTTP error status is passed through (voice.js:83-87) (4 ms)
    × [DOC EXPECTATION] a food-ordering app's voice feature should be able to add an item or place an order (EXPECTED TO FAIL — the action list is 5 navigation commands only, voice.js:6-12) (8 ms)

Tests:       1 failed, 8 passed, 9 total
```

Command run: `npx jest tests/uc13-sales-insights.test.js --no-coverage --verbose`

```
PASS tests/uc13-sales-insights.test.js
  UC13: Review sales performance (Restaurant)
    √ main success scenario: returns exactly the restaurant's own orders (orders.js:113-142) (33 ms)
    √ data contract for the client-side aggregation: totalAmount, status, and serialized dates are present (orders.js:127-137) (20 ms)
    √ extension 2a: missing restaurantId -> 400 (orders.js:119) (3 ms)
    √ extension 2b (documented cost): the endpoint returns the FULL raw order list — no server-side aggregation, pagination, or date filtering exists for the insights view (19 ms)

Tests:       4 passed, 4 total
```

Command run: `npx jest tests/uc14-manage-menu.test.js --no-coverage --verbose`

```
FAIL tests/uc14-manage-menu.test.js
    √ main success scenario: restaurant adds/edits menu items and customers see the update (restaurant.js: GET/PUT /menu) (96 ms)
    √ extension 1a: missing ownerId on GET /menu -> 400 (restaurant.js:83) (2 ms)
    √ extension 3a: PUT /menu with an invalid body fails express-validator -> 400 (restaurant.js:116) (3 ms)
    √ extension 3b: PUT /menu for an ownerId with no matching restaurant user -> 404 (restaurant.js:131) (20 ms)
    √ MISMATCH vs usecases.md 3c: PUT /profile for a restaurant with NO existing restaurant record does not "silently create" one -- it 500s (restaurant.js:51, Restaurant.findByOwnerId is undefined) (29 ms)
    √ follow-up: the same PUT /profile crash also happens when a Restaurant record already exists -- proving the endpoint is unconditionally broken, not just the "no prior restaurant" edge case (20 ms)
    √ BONUS FINDING: GET /profile is a stub -- always returns { user: null, restaurant: null } regardless of the caller (restaurant.js:8-20) (5 ms)
    × [DOC EXPECTATION] usecases.md 3c: PUT /profile should silently create a restaurant when none exists (EXPECTED TO FAIL -- see MISMATCH test above for the real behavior) (20 ms)
Test Suites: 1 failed, 1 total
Tests:       1 failed, 7 passed, 8 total
```

Command run: `npx jest tests/uc15-claim-delivery.test.js --no-coverage --verbose`

```
console.log
    UC15 race repro: { statusA: 200, statusB: 200, finalDeliveryPartnerId: 'rider-B' }

PASS tests/uc15-claim-delivery.test.js
  UC15: Claim a delivery job (Delivery partner)
    √ main success scenario: partner accepts a ready, unassigned order and it is assigned to them (delivery.js: POST /accept/:orderId) (163 ms)
    √ extension 2a: another partner got it first -> 409 (delivery.js:111) (172 ms)
    √ extension 2b: order no longer ready -> 400 (delivery.js:116) (33 ms)
    √ extension 2c: partner record not found -> 400 (delivery.js:123) (62 ms)
    √ extension 2d: partner already has an active order -> 400, one-at-a-time (delivery.js:134) (61 ms)
    √ RACE CONDITION: two partners concurrently claim the same ready order -- at most one may end up assigned (125 ms)
    √ main scenario step 1: GET /available lists only ready, unassigned orders (delivery.js:299-331) (30 ms)
    √ extension 2e: POST /reject releases a claimed order back to ready/unassigned (delivery.js:164-191) (165 ms)
    √ BONUS FINDING: POST /reject never checks the caller was the assigned partner -- an uninvolved rider can un-assign someone else's claimed order (delivery.js:164-191) (152 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

Command run: `npx jest tests/uc16-pickup-deliver.test.js --no-coverage --verbose`

```
FAIL tests/uc16-pickup-deliver.test.js
    √ extension 1a: pickup never checks the order exists -- updates blind, and on a NONEXISTENT order that surfaces as an uncontrolled 500, not a clean 404 (delivery.js:204-209) (65 ms)
    √ extension 1a (continued): pickup also blindly overwrites status on an order that exists but is NOT in a pickup-appropriate state (36 ms)
    √ extension 2a: order not found at delivery -> 404 (delivery.js:234-236) (18 ms)
    √ STAR FINDING (clean case): Partner B, never assigned, completes Partner A's delivery and is credited -- Partner A gets nothing (delivery.js:223-268) (337 ms)
    √ UNRELATED BUG: completing a delivery for a rider with no other active order 500s AFTER already recording the delivery and paying out (delivery.js:278, User.updateDeliveryStatus is undefined) (264 ms)
    √ STAR FINDING (common case, response is 500 due to the unrelated bug above, but the state corruption still fully lands) (290 ms)
    √ note (time-permitting): an unreasonably large deliveryFee/tipAmount is accepted and paid out with no upper bound (delivery.js:244) (249 ms)
    √ GET /orders (a rider reviewing their assignments) includes a computed earning field (delivery.js:37-85) (94 ms)
    √ GET /orders requires a riderId -> 400 (delivery.js:42-44) (3 ms)
    × [DOC EXPECTATION] only the assigned delivery partner should be able to complete an order and be paid (EXPECTED TO FAIL -- see STAR FINDING above for the real behavior) (245 ms)
Test Suites: 1 failed, 1 total
Tests:       1 failed, 9 passed, 10 total
```

Command run: `npx jest tests/uc17-delivery-map.test.js --no-coverage --verbose`

```
PASS tests/uc17-delivery-map.test.js
  UC17: Watch my delivery on a map (Customer) — source inspection
    √ the map is consumed ONLY by the customer order page — no delivery-partner screen references it (whole client/src scan) (12 ms)
    √ the page itself labels the feature a simulation: a visible <h3>Delivery Simulation</h3> heading (Orders.tsx:503) (1 ms)
    √ the courier position is linearly interpolated between two fixed points (DeliveryMap.tsx interpolate/startDeliveryAnimation)
    √ the animation is a hardcoded 20 steps on a 1000 ms setInterval — 20 seconds regardless of any real delivery (DeliveryMap.tsx:89-104) (1 ms)
    √ the animation is started by a button the customer presses, not by order state (DeliveryMap.tsx "Start Delivery")
    √ no real position source can reach the component: its full props contract is {restaurant, customer, onDelivered?} (DeliveryMap.tsx:8-12) (1 ms)

Tests:       6 passed, 6 total
```

Command run: `npx jest tests/uc18-delivery-earnings.test.js --no-coverage --verbose`

```
PASS tests/uc18-delivery-earnings.test.js
  UC18: Review my delivery earnings (Delivery partner)
    √ main success scenario: GET /orders exposes a computed per-order earning = deliveryFee + tipAmount (delivery.js:58-61) (32 ms)
    √ missing riderId -> 400 (delivery.js:42-44) (3 ms)
    √ non-numeric deliveryFee/tipAmount coerce to 0 in the displayed earning, not NaN (delivery.js:58-60) (18 ms)
    √ server-side bookkeeping: totalEarnings accumulates across deliveries (delivery.js:266-268, User.js:153-166) (355 ms)
    √ two-bookkeeping-systems finding: totalEarnings is written on delivery but GET /orders never serves it — the client recomputes from the order list instead (delivery.js:47-77, Insights.tsx:23-43) (21 ms)

Tests:       5 passed, 5 total
```

Command run: `npx jest tests/uc20-donation-impact.test.js --no-coverage --verbose`

```
PASS tests/uc20-donation-impact.test.js
  UC20: See the donation impact (Meal-for-a-Meal)
    √ main success scenario: meals donated = floor(delivered/10) (donations.js:15) (80 ms)
    √ main scenario edge case: zero delivered orders -> zero meals donated (52 ms)
    √ extension 2a (partial): POST /update rejects zero/negative meal amounts -> 400 (donations.js:47) (27 ms)
    √ STAR FINDING: any unauthenticated caller can inflate the stored donation counter without bound (donations.js:59) (125 ms)
    √ the counter has no upper bound and keeps compounding across repeated calls (donations.js:59) (93 ms)
    √ POST /record logs a donation entry (donations.js:96-126) (45 ms)
    √ POST /record rejects zero/negative amounts -> 400 (donations.js:101) (8 ms)
    √ GET /history returns recorded donations, most recent first (donations.js:76-94) (25 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

## Results and traceability

The per-test rows for all ten suites live in the shared tables —
`results-table.md` and `traceability-table.md` (both ordered by UC) — rather
than being duplicated here.

## Project's own tests: coverage and blind spots

The repository's inherited test suite, `proj2/tests/example.test.js`, contains 151 tests
over 28 business-logic helper functions (points math, status-transition validity, role
checks, currency/tax formatting, etc.) — but it **cannot run at all**. It imports
`../src/utils/businessLogic` (line 30), and that file does not exist in the current
checkout.

This isn't a case of the file "never being written" — `git log --all --name-status --
proj2/src/utils/businessLogic.js` shows it was added, modified, and then **deleted**:

1. `a5bc8eb` — added
2. `f75213b` — modified
3. `88bedaf` ("feat: add more missions, define more flexible structure for adding
   badges") — deleted

All three commits predate this team's fork, so this is a regression inherited from the
prior project's own history, not something introduced here — the badges/missions refactor
deleted a file an unrelated test suite depended on, and nobody caught it. That's a clean,
concrete example of "old code rots," straight from the assignment brief.

Main blind spots in the inherited suite:

- No API/route-level integration tests exist anywhere in the repo for auth, orders,
  points, delivery, or donations — `supertest` is installed as a devDependency in
  `server/package.json` and is never once required by any file.
- Zero tests exercise the actual HTTP layer (status codes, response bodies) that UC10,
  UC14, UC15, UC16, and UC20 all live in.
- None of the validation gaps this assignment surfaced (missing ownership checks,
  missing transactions, undefined methods, unbounded numeric inputs) were caught by
  anything already in the repo — they were only found by writing new use-case-level
  tests against the live routes.
- The suite that does exist can't even be executed, so in practice its real coverage of
  anything is zero, not "narrow", it's a hard blocker, not a gap.

In short: the inherited suite is (or was, before the deletion) useful for pure-function
business logic, but provides no evidence at all about whether the actual user-facing
flows in UC10/UC14/UC15/UC16/UC20 work. The new tests above are the only coverage that
exists for these use cases at any level.
