# Project 1A: Use-case validation notes (UC8, UC11, UC13, UC17, UC18)

Companion to `uc-validation-notes.md` (UC10/14/15/16/20, PR #1). Kept as a
separate file so the two branches don't conflict; consolidate after both merge.

## Code link

- Tests: `proj2/tests/uc8-rate-order.test.js`, `uc11-voice-control.test.js`,
  `uc13-sales-insights.test.js`, `uc17-delivery-map.test.js`,
  `uc18-delivery-earnings.test.js` (shared helpers in `proj2/tests/helpers/`,
  reused verbatim from PR #1)
- Use-case source: `proj1a-report/usecases.md`

## How to run

From `proj2/` (after `npm install` at root and in `server/`):

```bash
npx jest tests/uc8-rate-order.test.js tests/uc11-voice-control.test.js tests/uc13-sales-insights.test.js tests/uc17-delivery-map.test.js tests/uc18-delivery-earnings.test.js --no-coverage --verbose
```

Expected: **35 tests — 34 pass, 1 intentional failure** (the `[DOC EXPECTATION]`
test in UC11, kept red on purpose for the demo video, same convention as PR #1).

## Environment assumptions (stated, not hidden)

- Firestore is mocked with PR #1's `fakeFirestore.js` for UC8/13/18. UC11 needs
  no database at all — its only external dependency is the Gemini HTTP API,
  which is mocked at the exact axios entry file the server code resolves
  (`axios/dist/node/axios.cjs`). Two resolution traps are documented in the
  test header: a bare `jest.mock('axios')` fails loudly (axios only exists in
  `server/node_modules`), while mocking the package *directory* resolves to a
  different registry key (`index.js`), silently mocks nothing, and lets the
  suite make REAL calls to Google — the second one is the dangerous trap.
- UC17 is client-only and the inherited client test runner cannot load the app
  (react-router-dom v7 vs CRA 5 Jest). Its tests are **source-inspection
  tests**: they assert the fabricated-courier finding directly against the
  component source with cited lines, and this limitation is declared rather
  than papered over.

## Results table rows

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC8 main + optional review | Happy path (`orders.js:245-303`) | 200, rating stored once | PASS |
| UC8 ext 1a: rating 0 / 6 / 3.5 / "four" | Doc'd validator (`orders.js:246`) | 400 each | PASS |
| UC8 ext 2a/2b/2c/2d: missing order / wrong customer / undelivered / already rated | Doc'd guards (`orders.js:262-278`) | 404 / 403 / 400 / 400 | PASS — and the first rating survives a second attempt |
| UC8 ext 3a: no stored average updated | Doc says averages are derived at read time (`customer.js:97-122`) | Restaurant doc untouched by rating | PASS (finding confirmed) |
| UC11 main + trim | Happy path (`voice.js:31-77`) | 200 with one of the 5 action ids | PASS (Gemini mocked) |
| UC11 ext 1a/2a/2b: bad input / no API key / unparseable reply | Doc'd guards (`voice.js:35-42,71-75`) | 400 / 500 / 422 | PASS |
| UC11 ext 2c: upstream HTTP error | Error handler (`voice.js:83-87`) | Upstream status passed through | PASS — a Gemini 429 surfaces as our 429 |
| UC11 [DOC EXPECTATION]: voice can order food | The feature's own name promises ordering | 200 with an ordering action | **FAIL on purpose** — the action list is 5 navigation commands (`voice.js:6-12`); a food-ordering app's voice feature cannot order food |
| UC13 main: only own orders returned | Happy path (`orders.js:113-142`) | 2 of 3 seeded orders | PASS |
| UC13 data contract for client charts | Insights.tsx aggregates client-side | totalAmount/status/parseable dates | PASS |
| UC13 ext 2a: missing restaurantId | Doc'd guard (`orders.js:119`) | 400 | PASS |
| UC13 ext 2b: full raw list, no pagination | Doc'd scalability cost | All 60 seeded orders in one response | PASS (finding confirmed) |
| UC17 source inspection (6 tests) | Client runner broken; assert the fabricated-courier finding on source | Sole consumer is the customer page (whole-src scan); visible "Delivery Simulation" heading; interpolated marker; hardcoded 20 steps × 1000 ms; "Start Delivery" button; props contract admits no real position source | PASS (all findings confirmed in source) |
| UC18 main: GET /orders earning field | Happy path (`delivery.js:58-61`) | earning = deliveryFee + tipAmount | PASS |
| UC18: missing riderId | Doc'd guard (`delivery.js:42-44`) | 400 | PASS |
| UC18: non-numeric fee/tip | Coercion (`delivery.js:58-60`) | 0, not NaN | PASS |
| UC18: totalEarnings accumulates | Server ledger (`User.js:153-166`) | 5 + 5 = 10 after two deliveries | PASS (rider kept "busy" to dodge the known `updateDeliveryStatus` 500 from PR #1) |
| UC18 two-ledgers finding | totalEarnings written but never served | Response shape is orders-only; no order carries totalEarnings, each carries per-order earning | PASS (finding confirmed) |

## Traceability additions

| Test file | Use case | What it proves |
|---|---|---|
| `uc8-rate-order.test.js` (11) | UC8 | All five documented guards hold; rating is immutable once set; no stored average exists (derived at read) |
| `uc11-voice-control.test.js` (9) | UC11 | All guards hold with Gemini mocked; upstream errors pass through; the headline gap (no ordering action) is pinned by an intentional red test |
| `uc13-sales-insights.test.js` (4) | UC13 | Server returns exactly the restaurant's raw orders with the fields the browser aggregation needs; no server-side aggregation/pagination exists |
| `uc17-delivery-map.test.js` (6) | UC17 | The customer-facing "tracking" map is a hardcoded 20-step/1s-tick simulation with no real position source (source-inspection; client runner broken as inherited) |
| `uc18-delivery-earnings.test.js` (5) | UC18 | Displayed earnings are computed per-order; the server's totalEarnings ledger is write-only and can diverge silently |

Remaining gaps after this branch + PR #1: UC1–7, UC9, UC12, UC19 (assigned to
the other two members per the team split).
