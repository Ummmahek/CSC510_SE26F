# D3 — Test results table

One row per test we wrote. "Expected" states what the use case / README
promises — not what the code does — so a FAIL reads as a defect found, not a
mistake made. Keep raw output samples in `proj1a-report/raw-output/`.
Failures are findings: explain them, never hide them.

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| `test_rejects_redeeming_more_points_than_available` | UC6 ext 3a: balance must cover request | 400 with available vs. requested | *(run and fill in)* |
| `test_redeem_converts_at_one_cent_per_point` | UC6 step 4: stated conversion rate | 500 points → $5.00 discount | *(run and fill in)* |
| `test_concurrent_redemptions_cannot_double_spend` | UC6 ext 5a: no transaction around read-then-update (`points.js:82–127`) | Second redemption refused | *(expect FAIL — real bug)* |
| `test_earn_rate_matches_readme_ten_percent` | README says 10% of bill; code awards 1 pt/$ (`points.js:195`) | $50 order → 5 points | *(expect FAIL — docs/code disagree)* |

## UC10, UC14, UC15, UC16, UC20 (see `proj2/tests/uc10-redeem-points.test.js`, `uc14-manage-menu.test.js`, `uc15-claim-delivery.test.js`, `uc16-pickup-deliver.test.js`, `uc20-donation-impact.test.js` — 41 tests total, all passing, `npx jest tests/uc*.test.js --no-coverage --verbose` from `proj2/`)

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC14 main flow: add/edit menu items | Cover the happy path | 200, menu persisted and readable via GET | PASS |
| UC14 ext 1a: missing ownerId on GET /menu | Doc'd extension | 400 | PASS |
| UC14 ext 3a: PUT /menu invalid body | Doc'd extension | 400 | PASS |
| UC14 ext 3b: PUT /menu unknown ownerId | Doc'd extension | 404 | PASS |
| UC14 ext 3c: PUT /profile "silently creates" a restaurant | usecases.md says 200 silent creation | 200 | **FAIL as predicted by the doc — but for the wrong reason.** `Restaurant.findByOwnerId()` (`restaurant.js:51`) is called but never defined anywhere on the model. Every call to PUT /profile 500s unconditionally (confirmed with and without a pre-existing restaurant record) — worse than the doc describes, not a silent-creation bug at all. |
| UC14 new: GET /profile | Endpoint exists, untested by the doc | Some response reflecting caller identity | **FAIL/finding** — it's a dead stub, always returns `{ user: null, restaurant: null }` regardless of input |
| UC20 main flow: floor(delivered/10) | Cover the happy path | 3 meals for 37 delivered orders | PASS |
| UC20 ext 2a: reject zero/negative mealsToAdd | Doc'd guard (`donations.js:47`) | 400 | PASS |
| UC20 star finding: unauthenticated counter inflation | Doc flags no bound on the increment endpoint (`donations.js:59`) | Some limit or auth check | **FAIL/finding** — any caller sets the stored counter to an arbitrary value (999,999,999 in one call), no auth, no bound |
| UC20 new: POST /record, GET /history | Untested by the doc | Log + retrieve donation entries correctly | PASS |
| UC10 main flow: redeem at 1pt = $0.01 | Cover the happy path | Balance deducted, transaction logged | PASS |
| UC10 ext 2a/3a/3b: invalid points, insufficient balance, no record | Doc'd guards (`points.js:69, 92-97, 85-88`) | 400 / 400 / 404 | PASS |
| UC10 star finding: concurrent redemption double-spend | Doc flags no transaction around read-then-update (`points.js:82-127`) | Second concurrent redemption refused | **FAIL as a vulnerability, but not exactly as predicted.** Both concurrent requests get 200 (real double-spend: 120 pts of discount off a 100 pt balance). Stored balance lands at 40, not negative — both requests compute the same number off the same stale read. Only 1 of 2 "used" transactions survives in the log — the other is silently overwritten, so the audit trail undercounts the exploit. |
| UC10 new: POST /calculate-discount | Untested by the doc | Preview discount without deducting | PASS |
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

Environment note: Firestore is mocked (`proj2/tests/helpers/fakeFirestore.js`), not the real emulator — Docker/gcloud/firebase-cli weren't available on this machine. If someone on the team has the real emulator running (per D1's note that it worked in Docker), it'd be worth re-running these against it to double check, especially the two concurrency findings.

## UC8, UC11, UC13, UC17, UC18 (see `proj2/tests/uc8-rate-order.test.js`, `uc11-voice-control.test.js`, `uc13-sales-insights.test.js`, `uc17-delivery-map.test.js`, `uc18-delivery-earnings.test.js` — 35 tests, 34 pass + 1 intentional failure, `npx jest tests/uc8-rate-order.test.js tests/uc11-voice-control.test.js tests/uc13-sales-insights.test.js tests/uc17-delivery-map.test.js tests/uc18-delivery-earnings.test.js --no-coverage --verbose` from `proj2/`)

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC8 main + optional review | Happy path (`orders.js:245-303`) | 200, rating stored once | PASS |
| UC8 ext 1a: rating 0 / 6 / 3.5 / "four" | Doc'd validator (`orders.js:246`) | 400 each | PASS |
| UC8 ext 2a/2b/2c/2d: missing order / wrong customer / undelivered / already rated | Doc'd guards (`orders.js:262-278`) | 404 / 403 / 400 / 400 | PASS — and the first rating survives a second attempt |
| UC8 ext 3a: no stored average updated | Doc says averages are derived at read time (`customer.js:97-122`) | Restaurant doc byte-identical before/after rating | PASS (finding confirmed) |
| UC11 main + trim | Happy path (`voice.js:31-77`) | 200 with one of the 5 action ids | PASS (Gemini mocked) |
| UC11 ext 1a/2a/2b: bad input / no API key / unparseable reply | Doc'd guards (`voice.js:35-42,71-75`) | 400 / 500 / 422 | PASS |
| UC11 ext 2c: upstream Gemini HTTP error | Error handler (`voice.js:83-87`) | Upstream status passed through | PASS — a Gemini 429 surfaces as our 429 |
| UC11 [DOC EXPECTATION]: voice can order food | The feature's own name promises ordering | 200 with an ordering action | **FAIL on purpose** — the action list is 5 navigation commands (`voice.js:6-12`); a food-ordering app's voice feature cannot order food |
| UC13 main: only own orders returned | Happy path (`orders.js:113-142`) | 2 of 3 seeded orders | PASS |
| UC13 data contract for client charts | Insights.tsx aggregates client-side | totalAmount/status/parseable dates | PASS |
| UC13 ext 2a: missing restaurantId | Doc'd guard (`orders.js:119`) | 400 | PASS |
| UC13 ext 2b: full raw list, no pagination | Doc'd scalability cost | All 60 seeded orders in one response | PASS (finding confirmed) |
| UC17 source inspection (6 tests) | Client runner broken; assert the fabricated-courier finding on source | Sole consumer is the customer page (whole-src scan); visible "Delivery Simulation" heading; interpolated marker; hardcoded 20 steps x 1000 ms; "Start Delivery" button; props contract admits no real position source | PASS (all findings confirmed in source) |
| UC18 main: GET /orders earning field | Happy path (`delivery.js:58-61`) | earning = deliveryFee + tipAmount | PASS |
| UC18: missing riderId | Doc'd guard (`delivery.js:42-44`) | 400 | PASS |
| UC18: non-numeric fee/tip | Coercion (`delivery.js:58-60`) | 0, not NaN | PASS |
| UC18: totalEarnings accumulates | Server ledger (`User.js:153-166`) | 5 + 5 = 10 after two deliveries | PASS (rider kept "busy" to dodge the known `updateDeliveryStatus` 500) |
| UC18 two-ledgers finding | totalEarnings written but never served | Response shape is orders-only; no order carries totalEarnings, each carries per-order earning | PASS (finding confirmed) |
