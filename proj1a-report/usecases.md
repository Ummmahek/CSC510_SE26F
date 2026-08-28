# D2 — Use cases (target: 20)

Format: https://github.com/txt/se26f/blob/main/docs/submit/1/usecases0.md
Rules: main scenario stays clean (no ifs); all branching goes in extensions;
name from the actor's goal; cite `file:line` for what the code does and does
not handle. The course's worked example is also a food-delivery app — so our
edge is grounding every claim in THIS repo's code, not generic delivery lore.

Candidate list (assign, then write below): sign up per role / log in /
browse restaurants / manage menu / place order / accept-reject order (restaurant) /
assign delivery / update delivery status / track order / rate restaurant /
earn points on delivery / redeem points (done: UC6) / view points history /
local legends listing / meal-for-a-meal donation counter / badges /
restaurant insights dashboard / voice ordering (Gemini) / customer stats /
address autocomplete on signup.

---

## UC6: Redeem points for discount

| Part | Content |
|---|---|
| **Name** | Redeem points for discount |
| **Primary actor** | Customer |
| **Stakeholders & interests** | Customer: pay less using earned points. Platform: keep gamification loop credible. Restaurant: order value unaffected by redemption accounting. |
| **Preconditions** | Customer is registered and logged in; customer has completed at least one delivered order (points are only awarded on delivery completion, `server/routes/delivery.js:255`). |
| **Trigger** | Customer chooses to apply points while paying for an order. |
| **Main success scenario** | 1. Customer views current points balance. 2. Customer enters the number of points to redeem. 3. System verifies the balance covers the request. 4. System converts points to a discount at 1 point = $0.01. 5. System deducts the points and records a redemption transaction. 6. Customer sees the discount applied to the bill. |
| **Extensions** | 2a: Requested points < 1 or not an integer → request rejected by input validation (`server/routes/points.js:69`). 3a: Balance insufficient → system refuses and reports available vs. requested points (`points.js:92–97`). 3b: Customer has no points record yet → system reports "no points found" (`points.js:85–88`). 5a: **Not handled** — two simultaneous redemptions read the same balance before either deducts (no Firestore transaction around read-then-update, `points.js:82–127`); points can be double-spent. 5b: Transaction history silently keeps only the last 50 entries (`points.js:118–121`); older redemptions disappear from the customer's view. |
| **Postconditions** | Balance reduced by the redeemed amount; redemption logged in transaction history; discount amount returned to the ordering flow. |

Note for D3/D4: README claims points are "10% of bill" (15% for Local
Legends), but the code awards `Math.floor(orderTotal)` — 1 point per dollar,
no Local Legends bonus on this path (`points.js:195`, called from
`delivery.js:255`). Docs and code disagree; test candidate.

---

<!-- UC1 ... UC20: add here, same table format -->
