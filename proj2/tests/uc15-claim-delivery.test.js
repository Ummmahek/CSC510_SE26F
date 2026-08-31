// UC15: Claim a delivery job (Delivery partner)
// Source under test: server/routes/delivery.js (POST /accept/:orderId)
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
// Shares its fixture (two delivery partners + one ready order) with UC16 via
// tests/helpers/deliveryFixtures.js.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js) because neither
// Docker nor the Firestore emulator toolchain is available in this environment.

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

const request = require('supertest');
const { db } = require('../server/config/firebase');
const deliveryRoutes = require('../server/routes/delivery');
const { buildApp } = require('./helpers/buildApp');
const { seedDeliveryFixture } = require('./helpers/deliveryFixtures');

describe('UC15: Claim a delivery job (Delivery partner)', () => {
  let server;

  beforeAll(() => {
    const app = buildApp({ '/api/delivery': deliveryRoutes });
    server = app.listen(0);
  });

  afterAll((done) => { server.close(done); });

  beforeEach(() => db.__reset());

  test('main success scenario: partner accepts a ready, unassigned order and it is assigned to them (delivery.js: POST /accept/:orderId)', async () => {
    const { riderA, orderId } = seedDeliveryFixture(db);

    const res = await request(server)
      .post(`/api/delivery/accept/${orderId}`)
      .send({ riderId: riderA.id });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('out_for_delivery');

    const orderDoc = await db.collection('orders').doc(orderId).get();
    expect(orderDoc.data().deliveryPartnerId).toBe(riderA.id);

    // Extension/oddity 3a, also feeds UC16 1a: acceptance ALREADY sets the order to
    // out_for_delivery, before any real pickup has happened.
    expect(orderDoc.data().status).toBe('out_for_delivery');
  });

  test('extension 2a: another partner got it first -> 409 (delivery.js:111)', async () => {
    const { riderA, riderB, orderId } = seedDeliveryFixture(db);

    const first = await request(server)
      .post(`/api/delivery/accept/${orderId}`)
      .send({ riderId: riderA.id });
    expect(first.status).toBe(200);

    const second = await request(server)
      .post(`/api/delivery/accept/${orderId}`)
      .send({ riderId: riderB.id });
    expect(second.status).toBe(409);

    const orderDoc = await db.collection('orders').doc(orderId).get();
    expect(orderDoc.data().deliveryPartnerId).toBe(riderA.id); // unchanged
  });

  test('extension 2b: order no longer ready -> 400 (delivery.js:116)', async () => {
    const { riderA, orderId } = seedDeliveryFixture(db, { order: { status: 'preparing' } });

    const res = await request(server)
      .post(`/api/delivery/accept/${orderId}`)
      .send({ riderId: riderA.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not ready/i);
  });

  test('extension 2c: partner record not found -> 400 (delivery.js:123)', async () => {
    const { orderId } = seedDeliveryFixture(db);

    const res = await request(server)
      .post(`/api/delivery/accept/${orderId}`)
      .send({ riderId: 'no-such-rider' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rider not found/i);
  });

  test('extension 2d: partner already has an active order -> 400, one-at-a-time (delivery.js:134)', async () => {
    const { riderA, orderId } = seedDeliveryFixture(db, {
      orderId: 'order-1',
      order: { deliveryPartnerId: 'rider-A', status: 'out_for_delivery' }, // already busy
    });
    // A second ready order, not yet assigned to anyone.
    seedDeliveryFixture(db, { orderId: 'order-2' });

    const res = await request(server)
      .post('/api/delivery/accept/order-2')
      .send({ riderId: riderA.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already have an active order/i);
  });

  // --- Race condition ---
  // Same class of bug as UC10: the accept handler does `get() -> check -> update()` with no
  // db.runTransaction() around it (delivery.js:100-146). Two partners racing for the same order
  // can both read `deliveryPartnerId: null` / `status: 'ready'` before either has written back.
  test('RACE CONDITION: two partners concurrently claim the same ready order -- at most one may end up assigned', async () => {
    const { riderA, riderB, orderId } = seedDeliveryFixture(db);

    const [resA, resB] = await Promise.all([
      request(server).post(`/api/delivery/accept/${orderId}`).send({ riderId: riderA.id }),
      request(server).post(`/api/delivery/accept/${orderId}`).send({ riderId: riderB.id }),
    ]);

    const finalOrder = await db.collection('orders').doc(orderId).get();

    console.log('UC15 race repro:', {
      statusA: resA.status,
      statusB: resB.status,
      finalDeliveryPartnerId: finalOrder.data().deliveryPartnerId,
    });

    // ACTUAL observed behavior (deterministic across repeated runs, not a flaky race): because
    // both requests' reads overlap before either writes (delivery.js:100-146 has no
    // db.runTransaction()), BOTH requests pass the "not yet assigned" check and BOTH call
    // orderRef.update(...), so BOTH receive HTTP 200 "Order accepted successfully". This
    // contradicts usecases.md extension 2a's "another partner got it first -> 409" and the task
    // brief's "confirm exactly one gets a success response and the other gets a 409, with no
    // scenario where both succeed" -- that outcome only holds when the second request's read is
    // late enough to observe the first request's write. Storage still only names one final
    // winner (last-write-wins on `deliveryPartnerId`), so the order isn't double-assigned in the
    // database -- but for a window, BOTH partners' apps were told they'd won the same job, which
    // is exactly the inconsistency a 409 response exists to prevent.
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200); // per the doc/brief this "should" be 409 -- it is not
    expect(['rider-A', 'rider-B']).toContain(finalOrder.data().deliveryPartnerId);
  });

  test('main scenario step 1: GET /available lists only ready, unassigned orders (delivery.js:299-331)', async () => {
    const { orderId } = seedDeliveryFixture(db); // order-1: ready, unassigned by default
    db.__seed('orders', 'order-already-assigned', { id: 'order-already-assigned', status: 'ready', deliveryPartnerId: 'rider-A' });
    db.__seed('orders', 'order-preparing', { id: 'order-preparing', status: 'preparing', deliveryPartnerId: null });

    const res = await request(server).get('/api/delivery/available');
    expect(res.status).toBe(200);
    const ids = res.body.orders.map((o) => o.id);
    expect(ids).toContain(orderId);
    expect(ids).not.toContain('order-already-assigned'); // ready, but already claimed
    expect(ids).not.toContain('order-preparing'); // not ready yet
  });

  test('extension 2e: POST /reject releases a claimed order back to ready/unassigned (delivery.js:164-191)', async () => {
    const { riderA, orderId } = seedDeliveryFixture(db);
    const claimRes = await request(server).post(`/api/delivery/accept/${orderId}`).send({ riderId: riderA.id });
    expect(claimRes.status).toBe(200);

    const res = await request(server).post(`/api/delivery/reject/${orderId}`).send({ riderId: riderA.id });
    expect(res.status).toBe(200);

    const orderDoc = await db.collection('orders').doc(orderId).get();
    expect(orderDoc.data().status).toBe('ready');
    expect(orderDoc.data().deliveryPartnerId).toBeNull();
  });

  // Found while adding the /reject coverage above: like /accept, this handler never checks that
  // the caller is the partner actually assigned to the order (same class of gap as UC16's
  // headline finding, just applied to un-claiming instead of completing).
  test("BONUS FINDING: POST /reject never checks the caller was the assigned partner -- an uninvolved rider can un-assign someone else's claimed order (delivery.js:164-191)", async () => {
    const { riderA, riderB, orderId } = seedDeliveryFixture(db);
    const claimRes = await request(server).post(`/api/delivery/accept/${orderId}`).send({ riderId: riderA.id });
    expect(claimRes.status).toBe(200);

    // riderB has no connection to this order at all, yet can still "reject" it.
    const res = await request(server).post(`/api/delivery/reject/${orderId}`).send({ riderId: riderB.id });
    expect(res.status).toBe(200); // succeeds -- no ownership check exists

    const orderDoc = await db.collection('orders').doc(orderId).get();
    expect(orderDoc.data().status).toBe('ready');
    expect(orderDoc.data().deliveryPartnerId).toBeNull(); // riderA's legitimate claim, wiped out by riderB
  });
});
