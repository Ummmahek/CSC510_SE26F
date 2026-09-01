# D4 — Traceability (UC1, UC3, UC4, UC5, UC7)

Partial D4 covering the five use cases owned by this author. Merge into
`traceability-table.md`: the rows below go under "Our tests ↔ use cases", the
orphan notes under the existing orphan headings, and the "project's own tests"
section fills part of that file's open TODO ("map the 151 test names onto our 20
use cases") for these five.

One row per test. Each row connects one test to one use case (and, where
relevant, the specific extension it exercises), so the table shows our tests
cover the reverse-engineered design point by point.

## Our tests ↔ use cases

| Test | Use case(s) | What it proves |
|---|---|---|
| UC1 main flow: valid registration | UC1 | Happy path — `/register` creates the account and returns a payload with no credential in it |
| UC1 main flow: registered user can log in | UC1 | Satisfies UC1's postcondition — the new account authenticates via `/login` |
| UC1 ext 3a: invalid email / short password / unknown role | UC1 (ext 3a) | The three documented input rejections all fire (`auth.js:9-11`) |
| UC1 ext 3b: duplicate email | UC1 (ext 3b) | Email dedup is enforced (`auth.js:23-26`) |
| UC1 finding: geocode failure swallowed on signup | UC1 (ext 2a) → UC4 | An address that fails to geocode still yields 201 with `location: null` — explains how UC4's distance sort can silently have nothing to sort by |
| UC1 finding: empty profile object accepted | UC1 (step 1) | "Fills the role-specific profile" is unvalidated — only `isObject()` (`auth.js:12`) |
| UC1 star finding: password stored in plaintext | UC1 (ext 4a) | Confirms ext 4a against the real store — the submitted password persists verbatim (`auth.js:31`) |
| UC1 `[DOC EXPECTATION]`: stored password must be hashed | UC1 (ext 4a) | Red assertion of the correct behaviour; stays red until `/register` hashes |
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
| UC4 ext 3a: distance sort, missing userId | UC4 (ext 3a) | Guard on the distance endpoint (`customer.js:173-175`) |
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
| UC7 main flow: GET /customer order list | UC7 | Happy path for the tracking list (steps 1-2) |
| UC7: list scoped to the customer | UC7 | `where('customerId', ...)` isolates the caller's orders (`orders.js:93-95`) |
| UC7 ext 2a: missing customerId | UC7 (ext 2a) | Guard fires (`orders.js:89`) |
| UC7: customer with no orders | UC7 | Empty history is a valid 200 state, not an error |
| UC7 star finding: confirmedAt tracks the wrong transition | UC7 (ext 2c) | Confirms ext 2c — `confirmedAt` is stamped on `→ preparing`, not `→ confirmed` (`orders.js:202`) |
| UC7 finding: GET /:id is a stub | UC7 | Single-order lookup returns hardcoded mock data for any id and never reads the store (`orders.js:157-180`) |
| UC7 ext 2b: transitions unvalidated | UC7 (ext 2b), UC12 (ext 3a) | Status accepts any enum from any state — an order reaches `delivered` with no intermediate milestones (`orders.js:184`) |
| UC7 `[DOC EXPECTATION]`: GET /:id returns the real order | UC7 | Red assertion of the correct behaviour; stays red until `/:id` reads Firestore |

### Orphans — use cases with no test

None among UC1, UC3, UC4, UC5, UC7 — each has at least one test above, covering
the main scenario plus the documented extensions.

### Orphans — tests mapped to no use case

None — every test names the use case (and extension) it exercises.

## Verdict on the project's own tests — do they cover UC1, UC3, UC4, UC5, UC7? Where are they blind?

The project's own suite is `proj2/tests/example.test.js` — 151 tests over a
`../src/utils/businessLogic` module. It is **unrunnable** (that module was
deleted before our fork — see the main D4 verdict section), but its test *names*
are readable, so intent can still be judged.

| UC | Nearest own-test coverage (by name) | Blind to |
|---|---|---|
| **UC1** | `isValidUserRole`, `getDefaultDeliveryStatus`, `validateEmail`, `validatePhoneNumber` — standalone validators | The `/register` route itself: duplicate-email rejection, password storage, geocoding, the response shape |
| **UC3** | `validateEmail`, `validatePhoneNumber` only | All four profile endpoints, address re-geocoding, the whole-map overwrite, the contract divergence between endpoints |
| **UC4** | `isLocalLegend`, `calculateDeliveryTime`, `calculateDeliveryFee` — restaurant-attribute helpers | `GET /restaurants` and `/restaurants-by-distance`: the rating aggregation, the Haversine sort, the `profile.name` filter, the `restaurants[1]` crash |
| **UC5** | `calculateOrderTotal`, `isValidOrder` — cart-total / line-item math on a hypothetical helper | `CartContext` itself: quantity merging, persistence, cross-restaurant carts — none of the actual React state logic |
| **UC7** | `isValidStatusTransition` (~20 tests) — asserts a full order state machine | `orders.js` has **no such state machine**; the own suite tests transition rules the shipped code never implements. Also blind to `GET /customer`, the mock `GET /:id`, and the `confirmedAt` mislabel |

**Overall:** the project's own tests aim exclusively at pure helper functions in
a `businessLogic` module that (a) does not ship and (b) sits a layer *below*
every real entry point. Not one of them drives an Express route or a React
context. Our tests reach each of UC1/3/4/5/7 through its actual interface (an
HTTP route, or the `useCart` hook). `isValidStatusTransition` is the sharpest
illustration of the blindness: ~20 passing-by-name tests encode an order state
machine that `orders.js` simply does not have — which is exactly how UC7's
"jump straight to delivered" defect survived.
