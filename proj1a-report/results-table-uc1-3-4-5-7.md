# D3 — Test results table (UC1, UC3, UC4, UC5, UC7)

Partial D3 covering the five use cases owned by this author. Merge into
`results-table.md` alongside the UC10/14/15/16/20 section.

One row per test. "Expected" states what the use case / README promises — not
what the code does — so a FAIL reads as a defect found, not a mistake made.
Following the house convention in `results-table.md`: a row is marked
**FAIL/finding** when it documents a defect *even if the Jest test itself
passes* (the test asserts the actual behaviour; the row judges that behaviour
against the use case). Rows marked **FAIL (by design)** are the deliberately
red `[DOC EXPECTATION]` assertions — each pairs with a green
STAR/FINDING row and stays red until the app is fixed.

Failures are findings: explained here, never hidden.

## Test files + how to run

| Use case | Test file | Runner |
|---|---|---|
| UC1 | `proj2/tests/uc1-signup-role.test.js` | node Jest |
| UC3 | `proj2/tests/uc3-manage-profile.test.js` | node Jest |
| UC4 | `proj2/tests/uc4-browse-restaurants.test.js` | node Jest |
| UC7 | `proj2/tests/uc7-track-order.test.js` | node Jest |
| UC5 | `proj2/client/src/contexts/uc5-build-cart.test.tsx` | CRA / jsdom (`react-scripts test`) |

- Server UCs, from `proj2/`:
  `npx jest tests/uc1-signup-role.test.js tests/uc3-manage-profile.test.js tests/uc4-browse-restaurants.test.js tests/uc7-track-order.test.js --no-coverage --verbose`
- UC5, from `proj2/client/`:
  `CI=true npx react-scripts test src/contexts/uc5-build-cart.test.tsx --verbose`

**36 tests total: 32 passing, 4 deliberate red `[DOC EXPECTATION]` assertions.**

Raw output samples: `proj1a-report/raw-output/uc1-uc3.txt`, `uc4-uc5.txt`, `uc7.txt`.

## Environment note

Firestore is mocked (`proj2/tests/helpers/fakeFirestore.js`), not the real
emulator — Docker / gcloud / firebase-cli weren't available on this machine.
We also added `QuerySnapshot.forEach()` to that fake: real Firestore has it and
`customer.js`'s rating aggregation relies on it; the existing UC10/14/15/16/20
suite is unaffected (still 41 pass / 3 by-design fail). UC5 is client-only
(there is no cart endpoint — every UC5 extension in `usecases.md` is "not
handled server-side"), so it runs under the `proj2/client` CRA/jsdom runner
rather than the node Jest suite. If someone has the real emulator running, it
would be worth re-running the server UCs against it.

## UC1 — Sign up with a role

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC1 main flow: valid registration | Cover the happy path | 201, account created, credential not echoed | PASS |
| UC1 main flow: registered user can log in | UC1 postcondition "user can log in" | Same credentials authenticate via `/login` | PASS |
| UC1 ext 3a: invalid email / short password / unknown role | Doc'd extension (`auth.js:9-11`) | 400 | PASS |
| UC1 ext 3b: duplicate email | Doc'd extension (`auth.js:23-26`) | 400 | PASS |
| UC1 finding: geocode failure swallowed on signup | usecases.md ext 2a — address resolution needs a Maps key | Address handled, or signup fails cleanly | **FAIL/finding** — 201 with `location: null`, the geocode error is swallowed (`models/User.js:46-49`); the account has no coordinates and nothing signals it |
| UC1 finding: empty profile object accepted | Step 1 says "fills the role-specific profile" | Role-specific fields required | **FAIL/finding** — `profile: {}` → 201; only `isObject()` is checked (`auth.js:12`) |
| UC1 star finding: password stored in plaintext | usecases.md ext 4a; the code comment says "hash this password" (`auth.js:31`) | Password stored as a hash | **FAIL/finding** — the raw Firestore doc holds the submitted password verbatim |
| UC1 `[DOC EXPECTATION]`: stored password must be hashed | Assert the fix for the star finding as a red test | Stored value ≠ submitted value | **FAIL (by design)** — stored value is `"supersecret"`; stays red until `/register` hashes |

## UC3 — Manage profile

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC3 main flow: edit a field, re-read it | Cover the happy path | 200, change persists and is visible on GET | PASS |
| UC3 auth: wrong password / non-customer role | Doc'd guards (`customer.js:25, 60`) | 401 | PASS |
| UC3 star finding: address change keeps stale coordinates | usecases.md ext 3a (`models/User.js:119-124`) | New address → new coordinates, or the request fails | **FAIL/finding** — 200 but `location` stays the old point; the geocode miss leaves coordinates untouched |
| UC3 finding: one-field edit wipes the rest of the profile | Step 2 is "User edits fields (address, phone, …)" | Other fields preserved | **FAIL/finding** — `update({ profile })` replaces the whole map (`customer.js:66`); setting `phone` deletes `name` and `address` |
| UC3 finding: phone type-check only on the customer route | usecases.md note "four endpoints, different contracts" | One consistent contract | **FAIL/finding** — `profile.phone: 12345` → 400 on `/api/customer/profile`, 200 on `/api/auth/profile` |
| UC3 finding: role check only on the customer route | Same note | Same authorization for the same operation | **FAIL/finding** — a restaurant user is blocked on `/api/customer/profile` (401) but edits fine via `/api/auth/profile` (200) |
| UC3 `[DOC EXPECTATION]`: address change must refresh coordinates | Assert the fix for the star finding as a red test | `location` ≠ old point after an address change | **FAIL (by design)** — `location` unchanged; stays red until the stale-coordinate path is fixed |

## UC4 — Browse nearby restaurants

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC4 main flow: GET /restaurants | Cover the happy path | Every registered restaurant, with rating and menu | PASS |
| UC4 finding: restaurant with no profile.name | Behaviour at `customer.js:96` | Restaurant listed, or an explicit reason it isn't | **FAIL/finding** — silently omitted from the list |
| UC4 ext 2a: rating recomputed on every read | usecases.md ext 2a (`customer.js:97-122`) | A rating is shown | PASS — confirms the doc: recomputed by scanning every delivered order per request, no stored average (users doc has no `rating` field) |
| UC4 ext 3a: distance sort, missing userId | Doc'd guard (`customer.js:173-175`) | 400 | PASS |
| UC4 ext 3a/3b: unknown userId / no saved location | Doc'd extensions (`customer.js:183, 188`) | 404 / 400 | PASS |
| UC4 main flow: distance sort, nearest-first | Cover the happy path (step 3) | Sorted nearest-first with a mileage figure | PASS |
| UC4 finding (not automated): `console.log(restaurants[1].location)` | Found reading the handler (`customer.js:155`) | List endpoint works for any restaurant count | **FAIL/finding** — with 0 or 1 registered restaurants it throws a `TypeError` after `res.json()` sends 200 → `ERR_HTTP_HEADERS_SENT`; not automated (would inject an unhandled-rejection warning into the raw output), every UC4 test seeds ≥ 2 restaurants to avoid it |

## UC5 — Build a cart

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC5 main flow: add / re-add bumps quantity, running total | Cover the happy path | Quantities merge, running total correct | PASS |
| UC5 main flow: adjust a quantity | Step 1 "adjusts quantities" | Total updates | PASS |
| UC5: `updateQuantity(≤ 0)` removes the line | `CartContext.tsx:58-61` | Line removed | PASS |
| UC5: removeItem / clearCart | Basic cart maintenance | Cart empties | PASS |
| UC5 finding: cross-restaurant cart, no guard | usecases.md ext 3a | One coherent order per restaurant, or the mix is blocked | **FAIL/finding** — both items sit in one cart; the rule is only applied by a silent split at checkout (`Cart.tsx:106`) |
| UC5 star finding: cart lost on refresh | usecases.md ext 1a (`CartContext.tsx:37`) | Cart survives a refresh on the way to checkout | **FAIL/finding** — the cart is `useState` only; a remount empties it and nothing is written to `localStorage` |
| UC5 `[DOC EXPECTATION]`: cart survives a refresh | Assert the fix for the star finding as a red test | Items still present after remount | **FAIL (by design)** — empty after remount; stays red until the cart is persisted |

## UC7 — Track my order

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC7 main flow: GET /customer order list | Cover the happy path | The customer's orders with current status | PASS |
| UC7: list scoped to the customer | `orders.js:93-95` | Only this customer's orders | PASS |
| UC7 ext 2a: missing customerId | Doc'd extension (`orders.js:89`) | 400 | PASS |
| UC7: customer with no orders | Boundary | 200 + empty list, not an error | PASS |
| UC7 star finding: confirmedAt tracks the wrong transition | usecases.md ext 2c (`orders.js:202`) | `confirmedAt` marks the "confirmed" transition | **FAIL/finding** — `→ confirmed` records no timestamp; `→ preparing` is what sets `confirmedAt`, so a "Confirmed at …" label really shows the cook-start time |
| UC7 finding: GET /:id is a stub | usecases.md main scenario (open an order to track it) | The real order for that id, or 404 | **FAIL/finding** — returns a hardcoded mock (`customerId: "customer123"`, one Pizza, `status: "pending"`) for any id, never reads Firestore (`orders.js:157-180`) |
| UC7 ext 2b: transitions unvalidated | usecases.md ext 2b; UC12 ext 3a (`orders.js:184`) | Status advances through the documented sequence | **FAIL/finding** — `pending → delivered` in one call is accepted; the tracked order then shows "Delivered" with `confirmedAt` and `readyAt` never set |
| UC7 `[DOC EXPECTATION]`: GET /:id returns the real order | Assert the fix for the stub as a red test | Response reflects the seeded order | **FAIL (by design)** — returns the mock; stays red until `/:id` reads the store |
