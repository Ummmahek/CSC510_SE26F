# Keeper prompt outputs — Claude

- **Model:** Claude Opus 5 (Claude Code CLI)
- **Run date:** 2026-08-31
- **Repo state at run:** commit `c70af8a` (main) — same tree as the Codex run,
  checked out into a detached worktree so the 5 UC test files added later in
  `c9af2ba` were **not** visible to the model.
- **Prompts:** KP1–KP8 from [`../keeper-prompts.md`](../keeper-prompts.md), run verbatim
- **Output:** verbatim. Section headers normalized to match keeper-prompts.md.
- **Verification note:** claims marked ✅ were confirmed by executing code in the
  worktree (test runs, `node -e` probes, server boot), not just by reading it.
  Dependency-currency claims are made **only** from the manifests in the repo;
  this run had no npm-registry access, so "N versions behind" statements are
  marked UNVERIFIED rather than guessed.

---

# KP1 — First contact

## 1. Tech stack

- **Languages:** TypeScript/TSX (client), JavaScript/CommonJS (server).
- **Frontend:** React 19.2 on Create React App (`react-scripts` 5.0.1), React
  Router 7.9, TanStack React Query 5.90, React Context for auth/cart, plain CSS.
- **Backend:** Node.js + Express 4.18, structured as 10 route modules mounted in
  one entrypoint (`server/index.js:34-43`).
- **Database:** Google Cloud Firestore via `firebase-admin` ^11.11.0
  (`server/config/firebase.js:32`). `docker-compose.yml:3` supplies a local
  Firestore emulator.
- **Key libraries:** axios, express-validator, helmet, cors, morgan,
  `@react-google-maps/api`, recharts, Jest, Supertest, React Testing Library.
- **Auth:** Firebase Auth is initialized and exported (`server/config/firebase.js:33`)
  but has **no consumer anywhere in `server/`**. The implemented login compares a
  Firestore-stored plaintext password directly (`server/routes/auth.js:67`).
- **External services:** Google Maps (geocoding + maps), Gemini
  `gemini-2.5-flash` for voice-command classification (`server/routes/voice.js:44`).

## 2. What the product does, in plain terms

"Hungry Wolf" is a three-sided, gamified food-delivery web app.

- **Customers** browse restaurants, build a cart, order, tip, redeem points,
  track orders, rate, and earn tiered badges.
- **Restaurants** manage menus, process orders, and view sales insights.
- **Delivery partners** claim ready orders, deliver them, and accrue fees + tips.

Completing a delivery is the hub event: it awards customer points, recalculates
badges, and credits rider earnings (`server/routes/delivery.js:255-282`). The
product also advertises a "Meal-for-a-Meal" donation program, but its meal count
is derived arithmetically from delivered orders — no real donation provider is
integrated. UNVERIFIED whether any external donation partner exists.

## 3. The five files that matter most, ranked

1. **`server/index.js`** — backend composition root; mounts all 10 API domains
   and is the only place the full surface is visible.
2. **`server/routes/delivery.js`** — the highest-consequence file: delivery
   completion fans out into points, badges, and rider payout, and is where the
   money is written.
3. **`server/routes/orders.js`** — the order lifecycle (create, list, status,
   rate), and also the largest concentration of stubbed endpoints.
4. **`client/src/App.tsx`** — frontend composition root: providers, public
   routes, and role-gated dashboards.
5. **`server/models/User.js`** — one shared record type backs all three roles, so
   its shape constrains every feature.

---

# KP2 — Code rot anywhere

No `TODO`/`FIXME`/`XXX`/`HACK` markers exist in tracked source. The equivalent
markers here are `// For now`, `mock`, and commented-out calls. Rows marked
(verified) were confirmed by executing code, not only by reading it. Dependency
currency was assessed from the repo's manifests only — this run had no
npm-registry access, so "N versions behind" claims are marked UNVERIFIED.

| File | Evidence of rot | Why it matters |
|---|---|---|
| `server/routes/delivery.js:278` | Calls `rider.updateDeliveryStatus('free')`; `User` defines only `update`, `toJSON`, `updateEarnings` (`server/models/User.js:103,135,153`). (verified: resolves to `undefined`) | Partial write. Order marked delivered, points awarded, badges refreshed, and `updateEarnings` committed before this throws. Request 500s with the rider already paid and left non-`free`. |
| `server/routes/restaurant.js:51` | Calls `Restaurant.findByOwnerId(user.id)`; class defines only `formatAddress`, `getGeocode`, `create`, `findById`. (verified) | Restaurant profile update fails at runtime before any update can occur. |
| `server/routes/orders.js:11` | Calls `User.findFreeRiders()`, never defined. (verified) | Dead code from an abandoned auto-assignment design; cannot work if revived. |
| `client/public/index.html:29` | A live Google Maps API key is hardcoded into tracked HTML (value redacted here). | Committed to git history; rotation requires a code change and a history rewrite. |
| `server/routes/auth.js:30`, `:66-69` | `password, // In production, hash this password` and `// For now, we'll just check if password matches`; comparison is `user.password !== password`. `bcryptjs` declared (`server/package.json:13`) but never imported. | Plaintext credentials at rest and in comparison; abandoned hashing migration. |
| `server/middleware/auth.js` vs `server/index.js:34-43` | Auth middleware module exists but is never imported; every route mounted bare. | Authentication-shaped code providing zero server-side authorization. |
| `server/config/firebase.js:33` | `admin.auth()` exported; no consumer anywhere in `server/`. | Leftover infrastructure contradicting the active plaintext scheme. |
| `server/routes/orders.js:157-175` | `// Get order by ID (mock data for now)` returning a hardcoded `mockOrder`. | A production-looking read endpoint returns fiction. |
| `server/routes/orders.js:219-232` | `// Assign delivery partner (mock for now)` → `// Mock response`, no write. | Callers get success for an operation that never happened. |
| `server/routes/restaurant.js:8-11` | `// For now, return empty profile until we implement proper restaurant identification`. | Endpoint can never return a restaurant. |
| `client/src/components/delivery/DeliveryMap.tsx:89` | `const duration = 20; // 20 seconds (maintain for now)` — delivery is a fixed animation. | Demo behavior embedded in a normal product flow. |
| `client/src/components/customer/Cart.tsx:106` | `// For now, place one order per restaurant`. | Multi-restaurant carts take an explicitly provisional checkout path. |
| `tests/example.test.js:30` | `require('../src/utils/businessLogic')`; `proj2/src/` contains only `badges/`. (verified: root `jest --coverage` = 1 suite failed, 0 tests ran, 0% coverage) | The advertised primary test command yields zero regression coverage; ~100 declared tests never execute. |
| `server/package.json:9` | `"test": "jest"` with no test files. (verified: `20 files checked … 0 matches`) | The entire backend has no executable suite. |
| `client/src/App.test.tsx:5-8` | Untouched CRA boilerplate asserting `/learn react/i`, a string the app does not render. | Frontend test asserts nothing about this product. |
| `.eslintignore:2-3` + `package.json:12` | Lint ignores `client/` and `server/`; script lints only `tests/` and `jest.config.js`. | The lint badge covers essentially none of the product code. |
| `server/package.json:12` and `:21` | `axios` declared twice in one object — `^1.13.2` and `^1.6.7`. JSON parsing silently keeps the last. | Resolved version is invisible in review and can change under a reformat. |
| `client/src/reportWebVitals.ts:5-7` | Imports and calls `getFID` from `web-vitals` ^2.1.4; FID was replaced by INP as a Core Web Vital. | Measures a retired metric; blocks a major upgrade. Exact removal version UNVERIFIED. |
| `client/src/components/delivery/DeliveryMap.tsx:43,58,73` | Three `new google.maps.Marker(...)` calls; Google has superseded this with `AdvancedMarkerElement`. | Legacy marker receives fixes only for major regressions. |
| `client/package.json:16` vs `:20` | `@types/react-router-dom` ^5.3.3 alongside runtime `react-router-dom` ^7.9.4, which ships its own types. | Type-checking against a v5 API contract that no longer exists. |
| `client/package.json:21` | `typescript` ^4.9.5 pinned under React 19 + `@types/react` ^19. | Old compiler against new type definitions. |
| `client/package.json:19` | `react-scripts` 5.0.1 — Create React App, which React has publicly sunset. | The frozen toolchain is the root cause of most transitive deprecation below it. |
| `docker-compose.yml:3` | Mutable, unversioned tag `google-cloud-cli:emulators`. | A silent upstream change breaks a previously reproducible environment. |
| `server/routes/voice.js:44-48` | Hardcoded default `gemini-2.5-flash` on `v1beta`. | Pinned to a versioned external model on a beta API surface. |
| `server/routes/voice.js:51` | `console.log('PROMPT:', prompt)` writes every user utterance to server logs. | User speech content lands in plaintext logs. |
| `client/src/services/api.ts:3` | Missing config falls back silently to `http://localhost:5001/api`. | A deployed frontend calls each visitor's own machine instead of failing loudly. |
| `server/config/firebase.js:5-14,26` | Builds a service-account object from possibly-undefined env vars, then passes it to `admin.credential.cert()` with no validation. | Produces the opaque startup crash triaged in KP3. |
| `README.md:20-24` | Architecture block names `frontend/` and `backend/`; actual directories are `client/` and `server/`. | The first orientation a new maintainer reads is wrong. |
| `README.md:2-3` | CI and Codecov badges point at `yashvinshah/SE_2025_projects` — a different repository — and no `.github/workflows/ci.yml` is tracked in `proj2`. | Green badges reflect someone else's repo; the claim cannot be reproduced here. |

---

# KP3 — Build failure triage

## 1. Classification + confidence

| Option | Confidence |
|---|---|
| (a) Code rot | **2%** |
| (b) My local setup | **93%** ← primary |
| (c) A real bug in the project | **5%** |

The 5% for (c) is not zero: the code performs no configuration validation and
crashes with a message that names `project_id` rather than the missing env file,
which is a genuine (if minor) defect in error handling. But the documented setup
path avoids the failure entirely, so this is a setup issue.

## 2. Root cause, cited to file and line

✅ Reproduced in a clean `c70af8a` worktree with no `server/.env`; the trace
terminates at `server/config/firebase.js:26`, exactly as predicted:

```
FirebaseAppError: Service account object must contain a string "project_id" property.
    at Object.cert (.../firebase-admin/lib/app/credential-factory.js:103:54)
    at Object.<anonymous> (.../proj2/server/config/firebase.js:26:36)
```

The chain:

1. `FIREBASE_PROJECT_ID` is unset, so `project_id` is `undefined`
   (`firebase.js:7`).
2. `FIRESTORE_EMULATOR_HOST` is also unset, so the emulator branch at
   `firebase.js:20` is skipped.
3. Control falls to `admin.credential.cert(serviceAccount)` at `firebase.js:26`
   with every field `undefined` → the reported error.

`LOCAL_SETUP.md:6-12` requires copying `server/env.example` first, and
`server/env.example:5-6` supplies both variables that would have taken branch (2).

The repo contains no evidence implicating any particular Node version.

## 3. The cheapest fix, in order of effort

1. **Follow the documented path** (~10 seconds, no Docker needed for boot):

   ```bash
   cp server/env.example server/.env
   ```

   ✅ Verified: with only this file present and **no emulator running**, the
   server boots cleanly — `🐺 Hungry Wolf server running on port 5001`, and
   `/api/health` returns 200. The Admin SDK connects lazily, so only routes that
   actually touch Firestore fail, and they fail per-request instead of at boot.

2. **Add the emulator** if you need working DB routes: `docker compose up -d`
   (`LOCAL_SETUP.md:9`). Nothing in the code requires Docker specifically —
   `firebase.js:20` only reads a `host:port` string, so any Firestore emulator on
   `localhost:8080` satisfies it.

3. **Real Firebase project:** remove `FIRESTORE_EMULATOR_HOST` and fill the
   service-account block at `env.example:11-17`. The repo does not provide those
   values.

4. **Optional hardening (project-side):** validate config at startup and fail
   with an actionable message. Not the cause of this failure.

---

# KP4 — Main feature check (voice ordering)

## 1. Actor, trigger, and main flow

1. An authenticated **customer** loads the customer dashboard, which is the only
   place `VoiceCommandManager` is mounted (`CustomerDashboard.tsx:67`).
2. They click the floating mic button; if the browser lacks SpeechRecognition a
   toast appears instead (`VoiceCommandManager.tsx:171-182`).
3. Recognition starts hardcoded to **`ko-KR`** with `continuous` and
   `interimResults` on (`useSpeechToText.ts:102-104`).
4. On the first final chunk, the hook fires `onFinalTranscript` exactly once
   (guarded by `hasDispatchedFinalRef`) and stops recognition
   (`useSpeechToText.ts:136-140`).
5. The client POSTs `{userText}` to `/voice/classify` (`gemini.ts:10`), mounted
   at `/api/voice` (`index.js:42`). The server asks Gemini for exactly one of
   five allowlisted ids and returns 422 if the reply is not in the set
   (`voice.js:71-75`).
6. The client opens a confirmation modal; on confirm, `performAction` dispatches
   navigation, logout, cart open, or total calculation
   (`VoiceCommandManager.tsx:195-210`).

## 2. Does it work as intended? **Partial — and misnamed**

The speech → classify → confirm → execute pipeline is coherently implemented,
and the allowlist + confirmation step is genuinely good design: the model can
never invoke anything outside five ids, and the user approves every action.

But **this feature cannot order food.** Its complete action set is `logout`,
`openProfile`, `goHome`, `openCart`, `calculateTotalPrice` (`actions.ts:8-14`,
mirrored server-side at `voice.js:6-12`). There is no command to pick a
restaurant, add an item, or check out. "Voice ordering" is a misnomer for what is
voice **navigation**.

Live microphone capture and real Gemini classification accuracy are **UNVERIFIED**
— both require a running browser and a `GEMINI_API_KEY` this repo does not ship.

## 3. Three weaknesses, cited

| # | Cite | Weakness |
|---|---|---|
| 1 | `actions.ts:8-14`, `voice.js:6-12` | No ordering action exists. The feature named "voice ordering" in the assignment cannot add an item or place an order. |
| 2 | `useSpeechToText.ts:102` vs `VoiceModal.tsx:49-55` | Recognition is hardcoded to Korean while every UI string is English. An English speaker's audio is transcribed by a Korean model, then sent to Gemini. Practical accuracy UNVERIFIED, but the mismatch is unambiguous in the code. |
| 3 | `voice.js:35` + `voice.js:39-42` | Two input/config defects: whitespace-only text passes validation (see KP7), and a missing `GEMINI_API_KEY` 500s — yet `env.example:24-25` labels that key "optional (app runs without these)". A default local setup silently has a dead feature. |

Additional observation, not counted above: `voice.js:51`
`console.log('PROMPT:', prompt)` writes every user utterance to server logs.

---

# KP5 — Existing test coverage for that feature

## 1. Existing tests that touch this feature

**NONE FOUND.** ✅ Verified by grep for `voice|Voice|classify` across `tests/`
and `client/src/App.test.tsx` — zero matches.

The repo contains exactly two test files at this commit:

- `tests/example.test.js` — targets 27 business-logic helpers imported from
  `../src/utils/businessLogic` (line 30). No voice module appears in its imports.
  ✅ It also **cannot run**: the module does not exist, so the suite fails at
  import and 0 of its tests execute.
- `client/src/App.test.tsx` — CRA boilerplate asserting `/learn react/i`.

## 2. Quality verdict: **missing**

Not "weak" — absent. There is no assertion anywhere against `/api/voice`,
`/voice/classify`, `classifyWithGemini`, `useSpeechToText`, `performAction`, or
any voice component.

Two structural reasons this cannot improve by accident:

- `jest.config.js:3` matches only `**/tests/**/*.test.js`, and `:12-18`
  explicitly excludes `client/` and `server/` from coverage. The root suite is
  configured so that server routes can never be measured.
- The server has no test files at all ✅ (`npx jest` in `server/`:
  `20 files checked … 0 matches`).

Net: a regression anywhere in the voice path is undetectable by CI.

## 3. Untested edge cases

Grouped by layer, each tied to a branch that exists in the code today:

**Server — input validation** (`voice.js:35`)
- missing / `null` / numeric / object `userText` → 400
- **whitespace-only `userText`** → passes the guard and is sent to Gemini (see KP7)

**Server — configuration** (`voice.js:39-42`)
- absent `GEMINI_API_KEY` → 500 before any network call

**Server — upstream response handling** (`voice.js:67-87`)
- valid id → 200; id with surrounding whitespace → trimmed and accepted
- `candidates` missing / empty parts → 422 with `raw: undefined`
- an id not in `ACTION_SET` (model hallucination) → 422
- upstream HTTP error → status passed through; network error → 500

**Client — API wrapper** (`gemini.ts:5-26`)
- empty text throws before the request
- empty `actionId`, unsupported `actionId`, backend error message propagation

**Client — speech hook** (`useSpeechToText.ts:47-159`)
- unsupported browser; `webkitSpeechRecognition` fallback; `not-allowed`
  permission error; interim-only results; **multiple final results firing only
  one dispatch**; unmount cleanup

**Client — orchestration** (`VoiceCommandManager.tsx:117-210`)
- blank transcript toast; classification failure toast; cancel vs confirm;
  double-click while classifying; each of the five actions dispatching correctly;
  `calculateTotalPrice` with an empty cart

**Absent by construction**
- No test can cover "add an item by voice" — no such action exists.

---

# KP6 — Write a test case

**Test name:** `returns the classified action id for a recognized voice command`

**Stated assumptions** (not hidden): `axios` is mocked, so this covers only this
repo's own request-building and response-handling — **not** live Gemini accuracy.
`test-key-not-a-real-secret` is a placeholder, not a credential. The app is
assembled from the real, unmodified `routes/voice.js` router because
`server/index.js` calls `app.listen()` at module scope and never exports `app`,
so it cannot be `require`d by supertest without opening a socket.

```js
const express = require('express');
const request = require('supertest');
const axios = require('axios');

jest.mock('axios');

const voiceRoutes = require('../routes/voice');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/voice', voiceRoutes);
  return app;
};

const geminiReply = (text) => ({
  data: { candidates: [{ content: { parts: [{ text }] } }] },
});

const ORIGINAL_KEY = process.env.GEMINI_API_KEY;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = 'test-key-not-a-real-secret';
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = ORIGINAL_KEY;
});

test('returns the classified action id for a recognized voice command', async () => {
  axios.post.mockResolvedValueOnce(geminiReply('openCart'));

  const res = await request(buildApp())
    .post('/api/voice/classify')
    .send({ userText: 'open my cart' });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ actionId: 'openCart' });

  expect(axios.post).toHaveBeenCalledTimes(1);
  const [url, payload, config] = axios.post.mock.calls[0];
  expect(url).toBe(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  );
  expect(payload.contents[0].parts[0].text).toContain('The user said: "open my cart"');
  expect(config).toEqual({ params: { key: 'test-key-not-a-real-secret' } });
});
```

**This proves** the endpoint forwards the caller's transcript into the Gemini
prompt and returns the allowlisted action id to the client on the happy path.

✅ **Run result: PASSES** (`server/tests/voice.test.js`, jest 29 + supertest 6).

---

# KP7 — Gap analysis + test case for the gap

## 1. The gap, in one sentence

From KP5's validation list: `voice.js:35` guards only
`!userText || typeof userText !== 'string'`, so a **whitespace-only transcript is
truthy, passes validation, is trimmed to `""` by `buildPrompt` (`voice.js:18`),
and is sent to Gemini as an empty utterance.**

## 2. Why it's risky

Gemini is instructed to "Choose EXACTLY ONE action" and is given no way to
decline (`voice.js:27-28`). Handed an empty utterance it still returns one of the
five ids — effectively at random. The client then opens a confirmation modal
naming a real action (`VoiceCommandManager.tsx:132-135`).

So a customer who taps the mic and says nothing intelligible — a cough, a noisy
room — can be shown *"Log the user out"* and confirm it reflexively. This is a
**silent wrong action**, which is worse than the missing-API-key case (also
untested), because that one fails loudly with a 500 and nothing happens. It also
bills a Gemini call for empty input on every occurrence.

The client wrapper does guard this (`!userText?.trim()`, `gemini.ts:5`) — which
is precisely why it needs a server test: the only protection sits on the side an
attacker or a second client does not have to use.

## 3. Test case

**Name:** `[DOC EXPECTATION] rejects a whitespace-only transcript instead of classifying it (EXPECTED TO FAIL -- see voice.js:35)`

```js
test('[DOC EXPECTATION] rejects a whitespace-only transcript instead of classifying it (EXPECTED TO FAIL -- see voice.js:35)', async () => {
  axios.post.mockResolvedValueOnce(geminiReply('logout'));

  const res = await request(buildApp())
    .post('/api/voice/classify')
    .send({ userText: '   ' });

  expect(axios.post).not.toHaveBeenCalled();
  expect(res.status).toBe(400);
});

// Companion test documenting what the code actually does today.
test('a whitespace-only transcript currently reaches Gemini with an empty utterance', async () => {
  axios.post.mockResolvedValueOnce(geminiReply('logout'));

  const res = await request(buildApp())
    .post('/api/voice/classify')
    .send({ userText: '   ' });

  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][1].contents[0].parts[0].text).toContain('The user said: ""');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ actionId: 'logout' });
});
```

**This proves** the server has no defense against an empty utterance: the
`[DOC EXPECTATION]` test fails, and the companion test passes showing the request
reaching Gemini as `The user said: ""` and returning a confirmable `logout`.

✅ **Run result — exactly as predicted:**

```
Tests: 1 failed, 2 passed, 3 total

  ● [DOC EXPECTATION] rejects a whitespace-only transcript …
    Expected number of calls: 0
    Received number of calls: 1
    1: ".../gemini-2.5-flash:generateContent", {"contents":[{"parts":[{"text":
       "You are an action classifier for our app.
        The user said: \"\" ...
```

Per the assignment's "report, do not repair" rule, `voice.js` was left unchanged.

---

# KP8 — Feature value / long-run viability

## 1. Verdict

- **Voice "ordering": worth reworking, under a different name** — cut it as
  shipped, keep the architecture.
- **Donation service: worth reworking** — keep the concept, rebuild the data model.

Neither verdict rests on adoption data: the repo contains no telemetry or user
research, so **real usage of either feature is UNVERIFIED.**

## 2. Three pieces of evidence

1. **The voice feature's scaffolding is better than its scope.** ▸ *Directly
   cited:* the five-id allowlist enforced on both client and server
   (`voice.js:14-15`, `actions.ts:18-20`), a mandatory confirmation step
   (`VoiceCommandManager.tsx:234-239`), and an exhaustive `never` check in the
   dispatcher (`performAction.ts:28-31`). That is a sound pattern for LLM-driven
   UI. ▸ *Inference:* the ~830 lines across 10 files are worth keeping as a
   chassis; what fails is that all five actions are things a button already does
   in one tap (`actions.ts:8-14`).

2. **Adoption cost is stacked against it.** ▸ *Directly cited:* it needs browser
   SpeechRecognition (`useSpeechToText.ts:47-53`), Korean-language transcription
   (`useSpeechToText.ts:102`), and a `GEMINI_API_KEY` that `env.example` calls
   optional but whose absence 500s the endpoint (`voice.js:39-42`).
   ▸ *Inference:* three hard gates and a per-call API bill for functionality
   already reachable by tapping.

3. **The donation service has three disconnected sources of truth.** ▸ *Directly
   cited:* `/stats` computes `mealsDonated` as `delivered orders / 10`
   (`donations.js:15`); it reads a `settings/donations.counter` (`:18-29`) and
   then **never returns it** (`:31-35`); `/update` writes that same counter
   (`:61-64`); and `/record` writes to a third collection, `donationHistory`
   (`:105-111`). ▸ *Inference:* the number shown to users is a derived integer
   that no donation record can ever affect — the feature cannot substantiate its
   own claim.

## 3. One long-term risk

**Unauthenticated write endpoints on a public social-impact claim.**
`/api/donations` is mounted with no middleware (`index.js:40`), so
`POST /update` (`donations.js:43`) and `POST /record` (`donations.js:97`) accept
writes from anyone. Combined with finding 3 above, the "Meals Donated" figure is
both unauditable and externally mutable.

The cost is not primarily engineering. A gamified platform that publicly claims
donated meals is making a **factual representation to users**. Discovering later
that the number was derived arithmetic, contradicted by a separate counter, and
writable without authentication turns a code problem into a trust-and-disclosure
problem — the kind that is expensive to reconcile long after the commit that
caused it.
