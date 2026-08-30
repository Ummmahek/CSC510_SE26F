# Project 1A: Use-case validation notes (UC10, UC14, UC15, UC16, UC20)

## Code link

- Test implementation: `proj2/tests/uc10-redeem-points.test.js`,
  `uc14-manage-menu.test.js`, `uc15-claim-delivery.test.js`,
  `uc16-pickup-deliver.test.js`, `uc20-donation-impact.test.js`
  (shared helpers in `proj2/tests/helpers/`)
- Use-case source: `proj1a-report/usecases.md`
- Existing project test suite: `proj2/tests/example.test.js`

## How to run

From `proj2/`:

```bash
npm install
cd server && npm install && cd ..
npx jest tests/uc10-redeem-points.test.js tests/uc14-manage-menu.test.js tests/uc15-claim-delivery.test.js tests/uc16-pickup-deliver.test.js tests/uc20-donation-impact.test.js --no-coverage --verbose
```

Or one use case at a time, e.g. `npx jest tests/uc16-pickup-deliver.test.js --no-coverage --verbose`.

**Environment note:** Firestore is mocked (`proj2/tests/helpers/fakeFirestore.js`), not
the real Firebase emulator — Docker, `gcloud` and the `firebase` CLI were not available
in this environment, so no local run against the real emulator was possible. The mock
mirrors real Firestore's behavior where it matters for these tests (e.g. `update()` on a
missing document rejects; reads/writes resolve asynchronously so genuine races can
happen), but it is a simulation, not a validated substitute for the emulator. If someone
on the team gets the real emulator running (per `d1-product-choice.md`, it worked in
Docker at least once), it would be worth re-running these against it, especially the two
concurrency tests below.

**Note on PASS/FAIL style, vs. the example table in the assignment brief:** most tests here
assert the *actual observed* behavior directly (so they pass), calling out every place that
diverges from `usecases.md` in the assertions' own comments and in the tables below. For the
3 headline findings, there is now also a companion test asserting what the *doc* promises
instead — these are meant to fail, on purpose, so the demo video has real red output to show,
not just a passing test's comments:

| Test (marked `[DOC EXPECTATION]`) | File | Fails with |
|---|---|---|
| Concurrent redemptions must not exceed the available balance | `uc10-redeem-points.test.js` | `Expected: 1, Received: 2` |
| PUT /profile should silently create a restaurant when none exists | `uc14-manage-menu.test.js` | `Expected: 200, Received: 500` |
| Only the assigned delivery partner should be able to complete an order and be paid | `uc16-pickup-deliver.test.js` | `riderBDoc.data().totalEarnings` expected `0`, received `5` |

Running all 5 files together now reports **3 failed, 41 passed, 44 total** — a genuine
red/green split, not a fully-green suite. The 3 failures are exactly the 3 headline findings;
everything else stays green because it documents actual behavior directly.

## Raw test output samples

Command run: `npx jest tests/uc14-manage-menu.test.js --no-coverage --verbose`

```
PASS tests/uc14-manage-menu.test.js
  UC14: Manage the menu (Restaurant)
    √ main success scenario: restaurant adds/edits menu items and customers see the update (restaurant.js: GET/PUT /menu) (141 ms)
    √ extension 1a: missing ownerId on GET /menu -> 400 (restaurant.js:83) (4 ms)
    √ extension 3a: PUT /menu with an invalid body fails express-validator -> 400 (restaurant.js:116) (6 ms)
    √ extension 3b: PUT /menu for an ownerId with no matching restaurant user -> 404 (restaurant.js:131) (33 ms)
    √ MISMATCH vs usecases.md 3c: PUT /profile for a restaurant with NO existing restaurant record does not "silently create" one -- it 500s (restaurant.js:51, Restaurant.findByOwnerId is undefined) (47 ms)
    √ follow-up: the same PUT /profile crash also happens when a Restaurant record already exists -- proving the endpoint is unconditionally broken, not just the "no prior restaurant" edge case (32 ms)
    √ BONUS FINDING: GET /profile is a stub -- always returns { user: null, restaurant: null } regardless of the caller (restaurant.js:8-20) (8 ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
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

Command run: `npx jest tests/uc10-redeem-points.test.js --no-coverage --verbose`

```
UC10: Redeem points for a discount (Customer)
    √ main success scenario: redeem points at 1 point = $0.01, balance deducted and redemption logged (points.js:68-140) (110 ms)
    √ extension 2a: points < 1 or non-integer -> 400 (points.js:69) (16 ms)
    √ extension 3a: insufficient balance -> 400 with available vs. requested points (points.js:92-97) (30 ms)
    √ extension 3b: no points record for the customer -> 404 (points.js:85-88) (31 ms)
    √ STAR FINDING: concurrent redemptions double-spend a balance that should only cover ONE of them (points.js:82-127, no transaction around read-then-update) (77 ms)
    √ POST /calculate-discount previews the discount WITHOUT deducting any points (points.js:142-186) (63 ms)
    √ POST /calculate-discount: insufficient balance -> 400, same guard as /use (points.js:166-172) (33 ms)
    √ POST /calculate-discount: no points record -> 404 (points.js:159-161) (30 ms)

Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
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
console.error
    Deliver order error: TypeError: rider.updateDeliveryStatus is not a function
        at updateDeliveryStatus (proj2/server/routes/delivery.js:278:21)

PASS tests/uc16-pickup-deliver.test.js
  UC16: Pick up and deliver an order (Delivery partner)
    √ extension 1a: pickup never checks the order exists -- updates blind, and on a NONEXISTENT order that surfaces as an uncontrolled 500, not a clean 404 (delivery.js:204-209) (113 ms)
    √ extension 1a (continued): pickup also blindly overwrites status on an order that exists but is NOT in a pickup-appropriate state (56 ms)
    √ extension 2a: order not found at delivery -> 404 (delivery.js:234-236) (29 ms)
    √ STAR FINDING (clean case): Partner B, never assigned, completes Partner A's delivery and is credited -- Partner A gets nothing (delivery.js:223-268) (473 ms)
    √ UNRELATED BUG: completing a delivery for a rider with no other active order 500s AFTER already recording the delivery and paying out (delivery.js:278, User.updateDeliveryStatus is undefined) (351 ms)
    √ STAR FINDING (common case, response is 500 due to the unrelated bug above, but the state corruption still fully lands) (370 ms)
    √ note (time-permitting): an unreasonably large deliveryFee/tipAmount is accepted and paid out with no upper bound (delivery.js:244) (338 ms)
    √ GET /orders (a rider reviewing their assignments) includes a computed earning field (delivery.js:37-85) (158 ms)
    √ GET /orders requires a riderId -> 400 (delivery.js:42-44) (4 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

**Combined total: 41 / 41 passing** across all 5 files
(`npx jest tests/uc*.test.js --no-coverage`, ~3.5s).

## Results table

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC14 main flow: add/edit menu items | Cover the happy path | 200, menu persisted and readable via GET | PASS |
| UC14 ext 1a: missing ownerId on GET /menu | Doc'd extension | 400 | PASS |
| UC14 ext 3a: PUT /menu invalid body | Doc'd extension | 400 | PASS |
| UC14 ext 3b: PUT /menu unknown ownerId | Doc'd extension | 404 | PASS |
| UC14 ext 3c: PUT /profile "silently creates" a restaurant | usecases.md says 200, silent creation | 200 | **Mismatch.** `Restaurant.findByOwnerId()` (`restaurant.js:51`) is called but never defined on the model. PUT /profile 500s unconditionally — with or without a pre-existing restaurant record. Worse than "silent creation," and not the specific bug the doc describes. |
| UC14 new: GET /profile | Endpoint exists, untested by the doc | Some response reflecting the caller | **Finding.** Dead stub — always returns `{ user: null, restaurant: null }` regardless of input. |
| UC20 main flow: floor(delivered/10) | Cover the happy path | 3 meals for 37 delivered orders | PASS |
| UC20 ext 2a: reject zero/negative mealsToAdd | Doc'd guard (`donations.js:47`) | 400 | PASS |
| UC20 star finding: unauthenticated counter inflation | Doc flags no bound on the increment endpoint (`donations.js:59`) | Some limit or auth check | **Finding, confirmed.** Any caller sets the counter to an arbitrary value (999,999,999 in one call), no auth, no bound. Nuance: `GET /stats` never reads that counter back into its response, so the tampering doesn't (yet) reach what a customer sees. |
| UC20 new: POST /record, GET /history | Untested by the doc | Log + retrieve donation entries correctly | PASS |
| UC10 main flow: redeem at 1pt = $0.01 | Cover the happy path | Balance deducted, transaction logged | PASS |
| UC10 ext 2a/3a/3b: invalid points, insufficient balance, no record | Doc'd guards (`points.js:69, 92-97, 85-88`) | 400 / 400 / 404 | PASS |
| UC10 star finding: concurrent redemption double-spend | Doc flags no transaction around read-then-update (`points.js:82-127`) | Second concurrent redemption refused | **Finding, confirmed, but not exactly as predicted.** Both concurrent requests get 200 (real double-spend: 120 pts of discount off a 100-pt balance). Stored balance lands at 40, not negative — both requests compute the same number off the same stale read. Only 1 of 2 "used" transactions survives in the log. |
| UC10 new: POST /calculate-discount | Untested by the doc | Preview discount without deducting | PASS |
| UC15 main flow + ext 2a-2d | Doc'd extensions (`delivery.js:111,116,123,134`) | 200 / 409 / 400 / 400 / 400 | PASS |
| UC15 race: two partners claim the same order concurrently | Doc/brief predicts "exactly one 200, one 409" | One 200, one 409 | **Finding, same root cause as UC10.** No transaction around read-check-write (`delivery.js:100-146`); both requests get 200, deterministic across reruns. |
| UC15 new: GET /available, POST /reject | Untested by the doc | List ready+unassigned; release a claim back to ready | PASS |
| UC15 new finding: POST /reject has no ownership check | Found while adding /reject coverage | Only the assigned partner can reject | **Finding.** An uninvolved partner can un-assign someone else's legitimately claimed order — same bug shape as the UC16 headline finding. |
| UC16 ext 1a: pickup never checks order exists | Doc'd extension (`delivery.js:204-209`) | Some handled error | **Finding.** Uncontrolled 500 (not a clean 404) on a nonexistent order; also blindly overwrites status on an order in the wrong state. |
| UC16 ext 2a: deliver on nonexistent order | Doc'd extension | 404 | PASS |
| UC16 star finding: wrong-partner delivery theft | Headline security bug per the brief | Only the assigned partner can complete + get paid | **Finding, fully confirmed.** Partner B (never assigned) completes Partner A's delivery; order marked delivered; Partner B credited $5; Partner A credited $0. `delivery.js:223-268` never compares caller vs. assigned partner. |
| UC16 new finding: `User.updateDeliveryStatus` undefined | Found while building the fixture above | Delivery completion succeeds cleanly | **Finding.** Completing a delivery 500s in the *normal* case (rider has no other active order), after the order/points/earnings have already been persisted. |
| UC16 new: unbounded fee/tip payout | Doc flags no cap (`delivery.js:244`) | Some cap | **Finding.** $999,999 + $999,999 credited with zero limit. |
| UC16 new: GET /orders earning field | Untested by the doc | Computed `earning` = deliveryFee + tipAmount | PASS |

## Findings and explanations

**UC14 — PUT /profile is completely broken, not just the "silent creation" edge case.**
`restaurant.js:51` calls `Restaurant.findByOwnerId(user.id)`, but that method is never
defined anywhere on the `Restaurant` model (confirmed by grepping the whole repo). Calling
it throws a `TypeError`, caught by the route's own `catch`, surfacing as a 500 — for every
call, regardless of whether a restaurant record already exists. `usecases.md`'s claim that
this path "silently creates" a restaurant does not hold.

**UC20 — the counter-inflation vulnerability is real, but doesn't (yet) reach the customer.**
`donations.js:59` lets any unauthenticated caller add an arbitrary amount to the stored
`counter` field, with only a zero/negative check. But `GET /stats` (the endpoint the
customer-facing donation display actually calls) never reads that field into its
response — it always recomputes `floor(deliveredOrders / 10)` fresh. So the write-side hole
is fully exploitable, but its stated consequence ("displayed count matches the tampered
counter") isn't currently true.

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

## Traceability table: tests ↔ use cases

| Test case | Use case | Coverage | Notes |
|---|---|---|---|
| `uc14-manage-menu.test.js` (7 tests) | UC14: Manage the menu | Yes | Main flow + all documented extensions; disproves the "silent creation" claim; new finding: GET /profile is a dead stub |
| `uc20-donation-impact.test.js` (8 tests) | UC20: See the donation impact | Yes | Main flow + guard; confirms unauthenticated counter inflation; new: POST /record, GET /history covered |
| `uc10-redeem-points.test.js` (8 tests) | UC10: Redeem points for a discount | Yes | Main flow + all documented guards; confirms concurrent double-spend; new: POST /calculate-discount covered |
| `uc15-claim-delivery.test.js` (9 tests) | UC15: Claim a delivery job | Yes | Main flow + all documented extensions; confirms claim race; new finding: POST /reject has no ownership check |
| `uc16-pickup-deliver.test.js` (9 tests) | UC16: Pick up and deliver an order | Yes | Main flow extensions + headline wrong-partner-delivery-theft finding; new finding: undefined `User.updateDeliveryStatus` crashes the common case |

### Orphans — use cases with no test in this set

None — all 5 assigned use cases (UC10, UC14, UC15, UC16, UC20) have coverage. (The
remaining 15 use cases are covered by other team members' test files; see the top-level
`results-table.md` / `traceability-table.md` for the full 20-UC picture.)

### Orphans — tests mapped to no use case

None.

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
