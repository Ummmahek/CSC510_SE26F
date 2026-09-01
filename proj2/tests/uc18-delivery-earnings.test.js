// UC18: Review my delivery earnings (Delivery partner)
// Source under test: server/routes/delivery.js GET /orders (the earnings the client
// actually displays) and POST /deliver + models/User.js updateEarnings (the
// server-side totalEarnings bookkeeping the client never reads).
// See proj1a-report/usecases.md UC18 for the two-bookkeeping-systems finding.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js).
// The deliver flow's known unrelated bug (User.updateDeliveryStatus is undefined ->
// 500 AFTER persisting, found by the UC16 suite) is avoided here the same way the
// UC16 suite does it: the rider is given a second active order so the buggy branch
// is skipped and delivery completes with 200.

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

const request = require('supertest');
const { db } = require('../server/config/firebase');
const deliveryRoutes = require('../server/routes/delivery');
const { buildApp } = require('./helpers/buildApp');
const { seedDeliveryFixture } = require('./helpers/deliveryFixtures');

// supertest accepts the app object directly — no real TCP listener needed.
const app = buildApp({ '/api/delivery': deliveryRoutes });

describe('UC18: Review my delivery earnings (Delivery partner)', () => {
  beforeEach(() => db.__reset());

  // Keep the rider "busy" so POST /deliver skips the updateDeliveryStatus branch
  // (delivery.js:270-280) and returns 200 instead of the known unrelated 500.
  function seedBusyWork(riderId) {
    db.__seed('orders', `busy-${riderId}`, {
      customerId: 'cust-x',
      restaurantId: 'rest-x',
      items: [],
      totalAmount: 5,
      deliveryFee: 1,
      tipAmount: 0,
      status: 'out_for_delivery',
      deliveryPartnerId: riderId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  test('main success scenario: GET /orders exposes a computed per-order earning = deliveryFee + tipAmount (delivery.js:58-61)', async () => {
    const { riderA, orderId } = seedDeliveryFixture(db, {
      order: { deliveryPartnerId: 'rider-A', status: 'out_for_delivery', deliveryFee: 3, tipAmount: 2 },
    });

    const res = await request(app).get(`/api/delivery/orders?riderId=${riderA.id}`);

    expect(res.status).toBe(200);
    const order = res.body.orders.find((o) => o.id === orderId);
    expect(order.earning).toBe(5);
  });

  test('missing riderId -> 400 (delivery.js:42-44)', async () => {
    const res = await request(app).get('/api/delivery/orders');
    expect(res.status).toBe(400);
  });

  test('non-numeric deliveryFee/tipAmount coerce to 0 in the displayed earning, not NaN (delivery.js:58-60)', async () => {
    seedDeliveryFixture(db, {
      order: { deliveryPartnerId: 'rider-A', status: 'out_for_delivery', deliveryFee: 'free', tipAmount: undefined },
    });

    const res = await request(app).get('/api/delivery/orders?riderId=rider-A');

    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].earning).toBe(0);
  });

  test('server-side bookkeeping: totalEarnings accumulates across deliveries (delivery.js:266-268, User.js:153-166)', async () => {
    const { riderA } = seedDeliveryFixture(db, {
      order: { id: 'order-1', deliveryPartnerId: 'rider-A', status: 'out_for_delivery', deliveryFee: 3, tipAmount: 2 },
      orderId: 'order-1',
    });
    db.__seed('orders', 'order-2', {
      customerId: 'customer-1',
      restaurantId: 'restaurant-1',
      items: [],
      totalAmount: 30,
      deliveryFee: 4,
      tipAmount: 1,
      status: 'out_for_delivery',
      deliveryPartnerId: 'rider-A',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    seedBusyWork('rider-A');

    const first = await request(app).post('/api/delivery/deliver/order-1').send({ riderId: riderA.id });
    expect(first.status).toBe(200);
    expect(first.body.earning).toBe(5);

    const second = await request(app).post('/api/delivery/deliver/order-2').send({ riderId: riderA.id });
    expect(second.status).toBe(200);
    expect(second.body.earning).toBe(5);

    const riderDoc = await db.collection('users').doc('rider-A').get();
    expect(riderDoc.data().totalEarnings).toBe(10);
  });

  test('two-bookkeeping-systems finding: totalEarnings is written on delivery but GET /orders never serves it — the client recomputes from the order list instead (delivery.js:47-77, Insights.tsx:23-43)', async () => {
    seedDeliveryFixture(db, {
      order: { deliveryPartnerId: 'rider-A', status: 'out_for_delivery' },
    });

    const res = await request(app).get('/api/delivery/orders?riderId=rider-A');

    // The response is built solely from order documents (delivery.js:47-49 queries
    // only the orders collection); the user document holding the totalEarnings
    // ledger is never read on this path. So the earnings screen and the ledger are
    // two independent bookkeeping systems that can disagree silently.
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['orders']);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0]).not.toHaveProperty('totalEarnings');
    // The per-order earning IS present — that's the number the client sums.
    expect(res.body.orders[0]).toHaveProperty('earning');
  });
});
