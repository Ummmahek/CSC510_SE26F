# Keeper prompt outputs — Codex

- **Model:** Codex (desktop app), model 5.6 Sol, reasoning effort: High
- **Run date:** 2026-08-31
- **Repo state at run:** commit `c70af8a` (main)
- **Prompts:** KP1–KP8 from [`../keeper-prompts.md`](../keeper-prompts.md), run verbatim
- **Output:** verbatim, no content edits. Two mechanical cleanups applied
  after pasting: (1) absolute path prefixes trimmed to repo-relative
  (leading `…/proj2/` removed), (2) section headers normalized and titled
  to match keeper-prompts.md.

---

# KP1 — First contact


1. Tech stack

- **Languages:** TypeScript/TSX on the frontend; JavaScript/CommonJS on the backend.
- **Frontend:** React 19 with Create React App, React Router 7, TanStack React Query 5, Context API, and plain CSS.
- **Backend:** Node.js with Express 4.
- **Database:** Google Cloud Firestore through `firebase-admin`; Docker Compose provides a local Firestore emulator.
- **Key libraries:** Axios, Google Maps React API, Recharts, Express Validator, Helmet, CORS, Morgan, Jest, Supertest, and React Testing Library.
- **Authentication:** Although Firebase Auth is initialized, the implemented login compares Firestore-stored passwords directly and gives the client a dummy token; real token-based authentication is **UNVERIFIED**.
- **External integration:** Google Maps geocoding and Gemini-based voice-command classification.

2. What the product does, in plain terms

“Hungry Wolf” is a three-sided food-delivery web application:

- Customers browse nearby restaurants and menus, build a cart, place orders, add tips, redeem points, track orders, submit ratings, and earn tiered badges.
- Restaurants edit menus, process incoming orders, and view operational insights.
- Delivery riders claim ready orders, mark them delivered, and accumulate delivery fees plus tips.

Completing a delivery awards customer points, recalculates badges, and credits rider earnings. The application also reports a “Meal-for-a-Meal” metric of one donated meal per ten delivered orders, but integration with a real donation provider is **UNVERIFIED**.

3. The five files that matter most, ranked

1. [server/index.js](server/index.js) — Backend composition root that configures middleware and exposes every API domain.
2. [client/src/App.tsx](client/src/App.tsx) — Frontend composition root defining global state providers, public pages, and role-protected dashboards.
3. [server/routes/orders.js](server/routes/orders.js) — Implements the central order creation, retrieval, status, and rating lifecycle.
4. [server/routes/delivery.js](server/routes/delivery.js) — Connects delivery completion to customer points, badges, and rider earnings.
5. [server/models/User.js](server/models/User.js) — Defines the shared customer, restaurant, and rider record plus Firestore persistence, geolocation, and earnings behavior.


# KP2 — Code rot anywhere


Audit scope: all Git-tracked source, configuration, documentation, manifests, and lockfiles; generated `node_modules` was excluded. No `TODO`, `FIXME`, `XXX`, or `HACK` markers were present, but several equivalent “for now” and mock implementations were found. Dependency versions were checked against npm on 2026-08-31.

| File | Evidence of rot | Why it matters |
|---|---|---|
| [client/package.json:21](client/package.json:21) | Frontend is built on `react-scripts` 5.0.1/Create React App; React says CRA has no active maintainers and is deprecated. [Official notice](https://react.dev/blog/2025/02/14/sunsetting-create-react-app) | The frozen toolchain is responsible for much of the deprecated dependency tree and complicates React, TypeScript, Jest, and router upgrades. |
| [client/package.json:16](client/package.json:16)<br>[client/package.json:20](client/package.json:20) | `@types/react-router-dom` is v5 while runtime `react-router-dom` is v7, which already supplies its own types. | Editors and builds can validate against an obsolete API contract. |
| [client/reportWebVitals.ts:5](client/src/reportWebVitals.ts:5)<br>[client/package.json:24](client/package.json:24) | Code calls `getFID` from `web-vitals` 2.1.4; FID was deprecated in v4 and removed in v5, while npm reports v6.2.1 current. [Upgrade documentation](https://github.com/GoogleChrome/web-vitals/blob/main/docs/upgrading-to-v5.md) | Any modern `web-vitals` upgrade breaks this module and the app still measures a replaced metric. |
| [package.json:25](package.json:25) | npm reports drift across every root dependency: React 19.2.0→19.2.8, React Query 5.90.10→5.102.8, Concurrently 8→10, ESLint 8→10, and Jest 29→30. | Root tooling is multiple major versions behind and duplicates frontend-only React dependencies. |
| [client/package.json:6](client/package.json:6) | npm reports 16 outdated client dependencies, notably Testing Library user-event 13→14, Jest types 27→30, Node types 16→26, TypeScript 4.9→7, web-vitals 2→6, and React Router 7.9→7.18. | This is a large accumulated upgrade surface with several breaking-major migrations. |
| [server/package.json:12](server/package.json:12) | npm reports 12 outdated server packages, including bcryptjs 2→3, dotenv 16→17, Express 4→5, Firebase Admin 11→14, Helmet 7→8, Jest 29→30, and Supertest 6→7. | Core HTTP, security, database, and testing infrastructure is behind supported/current majors. |
| [server/package.json:12](server/package.json:12)<br>[server/package.json:21](server/package.json:21) | `axios` appears twice with different ranges; JSON parsing silently lets the later `^1.6.7` entry replace `^1.13.2`. | Humans and dependency tools see an ambiguous manifest, making updates nondeterministic. |
| [package-lock.json:597](package-lock.json:597)<br>[package-lock.json:2055](package-lock.json:2055)<br>[package-lock.json:2451](package-lock.json:2451)<br>[package-lock.json:2613](package-lock.json:2613)<br>[package-lock.json:4181](package-lock.json:4181) | Root lockfile explicitly marks ESLint 8, old `glob`, `rimraf`, Humanwhocodes packages, and memory-leaking `inflight` as deprecated/unsupported. | Even basic lint/test installs retain packages their maintainers say not to use. |
| [client/package-lock.json:545](client/package-lock.json:545)<br>[client/package-lock.json:579](client/package-lock.json:579)<br>[client/package-lock.json:596](client/package-lock.json:596)<br>[client/package-lock.json:613](client/package-lock.json:613)<br>[client/package-lock.json:631](client/package-lock.json:631)<br>[client/package-lock.json:5411](client/package-lock.json:5411) | Six Babel proposal plugins are explicitly “no longer maintained.” | They are embedded through CRA’s fixed Babel preset and cannot be cleanly replaced without migrating the build system. |
| [client/package-lock.json:7593](client/package-lock.json:7593)<br>[client/package-lock.json:9011](client/package-lock.json:9011)<br>[client/package-lock.json:9674](client/package-lock.json:9674)<br>[client/package-lock.json:14101](client/package-lock.json:14101)<br>[client/package-lock.json:14920](client/package-lock.json:14920)<br>[client/package-lock.json:14951](client/package-lock.json:14951)<br>[client/package-lock.json:16276](client/package-lock.json:16276) | Client lockfile explicitly deprecates ESLint 8, old `glob`, leaking `inflight`, Q promises, Rimraf 3, `rollup-plugin-terser`, and SVGO 1. | These unsupported packages sit in the production build/test toolchain and will increasingly conflict with current Node versions. |
| [client/package-lock.json:17859](client/package-lock.json:17859)<br>[client/package-lock.json:17898](client/package-lock.json:17898)<br>[client/package-lock.json:17924](client/package-lock.json:17924) | CRA pulls a discarded beta `source-map` branch and deprecated Workbox packages, including an analytics plugin incompatible with GA4. | Source maps/PWA behavior depend on abandoned code and obsolete analytics assumptions. |
| [server/package-lock.json:3506](server/package-lock.json:3506)<br>[server/package-lock.json:3782](server/package-lock.json:3782) | Firebase Admin 11’s tree contains unmaintained `google-p12-pem` and memory-leaking `inflight`. | Staying on Firebase Admin 11 preserves abandoned Google-auth dependencies. |
| [server/package-lock.json:6643](server/package-lock.json:6643)<br>[server/package-lock.json:6717](server/package-lock.json:6717) | Lockfile explicitly says to upgrade Superagent to 10.2.2+ and Supertest to 7.1.3+. | The API testing stack is both deprecated and currently unused by any server tests. |
| [docs/INSTALL.md:7](docs/INSTALL.md:7)<br>[client/package.json:13](client/package.json:13) | Setup permits Node 16 and client types target Node 16; Node 16 has been EOL since 2023. [Node EOL table](https://nodejs.org/en/about/eol) | EOL runtimes receive no security patches and current dependencies increasingly drop compatibility. |
| [client/package-lock.json:5432](client/package-lock.json:5432)<br>[client/package-lock.json:5753](client/package-lock.json:5753) | Production build reports `baseline-browser-mapping` over two months old and `caniuse-lite` ten months old. | Browser targeting and transpilation decisions are based on stale compatibility data. |
| [client/src/components/LocationPickerMap.tsx:94](client/src/components/LocationPickerMap.tsx:94)<br>[client/src/components/delivery/DeliveryMap.tsx:43](client/src/components/delivery/DeliveryMap.tsx:43) | Both map components instantiate deprecated `google.maps.Marker`. [Google migration notice](https://developers.google.com/maps/documentation/javascript/advanced-markers/migration) | Google only fixes major regressions in the legacy marker and recommends `AdvancedMarkerElement`. |
| [server/routes/voice.js:44](server/routes/voice.js:44) | Voice classification hardcodes `gemini-2.5-flash` and the `v1beta ...:generateContent` interface; Google now labels `generateContent` legacy. [Current API guidance](https://ai.google.dev/gemini-api/docs) | The feature is tightly coupled to a versioned external model and a superseded API surface. |
| [client/public/index.html:29](client/public/index.html:29) | A Google Maps API key is hardcoded into tracked public HTML. | The key can be revoked, quota-exhausted, or restricted outside its original deployment, and rotation requires a code change. |
| [client/src/services/api.ts:3](client/src/services/api.ts:3) | Missing production configuration silently falls back to `http://localhost:5001/api`. | A deployed frontend will call each visitor’s own machine rather than fail configuration validation. |
| [docker-compose.yml:3](docker-compose.yml:3) | Firestore emulator uses mutable, unversioned image tag `google-cloud-cli:emulators`. | A future upstream image change can break previously reproducible local environments. |
| [client/public/index.html:12](client/public/index.html:12)<br>[client/src/components/delivery/DeliveryMap.tsx:53](client/src/components/delivery/DeliveryMap.tsx:53)<br>[client/src/components/delivery/DeliveryMap.tsx:78](client/src/components/delivery/DeliveryMap.tsx:78) | HTML references nonexistent `logo192.png`; map markers depend on undocumented HTTP Google icon URLs and a route-relative `../../../icons/delivery-man.png`. | Missing/mixed-content/route-dependent assets can silently disappear in production. |
| [server/routes/auth.js:31](server/routes/auth.js:31)<br>[server/routes/auth.js:65](server/routes/auth.js:65)<br>[server/package.json:13](server/package.json:13) | Comments explicitly defer hashing; passwords are stored and compared as plaintext, while declared `bcryptjs` is never imported. | This is abandoned authentication migration scaffolding with immediate security and maintenance consequences. |
| [client/src/contexts/AuthContext.tsx:85](client/src/contexts/AuthContext.tsx:85)<br>[client/src/services/api.ts:12](client/src/services/api.ts:12)<br>[server/middleware/auth.js:3](server/middleware/auth.js:3)<br>[server/index.js:34](server/index.js:34) | Client stores and sends literal `dummy-token`; server mounts routes directly and never imports its auth middleware. | Authentication-looking code provides no server-side authorization and is likely to mislead maintainers. |
| [server/config/firebase.js:33](server/config/firebase.js:33) | Firebase Auth is initialized and exported but has no consumer anywhere in `server/`. | This is leftover infrastructure that contradicts the active plaintext-auth implementation. |
| [client/src/components/delivery/DeliveryHome.tsx:22](client/src/components/delivery/DeliveryHome.tsx:22)<br>[server/routes/delivery.js:11](server/routes/delivery.js:11) | Every ten seconds the client posts password `"dummy"` to an endpoint that compares the real password; returned `currentUser` is unused. | It creates recurring guaranteed 401s and dead network traffic. |
| [server/routes/restaurant.js:8](server/routes/restaurant.js:8) | Restaurant profile endpoint explicitly says “for now” and always returns `null`. | A public API route appears implemented but cannot return a restaurant. |
| [server/routes/orders.js:146](server/routes/orders.js:146)<br>[server/routes/orders.js:157](server/routes/orders.js:157)<br>[server/routes/orders.js:219](server/routes/orders.js:219) | Delivery-order lookup always returns `[]`, order-by-ID returns a hardcoded pizza, and assignment only returns a success message without writing data. | Three production-looking endpoints remain explicit mocks/stubs. |
| [server/routes/restaurant.js:51](server/routes/restaurant.js:51)<br>[server/models/Restaurant.js:93](server/models/Restaurant.js:93) | Active profile update calls `Restaurant.findByOwnerId`, but the class defines no such method. | Restaurant profile updates fail at runtime before any update can occur. |
| [server/routes/delivery.js:278](server/routes/delivery.js:278)<br>[server/models/User.js:153](server/models/User.js:153) | Delivery completion calls nonexistent `User.updateDeliveryStatus`. | The order and earnings are written first, then the request fails, leaving a partially committed operation. |
| [server/routes/orders.js:8](server/routes/orders.js:8)<br>[server/routes/orders.js:11](server/routes/orders.js:11) | Unused assignment helper calls nonexistent `User.findFreeRiders`. | This is dead code from an abandoned automatic-assignment design that cannot work if revived. |
| [server/models/Restaurant.js:59](server/models/Restaurant.js:59)<br>[server/routes/customer.js:84](server/routes/customer.js:84)<br>[server/routes/restaurant.js:123](server/routes/restaurant.js:123) | `Restaurant` model stores a separate `restaurants` collection, while browsing/menu code treats restaurant-role documents in `users` as canonical. | Two incompatible persistence models can diverge, producing updates invisible to customers. |
| [server/models/Points.js:16](server/models/Points.js:16)<br>[server/routes/points.js:16](server/routes/points.js:16) | Unused `Points` model creates random documents containing `userId`; active routes instead use `points/{customerId}` without `userId`. | Parallel schemas indicate an abandoned migration and would create mutually invisible point balances. |
| [client/src/components/customer/Cart.tsx:106](client/src/components/customer/Cart.tsx:106)<br>[client/src/components/customer/Cart.tsx:121](client/src/components/customer/Cart.tsx:121) | “For now” multi-restaurant checkout launches one unawaited mutation per restaurant after redeeming points once, then applies the same discount to every group. | Partial order creation and duplicated discounts become possible as soon as a cart spans restaurants. |
| [client/src/pages/LoginPage.tsx:31](client/src/pages/LoginPage.tsx:31)<br>[client/src/components/delivery/DeliveryMap.tsx:89](client/src/components/delivery/DeliveryMap.tsx:89) | Frontend still contains explicit temporary behavior: login always returns home and delivery is a hardcoded 20-second animation. | These “for now” paths encode demo behavior in normal product flows. |
| [client/src/components/LocationPickerMap.tsx:69](client/src/components/LocationPickerMap.tsx:69)<br>[client/src/components/LocationPickerMap.tsx:126](client/src/components/LocationPickerMap.tsx:126) | Build warns that the empty-dependency effect captures `defaultLat`, `defaultLng`, and `reverseGeocode`. | Prop/callback changes leave map listeners using stale values. |
| [client/src/components/delivery/OrderManagement.tsx:100](client/src/components/delivery/OrderManagement.tsx:100)<br>[client/src/components/delivery/OrderManagement.tsx:150](client/src/components/delivery/OrderManagement.tsx:150)<br>[client/src/components/restaurant/Insights.tsx:25](client/src/components/restaurant/Insights.tsx:25) | Build reports unused reject/pickup handlers, `readyOrders`, and tooltip formatter; the mutations exist but have no UI path. | This is orphaned feature code that will drift without being exercised. |
| [src/badges/types.ts:8](src/badges/types.ts:8)<br>[client/src/badges/types.ts:8](client/src/badges/types.ts:8)<br>[server/services/badgeService.js:3](server/services/badgeService.js:3) | Badge definitions/types are copied between root and client; they have already diverged because only the client type includes tip metrics. | Future badge changes must be synchronized manually across two sources of truth. |
| [tests/example.test.js:30](tests/example.test.js:30)<br>[LOCAL_SETUP.md:22](LOCAL_SETUP.md:22) | Root test imports nonexistent `src/utils/businessLogic`; `npm test` was verified to fail before running any of its 100 tests. | The advertised primary test command provides zero regression coverage. |
| [client/src/App.test.tsx:5](client/src/App.test.tsx:5)<br>[client/src/App.tsx:2](client/src/App.tsx:2) | Test is untouched CRA boilerplate looking for “learn react”; current test run fails earlier because CRA/Jest cannot resolve React Router 7. | Frontend tests neither load the application nor assert current behavior. |
| [server/package.json:9](server/package.json:9) | `npm test` is defined, but the server contains no test files; verified command exits 1 with “No tests found.” | Backend business-critical routes have no executable regression suite. |
| [.eslintignore:2](.eslintignore:2)<br>[package.json:12](package.json:12) | Root lint explicitly ignores both `client/` and `server/` and only lints `tests/` plus Jest config. | The advertised lint command checks essentially none of the product code. |
| [README.md:20](README.md:20)<br>[README.md:73](README.md:73)<br>[README.md:76](README.md:76) | README names nonexistent `frontend/backend` directories, says React 18 rather than 19, and claims Firebase Auth despite plaintext custom auth. | New maintainers receive an inaccurate architecture and security model. |
| [README.md:102](README.md:102)<br>[server/routes/points.js:194](server/routes/points.js:194)<br>[client/src/components/customer/RestaurantList.tsx:247](client/src/components/customer/RestaurantList.tsx:247) | README says 10% points and 15% Local Legend bonus; backend awards one point per dollar with no Local Legend branch while UI still promises “Extra Points.” | Product behavior, documentation, and UI make contradictory reward promises. |
| [README.md:2](README.md:2)<br>[README.md:148](README.md:148) | README links `.github/workflows/ci.yml` and claims live CI, but no `.github` workflow is tracked; root tests are broken. | Status badges and maintenance claims cannot be reproduced from this repository. |
| [docs/API.md:63](docs/API.md:63)<br>[server/routes/auth.js:82](server/routes/auth.js:82)<br>[docs/API.md:95](docs/API.md:95) | API docs specify `GET /auth/profile` and Authorization headers; implementation uses POSTed email/password and most routes have no auth middleware. | Integrators following the documentation will call wrong methods and assume nonexistent authorization. |
| [docs/API.md:162](docs/API.md:162)<br>[server/routes/orders.js:184](server/routes/orders.js:184)<br>[docs/API.md:171](docs/API.md:171)<br>[server/routes/orders.js:245](server/routes/orders.js:245) | Documented order statuses and rating body do not match validators: docs use accepted/rejected/picked_up and nested ratings; code expects confirmed/out_for_delivery/cancelled plus `rating`, `review`, and `customerId`. | Documented clients receive validation failures. |
| [docs/API.md:183](docs/API.md:183)<br>[server/routes/points.js:10](server/routes/points.js:10)<br>[docs/API.md:277](docs/API.md:277)<br>[server/routes/restaurant.js:111](server/routes/restaurant.js:111)<br>[docs/API.md:298](docs/API.md:298)<br>[server/routes/delivery.js:11](server/routes/delivery.js:11) | Points docs omit required `customerId`; menu docs omit required `ownerId`; delivery docs advertise GET/PUT profile while only POST exists. | Several documented API contracts are unusable as written. |
| [docs/INSTALL.md:28](docs/INSTALL.md:28)<br>[docs/INSTALL.md:136](docs/INSTALL.md:136) | Installation guide tells users to copy nonexistent `client/env.example` and lists nonexistent `shared/`. | Fresh setup instructions fail and reinforce an obsolete repository layout. |


# KP3 — Build failure triage


1. Classification + confidence

- **(a) Code rot: 1%**
- **(b) Local setup: 96% — primary classification**
- **(c) Real project bug: 3%** — configuration validation and the main README are weak, but the documented setup avoids the failure.

2. Root cause

With no `server/.env`:

- `project_id` is read from the missing `FIREBASE_PROJECT_ID` variable in [server/config/firebase.js:7](server/config/firebase.js:7).
- `FIRESTORE_EMULATOR_HOST` is also absent, so the emulator branch at [server/config/firebase.js:20](server/config/firebase.js:20) is skipped.
- The code therefore calls `admin.credential.cert(serviceAccount)` with undefined credential fields at [server/config/firebase.js:26](server/config/firebase.js:26), producing the reported `project_id` error.

The repository’s local setup explicitly requires copying the supplied environment file and starting the emulator: [LOCAL_SETUP.md:8](LOCAL_SETUP.md:8). That file supplies both required emulator variables at [server/env.example:5](server/env.example:5).

There is no repository evidence that Node 22 caused this error.

3. Cheapest fix, in order of effort

1. Use the documented local emulator setup:

   ```bash
   cd proj2
   cp server/env.example server/.env
   docker compose up -d
   cd server
   node index.js
   ```

2. If you do not want the emulator, remove `FIRESTORE_EMULATOR_HOST` from `server/.env` and provide all service-account fields listed in [server/env.example:8](server/env.example:8). The repository does not provide those credential values.

3. Optional project hardening: change `firebase.js` to detect missing configuration and emit an actionable startup error. The main README’s quick start also omits the required environment/emulator steps at [README.md:28](README.md:28), which is a documentation defect but not the direct runtime cause.


# KP4 — Main feature check (voice ordering)


## 1. Actor, trigger, and main flow

1. An authenticated customer opens the customer dashboard, which renders the voice-command manager ([CustomerDashboard.tsx:67](client/src/pages/CustomerDashboard.tsx:67)).
2. The customer clicks the floating voice button; the client opens a modal and starts browser speech recognition, or displays an unsupported-browser error ([VoiceCommandManager.tsx:153](client/src/features/voice/components/VoiceCommandManager.tsx:153), [FloatingVoiceButton.tsx:22](client/src/features/voice/components/FloatingVoiceButton.tsx:22)).
3. Recognition listens in Korean (`ko-KR`); upon receiving a final transcript, it invokes classification once and stops listening ([useSpeechToText.ts:101](client/src/features/voice/hooks/useSpeechToText.ts:101), [useSpeechToText.ts:131](client/src/features/voice/hooks/useSpeechToText.ts:131)).
4. The client sends `{userText}` to `POST /voice/classify`, which reaches the server through the `/api/voice` mount ([gemini.ts:10](client/src/features/voice/api/gemini.ts:10), [index.js:42](server/index.js:42)).
5. The server asks Gemini to select one of five allowlisted commands and rejects an unknown response with HTTP 422 ([voice.js:6](server/routes/voice.js:6), [voice.js:67](server/routes/voice.js:67)).
6. The client displays a confirmation dialog and, after confirmation, executes navigation, logout, cart opening, or cart-total calculation ([VoiceCommandManager.tsx:129](client/src/features/voice/components/VoiceCommandManager.tsx:129), [VoiceCommandManager.tsx:195](client/src/features/voice/components/VoiceCommandManager.tsx:195)).

## 2. Does it work as intended?

**Partial.** The speech-to-classification-to-confirmation pipeline is implemented, but this is voice navigation/cart assistance rather than voice ordering: its complete action set is logout, profile, home, open cart, and calculate total ([actions.ts:1](client/src/features/voice/utils/actions.ts:1), [actions.ts:8](client/src/features/voice/utils/actions.ts:8)). Successful microphone recognition and Gemini classification are **UNVERIFIED** from repository code alone.

## 3. Three weaknesses or missing pieces

| File | Weakness or missing piece |
|---|---|
| [actions.ts:8](client/src/features/voice/utils/actions.ts:8), [voice.js:6](server/routes/voice.js:6) | No command can select a restaurant/menu item, add an item, checkout, or place an order; `/api/voice` therefore does not actually implement voice ordering. |
| [useSpeechToText.ts:102](client/src/features/voice/hooks/useSpeechToText.ts:102), [VoiceModal.tsx:49](client/src/features/voice/components/VoiceModal.tsx:49) | Recognition is hardcoded to Korean while the displayed prompt is English, producing an unexpected language mismatch; its practical accuracy is **UNVERIFIED**. |
| [env.example:24](server/env.example:24), [voice.js:39](server/routes/voice.js:39) | The example labels the Gemini key optional and leaves it unset, but the voice endpoint returns HTTP 500 without it, so a default local setup cannot use the feature. |


# KP5 — Existing test coverage for that feature


## 1. Existing tests touching `/api/voice`

**NONE FOUND.**

The repository contains only two test files:

- [App.test.tsx:8](client/src/App.test.tsx:8) asserts that “learn react” is rendered.
- [example.test.js:38](tests/example.test.js:38) and its other assertions test standalone business utilities, not the voice route, speech hook, classifier client, or voice UI. Its imports contain no voice modules ([example.test.js:5](tests/example.test.js:5)).

Neither contains an assertion against `/api/voice`, `/voice/classify`, `classifyWithGemini`, `useSpeechToText`, or a voice action.

## 2. Quality verdict

**Missing.**

There is zero assertion-level coverage for this feature. Moreover, the root Jest configuration only discovers JavaScript tests under `tests/` and explicitly excludes both `client/` and `server/` from coverage ([jest.config.js:3](jest.config.js:3), [jest.config.js:12](jest.config.js:12)). Consequently, regressions in the route, Gemini integration, speech recognition, confirmation flow, or action execution would not be detected.

## 3. Untested edge cases

- **Request validation:** missing, null, numeric, empty, and whitespace-only `userText`; the server rejects some invalid values but allows a whitespace-only string through to prompt construction ([voice.js:18](server/routes/voice.js:18), [voice.js:33](server/routes/voice.js:33)).
- **Configuration failure:** missing `GEMINI_API_KEY` should return HTTP 500 ([voice.js:39](server/routes/voice.js:39)).
- **Gemini responses:** valid action, missing candidates, blank output, unsupported action, extra whitespace, upstream HTTP errors, and network failures ([voice.js:67](server/routes/voice.js:67), [voice.js:71](server/routes/voice.js:71), [voice.js:78](server/routes/voice.js:78)).
- **Client API validation:** empty transcript, absent `actionId`, unsupported action, and backend error-message propagation ([gemini.ts:5](client/src/features/voice/api/gemini.ts:5), [gemini.ts:13](client/src/features/voice/api/gemini.ts:13), [gemini.ts:19](client/src/features/voice/api/gemini.ts:19)).
- **Speech recognition:** unsupported browser, `webkitSpeechRecognition` fallback, permission denial, interim-only results, multiple final events, manual stop, and component unmount ([useSpeechToText.ts:47](client/src/features/voice/hooks/useSpeechToText.ts:47), [useSpeechToText.ts:112](client/src/features/voice/hooks/useSpeechToText.ts:112), [useSpeechToText.ts:144](client/src/features/voice/hooks/useSpeechToText.ts:144)).
- **UI workflow:** classification failure, cancel versus confirm, duplicate clicks while classifying, and execution of each of the five actions ([VoiceCommandManager.tsx:117](client/src/features/voice/components/VoiceCommandManager.tsx:117), [VoiceCommandManager.tsx:190](client/src/features/voice/components/VoiceCommandManager.tsx:190), [performAction.ts:11](client/src/features/voice/utils/performAction.ts:11)).
- **True ordering behavior:** no test verifies selecting an item, adding it to the cart, or placing an order—none of those operations exist in the voice action list ([actions.ts:8](client/src/features/voice/utils/actions.ts:8)).


# KP6 — Write a test case


- Test name: `classifies a valid voice command as opening the cart`

Assumption: Gemini is mocked to return `openCart`; `test-api-key` is a non-secret placeholder. The test does not verify live Gemini accuracy.

```js
const express = require('express');
const request = require('supertest');
const axios = require('axios');

jest.mock('axios');

const voiceRoutes = require('../routes/voice');

const originalGeminiApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
  jest.clearAllMocks();
});

test('classifies a valid voice command as opening the cart', async () => {
  process.env.GEMINI_API_KEY = 'test-api-key';

  axios.post.mockResolvedValueOnce({
    data: {
      candidates: [{
        content: {
          parts: [{ text: 'openCart' }],
        },
      }],
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/voice', voiceRoutes);

  const response = await request(app)
    .post('/api/voice/classify')
    .send({ userText: 'Open my cart' });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ actionId: 'openCart' });
  expect(axios.post).toHaveBeenCalledWith(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    expect.objectContaining({
      contents: [
        expect.objectContaining({
          role: 'user',
          parts: [
            expect.objectContaining({
              text: expect.stringContaining(
                'The user said: "Open my cart"'
              ),
            }),
          ],
        }),
      ],
    }),
    { params: { key: 'test-api-key' } }
  );
});
```

This proves a valid `/api/voice/classify` request is sent to Gemini and returns the allowlisted `openCart` action.

Added at [server/tests/voice.test.js](server/tests/voice.test.js); it passes under Jest.


# KP7 — Gap analysis + test case for the gap


1. The gap, in one sentence

KP5 identified the missing `GEMINI_API_KEY` path as untested, even though it causes `/api/voice/classify` to return HTTP 500 ([voice.js:39](server/routes/voice.js:39)).

2. Why it’s risky

A missing or misconfigured deployment secret makes every voice command fail before Gemini is contacted, leaving users unable to use the feature.

3. Test case

Name: `rejects voice classification when the Gemini API key is missing`

```js
test('rejects voice classification when the Gemini API key is missing', async () => {
  delete process.env.GEMINI_API_KEY;

  const app = express();
  app.use(express.json());
  app.use('/api/voice', voiceRoutes);

  const response = await request(app)
    .post('/api/voice/classify')
    .send({ userText: 'Open my cart' });

  expect(response.status).toBe(500);
  expect(response.body).toEqual({
    error: 'Gemini API key is missing.',
  });
  expect(axios.post).not.toHaveBeenCalled();
});
```

This proves the endpoint fails fast with the documented error and does not contact Gemini when its API key is absent.

Added to [server/tests/voice.test.js](server/tests/voice.test.js); both voice tests pass.


# KP8 — Feature value / long-run viability


## 1. Verdict: worth reworking

Keep and repair the donation service; cut or substantially redesign the current voice feature. The repo contains no user research or usage telemetry, so actual adoption of either feature is **UNVERIFIED**.

## 2. Three pieces of evidence

1. **Donation supports the stated product proposition.** The README presents Meal-for-a-Meal as a core social-impact feature, and the homepage prominently displays its progress ([README.md:11](README.md:11), [README.md:66](README.md:66), [HomePage.tsx:77](client/src/pages/HomePage.tsx:77)). **Inference:** this makes donations strategically useful, although real customer demand is unverified.

2. **“Voice ordering” does not order anything.** Its entire action set is logout, profile, home, cart, and total calculation—there is no item selection, add-to-cart, checkout, or order placement ([actions.ts:8](client/src/features/voice/utils/actions.ts:8)). Adoption also requires supported browser speech recognition, Korean-language transcription, and a Gemini API key ([useSpeechToText.ts:47](client/src/features/voice/hooks/useSpeechToText.ts:47), [useSpeechToText.ts:102](client/src/features/voice/hooks/useSpeechToText.ts:102), [voice.js:39](server/routes/voice.js:39)). **Inference:** that is high adoption cost for limited added value.

3. **Donation data has conflicting sources of truth.** `/stats` reports meals by dividing delivered orders by ten, while `/update` modifies a separate settings counter that `/stats` never returns; donation history is stored independently again ([donations.js:9](server/routes/donations.js:9), [donations.js:42](server/routes/donations.js:42), [donations.js:76](server/routes/donations.js:76)). **Inference:** the concept is valuable, but the present implementation cannot reliably substantiate “Meals Donated.”

## 3. One long-term risk

Donation update and record endpoints are mounted without authentication or authorization, allowing callers to alter impact data ([index.js:40](server/index.js:40), [donations.js:43](server/routes/donations.js:43), [donations.js:97](server/routes/donations.js:97)). Incorrect public social-impact claims could create an expensive data-reconciliation and trust problem.