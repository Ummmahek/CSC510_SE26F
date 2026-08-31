# Project 1A: Use-case validation notes (UC8, UC11, UC13, UC17, UC18)

Companion to `uc-validation-notes.md` (UC10/14/15/16/20, PR #1).

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

## Results and traceability

The per-test results rows and traceability rows for these five UCs live in the
shared tables — `results-table.md` ("UC8, UC11, UC13, UC17, UC18" section) and
`traceability-table.md` — consolidated there after PR #1 merged, so this file
no longer duplicates them.
