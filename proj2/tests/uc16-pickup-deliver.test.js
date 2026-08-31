// UC16: Pick up and deliver an order (Delivery partner)
// Source under test: server/routes/delivery.js (POST /pickup/:orderId, POST /deliver/:orderId)
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
// Shares its fixture (two delivery partners + one ready order) with UC15 via
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

describe('UC16: Pick up and deliver an order (Delivery partner)', () => {
  let server;

  beforeAll(() => {
    const app = buildApp({ '/api/delivery': deliveryRoutes });
    server = app.listen(0);
  });

  afterAll((done) => { server.close(done); });

  beforeEach(() => db.__reset());

  async function claim(riderId, orderId) {
    const res = await request(server).post(`/api/delivery/accept/${orderId}`).send({ riderId });
    expect(res.status).toBe(200); // sanity: claim step of the shared UC15/UC16 flow must succeed
  }

  test('extension 1a: pickup never checks the order exists -- updates blind, and on a NONEXISTENT order that surfaces as an uncontrolled 500, not a clean 404 (delivery.js:204-209)', async () => {
    const res = await request(server)
      .post('/api/delivery/pickup/no-such-order')
      .send({ riderId: 'rider-A' });

    // The route has no `if (!orderDoc.exists)` guard at all (unlike /deliver, which does check --
    // see the 404 test below). It just calls orderRef.update({...}) directly. Our mock mirrors
    // real Firestore's behavior of rejecting update() on a missing document, so the "blind
    // update" manifests here as a 500 with a raw Firestore-style error message rather than
    // anything resembling a handled 404. This is worse for API consumers than a documented 404
    // would be, and is a direct consequence of the missing existence check the doc flags.
    expect(res.status).toBe(500);
  });

  test('extension 1a (continued): pickup also blindly overwrites status on an order that exists but is NOT in a pickup-appropriate state', async () => {
    const { orderId } = seedDeliveryFixture(db, { order: { status: 'delivered' } }); // already delivered!

    const res = await request(server)
      .post(`/api/delivery/pickup/${orderId}`)
      .send({ riderId: 'rider-A' });

    // No validation of current status either -- a "delivered" order can be stomped back into
    // "out_for_delivery" by anyone who knows its id.
    expect(res.status).toBe(200);
    const orderDoc = await db.collection('orders').doc(orderId).get();
    expect(orderDoc.data().status).toBe('out_for_delivery');
  });

  test('extension 2a: order not found at delivery -> 404 (delivery.js:234-236)', async () => {
    const res = await request(server)
      .post('/api/delivery/deliver/no-such-order')
      .send({ riderId: 'rider-A' });
    expect(res.status).toBe(404);
  });

  // --- HEADLINE FINDING ---
  // delivery.js:223-296 (the /deliver/:orderId handler) reads `riderId` from the request body
  // and uses it directly to look up a User and credit earnings -- it is NEVER compared against
  // `orderData.deliveryPartnerId` (the partner UC15 actually assigned). Any caller who knows an
  // orderId can complete someone else's delivery and get paid for it.
  test('STAR FINDING (clean case): Partner B, never assigned, completes Partner A\'s delivery and is credited -- Partner A gets nothing (delivery.js:223-268)', async () => {
    // Give Partner B a second, unrelated active order so that later in the /deliver handler,
    // `activeOrdersSnapshot` for Partner B is NOT empty -- this sidesteps a second, separate bug
    // (see the "UNRELATED BUG" test below) so this test isolates the security finding cleanly
    // with a plain 200 response. Seeded directly (not via seedDeliveryFixture, which would
    // redundantly re-seed both rider docs back to their fresh defaults).
    const { riderA, riderB, orderId } = seedDeliveryFixture(db);
    db.__seed('orders', 'order-decoy', {
      id: 'order-decoy',
      customerId: 'customer-2',
      restaurantId: 'restaurant-1',
      deliveryPartnerId: riderB.id,
      status: 'out_for_delivery',
      deliveryFee: 1,
      tipAmount: 0,
      totalAmount: 10,
    });

    // Legitimate UC15 flow: Partner A claims the real order.
    await claim(riderA.id, orderId);

    const beforeOrder = await db.collection('orders').doc(orderId).get();
    const beforeRiderA = await db.collection('users').doc(riderA.id).get();
    const beforeRiderB = await db.collection('users').doc(riderB.id).get();
    expect(beforeOrder.data().deliveryPartnerId).toBe(riderA.id);
    expect(beforeOrder.data().status).toBe('out_for_delivery');
    expect(beforeRiderA.data().totalEarnings).toBe(0);
    expect(beforeRiderB.data().totalEarnings).toBe(0);

    // Partner B -- a completely different, unrelated account who was never assigned this order
    // -- calls the delivery-completion endpoint with their OWN id.
    const deliverRes = await request(server)
      .post(`/api/delivery/deliver/${orderId}`)
      .send({ riderId: riderB.id });

    expect(deliverRes.status).toBe(200);
    const expectedEarning = beforeOrder.data().deliveryFee + beforeOrder.data().tipAmount; // 3 + 2 = 5
    expect(deliverRes.body.earning).toBe(expectedEarning);

    const afterOrder = await db.collection('orders').doc(orderId).get();
    const afterRiderA = await db.collection('users').doc(riderA.id).get();
    const afterRiderB = await db.collection('users').doc(riderB.id).get();

    // The order IS marked delivered...
    expect(afterOrder.data().status).toBe('delivered');
    // ...but the assignment record still says Partner A was the assigned partner...
    expect(afterOrder.data().deliveryPartnerId).toBe(riderA.id);
    // ...while Partner B -- who was never assigned -- is the one who got paid.
    expect(afterRiderB.data().totalEarnings).toBe(expectedEarning);
    // Partner A, the legitimately assigned partner, is credited nothing.
    expect(afterRiderA.data().totalEarnings).toBe(0);
  });

  // --- A SEPARATE, UNRELATED BUG this repo also has, discovered while building the above test ---
  // User.js never defines `updateDeliveryStatus`, but delivery.js:278 calls
  // `rider.updateDeliveryStatus('free')` whenever the delivering rider has no OTHER active order.
  // Since UC15 enforces "one active order at a time" (extension 2d), a rider completing their
  // one and only delivery is the COMMON case -- so this crash hits essentially every ordinary
  // delivery completion, not just the exploit path.
  test('UNRELATED BUG: completing a delivery for a rider with no other active order 500s AFTER already recording the delivery and paying out (delivery.js:278, User.updateDeliveryStatus is undefined)', async () => {
    const { riderA, orderId } = seedDeliveryFixture(db);
    await claim(riderA.id, orderId);

    const res = await request(server)
      .post(`/api/delivery/deliver/${orderId}`)
      .send({ riderId: riderA.id });

    // The response is a 500, not the 200 a client (or usecases.md's main-success description)
    // would expect -- but by the time the crash happens (line 278), the order update (line
    // 248-252) and the earnings credit (line 268, `rider.updateEarnings`) have ALREADY been
    // awaited and persisted. The client sees a server error for what the backend actually
    // recorded as a completed, paid delivery.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/updateDeliveryStatus is not a function/);

    const orderDoc = await db.collection('orders').doc(orderId).get();
    const riderDoc = await db.collection('users').doc(riderA.id).get();
    expect(orderDoc.data().status).toBe('delivered'); // side effect landed despite the 500
    expect(riderDoc.data().totalEarnings).toBe(5); // deliveryFee(3) + tipAmount(2), also landed
  });

  // Confirms the headline finding above ALSO fully lands even in the common (crashing) case --
  // i.e. the security bug is not merely a quirk of our "clean" isolation setup. Partner B is
  // credited and the order is marked delivered even though the response the caller sees is a
  // 500 caused by the unrelated bug above.
  test('STAR FINDING (common case, response is 500 due to the unrelated bug above, but the state corruption still fully lands)', async () => {
    const { riderA, riderB, orderId } = seedDeliveryFixture(db);
    await claim(riderA.id, orderId);

    const res = await request(server)
      .post(`/api/delivery/deliver/${orderId}`)
      .send({ riderId: riderB.id }); // Partner B was never assigned this order

    expect(res.status).toBe(500); // caused by User.updateDeliveryStatus, see test above -- NOT a clean success

    const orderDoc = await db.collection('orders').doc(orderId).get();
    const riderADoc = await db.collection('users').doc(riderA.id).get();
    const riderBDoc = await db.collection('users').doc(riderB.id).get();

    expect(orderDoc.data().status).toBe('delivered');
    expect(orderDoc.data().deliveryPartnerId).toBe(riderA.id); // still says A was assigned
    expect(riderBDoc.data().totalEarnings).toBe(5); // B got paid anyway
    expect(riderADoc.data().totalEarnings).toBe(0); // A got nothing
  });

  test('note (time-permitting): an unreasonably large deliveryFee/tipAmount is accepted and paid out with no upper bound (delivery.js:244)', async () => {
    const { riderA, orderId } = seedDeliveryFixture(db, {
      order: { deliveryFee: 999999, tipAmount: 999999 },
    });
    await claim(riderA.id, orderId);

    const res = await request(server)
      .post(`/api/delivery/deliver/${orderId}`)
      .send({ riderId: riderA.id });

    // Same unrelated 500 as above applies here too (riderA has no other active order), but the
    // earning value computed and credited before the crash is unbounded either way.
    const riderDoc = await db.collection('users').doc(riderA.id).get();
    expect(riderDoc.data().totalEarnings).toBe(1999998); // 999999 + 999999, no cap enforced anywhere
  });

  test('GET /orders (a rider reviewing their assignments) includes a computed earning field (delivery.js:37-85)', async () => {
    const { riderA, orderId } = seedDeliveryFixture(db, { order: { deliveryFee: 4, tipAmount: 6 } });
    await claim(riderA.id, orderId);

    const res = await request(server).get('/api/delivery/orders').query({ riderId: riderA.id });
    expect(res.status).toBe(200);

    const order = res.body.orders.find((o) => o.id === orderId);
    expect(order).toBeDefined();
    expect(order.earning).toBe(10); // deliveryFee(4) + tipAmount(6), computed at read time (delivery.js:60-62)
  });

  test('GET /orders requires a riderId -> 400 (delivery.js:42-44)', async () => {
    const res = await request(server).get('/api/delivery/orders');
    expect(res.status).toBe(400);
  });

  // Note only, no test: usecases.md 3a ("no proof of delivery exists at all") describes an
  // absent feature, not a code path we can exercise -- there is nothing to call.

  // --- Intentionally-failing "doc expectation" test ---
  // The STAR FINDING tests above assert what the code ACTUALLY does (an uninvolved partner
  // gets paid). This one instead asserts the correct, expected behavior implied by UC16 --
  // only the assigned partner should be able to complete a delivery and be paid for it -- on
  // purpose, so this is a visible red test in `npm test` / CI, not just a comment. Expected to
  // fail until delivery.js:223-268 compares the caller against orderData.deliveryPartnerId.
  test('[DOC EXPECTATION] only the assigned delivery partner should be able to complete an order and be paid (EXPECTED TO FAIL -- see STAR FINDING above for the real behavior)', async () => {
    const { riderA, riderB, orderId } = seedDeliveryFixture(db);
    // Give riderB an unrelated active order so the separate updateDeliveryStatus crash doesn't
    // muddy this specific assertion -- this test is about the ownership check, not that bug.
    db.__seed('orders', 'order-decoy', {
      id: 'order-decoy',
      customerId: 'customer-2',
      restaurantId: 'restaurant-1',
      deliveryPartnerId: riderB.id,
      status: 'out_for_delivery',
      deliveryFee: 1,
      tipAmount: 0,
      totalAmount: 10,
    });
    await claim(riderA.id, orderId);

    await request(server).post(`/api/delivery/deliver/${orderId}`).send({ riderId: riderB.id });

    const riderBDoc = await db.collection('users').doc(riderB.id).get();
    expect(riderBDoc.data().totalEarnings).toBe(0); // riderB was never assigned -- should never be paid
  });
});
