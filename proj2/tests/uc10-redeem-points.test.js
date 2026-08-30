// UC10: Redeem points for a discount (Customer)
// Source under test: server/routes/points.js
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js) because neither
// Docker nor the Firestore emulator toolchain is available in this environment. The mock's
// get()/set()/update() resolve on a real (delayed) setTimeout rather than an immediate
// microtask specifically so that two concurrently-fired HTTP requests can genuinely interleave
// at the `await pointsRef.get()` boundary -- this is what makes the race-condition test below a
// faithful reproduction of the check-then-act bug rather than an artifact of the mock.

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

const request = require('supertest');
const { db } = require('../server/config/firebase');
const { router: pointsRoutes } = require('../server/routes/points');
const { buildApp } = require('./helpers/buildApp');

describe('UC10: Redeem points for a discount (Customer)', () => {
  let server;

  beforeAll(() => {
    const app = buildApp({ '/api/points': pointsRoutes });
    server = app.listen(0);
  });

  afterAll((done) => { server.close(done); });

  beforeEach(() => db.__reset());

  function seedPoints(customerId, availablePoints) {
    db.__seed('points', customerId, {
      totalPoints: availablePoints,
      availablePoints,
      usedPoints: 0,
      transactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  test('main success scenario: redeem points at 1 point = $0.01, balance deducted and redemption logged (points.js:68-140)', async () => {
    seedPoints('cust-1', 500);

    const res = await request(server)
      .post('/api/points/use')
      .send({ customerId: 'cust-1', points: 200 });

    expect(res.status).toBe(200);
    expect(res.body.discountAmount).toBeCloseTo(2.0);
    expect(res.body.remainingPoints).toBe(300);

    const doc = await db.collection('points').doc('cust-1').get();
    expect(doc.data().availablePoints).toBe(300);
    expect(doc.data().usedPoints).toBe(200);
    expect(doc.data().transactions[0]).toMatchObject({ type: 'used', amount: -200 });
  });

  test('extension 2a: points < 1 or non-integer -> 400 (points.js:69)', async () => {
    seedPoints('cust-1', 500);

    const zero = await request(server).post('/api/points/use').send({ customerId: 'cust-1', points: 0 });
    expect(zero.status).toBe(400);

    const decimal = await request(server)
      .post('/api/points/use')
      .send({ customerId: 'cust-1', points: 12.5 });
    expect(decimal.status).toBe(400);

    const negative = await request(server)
      .post('/api/points/use')
      .send({ customerId: 'cust-1', points: -10 });
    expect(negative.status).toBe(400);
  });

  test('extension 3a: insufficient balance -> 400 with available vs. requested points (points.js:92-97)', async () => {
    seedPoints('cust-1', 50);

    const res = await request(server).post('/api/points/use').send({ customerId: 'cust-1', points: 100 });
    expect(res.status).toBe(400);
    expect(res.body.availablePoints).toBe(50);
    expect(res.body.requestedPoints).toBe(100);
  });

  test('extension 3b: no points record for the customer -> 404 (points.js:85-88)', async () => {
    const res = await request(server)
      .post('/api/points/use')
      .send({ customerId: 'never-seen-customer', points: 10 });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Points account not found/i);
  });

  // --- HEADLINE FINDING ---
  // points.js:82-127 reads the points doc, computes new balances/transactions in JS, then calls
  // pointsRef.update(...) -- with no db.runTransaction() around the read+check+write. Two
  // concurrent redemption requests against the same account can both read the same starting
  // balance before either has written back, so both pass the "enough balance?" check.
  test('STAR FINDING: concurrent redemptions double-spend a balance that should only cover ONE of them (points.js:82-127, no transaction around read-then-update)', async () => {
    // 100 available points. Two concurrent requests for 60 points each: only one should be
    // affordable (60 + 60 = 120 > 100).
    seedPoints('cust-1', 100);

    const [resA, resB] = await Promise.all([
      request(server).post('/api/points/use').send({ customerId: 'cust-1', points: 60 }),
      request(server).post('/api/points/use').send({ customerId: 'cust-1', points: 60 }),
    ]);

    const finalDoc = await db.collection('points').doc('cust-1').get();
    const finalBalance = finalDoc.data().availablePoints;
    const usedTransactionCount = finalDoc.data().transactions.filter((t) => t.type === 'used').length;

    // ACTUAL observed behavior (this is the bug, not a flaky race -- rerun this test as many
    // times as you like, the 15ms mock delay makes the overlap deterministic):
    //
    //   - BOTH requests receive HTTP 200 "success" responses. The customer's client-visible
    //     experience is that 120 points' worth of discount ($1.20) was granted off a 100-point
    //     ($1.00) balance -- this is the double-spend.
    //   - The final stored `availablePoints` lands at 40, not below zero. This is a nuance worth
    //     calling out explicitly: both requests independently compute `100 - 60 = 40` from the
    //     SAME stale read (neither observes the other's write), so whichever update() commits
    //     last simply overwrites the field with 40 again -- a classic lost-update anomaly, not a
    //     cumulative decrement. Because each request's own insufficiency check is only ever
    //     evaluated against its own single points figure vs. its own stale read, this specific
    //     bug pattern (full-field overwrite, no increment/decrement) can never drive the stored
    //     balance negative for any set of concurrent requests -- it can only land on one of the
    //     individually-"valid" post-redemption values. The task brief's framing ("balance goes
    //     negative, or both redemptions are logged") anticipated two possible symptoms; what
    //     actually reproduces here is a third: both succeed, but the transaction log undercounts.
    //   - Only ONE "used" transaction ends up in the persisted history, not two. Both requests
    //     read `transactions: []`, so each independently computes a length-1 replacement array
    //     containing only its own entry; the update() overwrites the whole `transactions` field
    //     rather than appending, so whichever write lands last erases the other's transaction
    //     record from the audit trail. The redemption still happened (the customer got their
    //     discount and a 200) -- there's just no evidence of it afterward.
    expect([resA.status, resB.status]).toEqual([200, 200]); // both succeed -- this is the double-spend
    expect(finalBalance).toBe(40);
    expect(usedTransactionCount).toBe(1); // one of the two redemptions vanished from the log

    // Sanity check on the actual harm: sum of what both responses told the customer they
    // redeemed exceeds the 100-point balance that was supposed to cap total redemptions.
    const totalPointsClaimedRedeemed = resA.body.pointsUsed + resB.body.pointsUsed;
    expect(totalPointsClaimedRedeemed).toBe(120); // > 100 available -- the double-spend, quantified
  });

  // POST /calculate-discount shares /use's balance-check logic but is meant as a pure preview
  // (e.g. showing the discount live as a customer types a points amount, before they commit).
  test('POST /calculate-discount previews the discount WITHOUT deducting any points (points.js:142-186)', async () => {
    seedPoints('cust-1', 500);

    const res = await request(server)
      .post('/api/points/calculate-discount')
      .send({ customerId: 'cust-1', points: 200 });

    expect(res.status).toBe(200);
    expect(res.body.discountAmount).toBeCloseTo(2.0);
    expect(res.body.maxDiscount).toBeCloseTo(5.0); // 500 available points * $0.01

    // Confirm this really is a preview -- the stored balance is untouched.
    const doc = await db.collection('points').doc('cust-1').get();
    expect(doc.data().availablePoints).toBe(500);
  });

  test('POST /calculate-discount: insufficient balance -> 400, same guard as /use (points.js:166-172)', async () => {
    seedPoints('cust-1', 50);
    const res = await request(server)
      .post('/api/points/calculate-discount')
      .send({ customerId: 'cust-1', points: 100 });
    expect(res.status).toBe(400);
    expect(res.body.availablePoints).toBe(50);
    expect(res.body.requestedPoints).toBe(100);
  });

  test('POST /calculate-discount: no points record -> 404 (points.js:159-161)', async () => {
    const res = await request(server)
      .post('/api/points/calculate-discount')
      .send({ customerId: 'never-seen-customer', points: 10 });
    expect(res.status).toBe(404);
  });

  // Secondary finding (per assignment brief): points are deducted before the order is created,
  // and order creation is fired without awaiting the result
  // (client/src/components/customer/Cart.tsx:84-85, 120) -- if order creation fails there is no
  // rollback of the point deduction.
  //
  // We read Cart.tsx to confirm this is real: handlePlaceOrder awaits
  // `usePointsMutation.mutateAsync(pointsToUse)` first (Cart.tsx:85, so the deduction itself
  // does complete/fail synchronously w.r.t. the handler), then loops over per-restaurant groups
  // calling `placeOrderMutation.mutate({...})` (Cart.tsx:121) -- `.mutate()`, not `.mutateAsync()`,
  // inside a plain (unawaited) `.forEach` -- so order creation is fire-and-forget relative to the
  // already-completed point deduction. There is no compensating "refund points" call anywhere in
  // this file or in points.js, so a later order-creation failure leaves the points gone with
  // nothing to show for them. We did NOT add an automated test for it: this is React component
  // logic, and jest.config.js pins
  // `testEnvironment: 'node'` with no jsdom / @testing-library/react in this repo's
  // devDependencies -- exercising Cart.tsx would mean standing up a whole new frontend test
  // stack, which felt out of scope for a single secondary/time-permitting note. Flagging this
  // explicitly rather than silently skipping it.

  // --- Intentionally-failing "doc expectation" test ---
  // The STAR FINDING test above asserts what the code ACTUALLY does (both requests succeed).
  // This one instead asserts the correct, expected behavior implied by usecases.md's redemption
  // flow -- a balance that can only cover one of two concurrent requests should let exactly one
  // through -- on purpose, so this is a visible red test in `npm test` / CI, not just a comment.
  // Expected to fail until points.js:82-127 gets a real transaction around read-then-update.
  test('[DOC EXPECTATION] concurrent redemptions must not exceed the available balance (EXPECTED TO FAIL -- see STAR FINDING above for the real behavior)', async () => {
    seedPoints('cust-1', 100);

    const [resA, resB] = await Promise.all([
      request(server).post('/api/points/use').send({ customerId: 'cust-1', points: 60 }),
      request(server).post('/api/points/use').send({ customerId: 'cust-1', points: 60 }),
    ]);

    const successCount = [resA, resB].filter((r) => r.status === 200).length;
    expect(successCount).toBe(1); // exactly one of the two should be affordable
  });
});
