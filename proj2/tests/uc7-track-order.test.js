// UC7: Track my order (Customer)
// Source under test: server/routes/orders.js
//   - GET  /api/orders/customer     (the order-history list the tracking screen reads)
//   - GET  /api/orders/:id          (single-order lookup)
//   - PUT  /api/orders/:id/status   (status transitions whose timestamps the tracker shows)
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js) because neither
// Docker nor the Firestore emulator toolchain is available in this environment.

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

const request = require('supertest');
const { db } = require('../server/config/firebase');
const orderRoutes = require('../server/routes/orders');
const { buildApp } = require('./helpers/buildApp');

describe('UC7: Track my order (Customer)', () => {
  let server;

  beforeAll(() => {
    const app = buildApp({ '/api/orders': orderRoutes });
    server = app.listen(0);
  });

  afterAll((done) => { server.close(done); });

  beforeEach(() => db.__reset());

  function seedOrder(id, customerId, status, extra = {}) {
    db.__seed('orders', id, {
      id,
      customerId,
      restaurantId: 'restaurant-1',
      items: [{ menuItemId: 'm1', name: 'Wrap', price: 10, quantity: 1 }],
      totalAmount: 10,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extra,
    });
  }

  test('main success scenario: GET /customer lists this customer\'s orders, each with its current status (orders.js:83-105)', async () => {
    seedOrder('o1', 'cust-1', 'pending');
    seedOrder('o2', 'cust-1', 'out_for_delivery');

    const res = await request(server).get('/api/orders/customer').query({ customerId: 'cust-1' });

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    const byId = Object.fromEntries(res.body.orders.map((o) => [o.id, o]));
    expect(byId.o1.status).toBe('pending');
    expect(byId.o2.status).toBe('out_for_delivery');
    res.body.orders.forEach((o) => expect(o).toHaveProperty('createdAt'));
  });

  test('the list is scoped to the requesting customer (orders.js:93-95)', async () => {
    seedOrder('mine', 'cust-1', 'pending');
    seedOrder('theirs', 'cust-2', 'pending');

    const res = await request(server).get('/api/orders/customer').query({ customerId: 'cust-1' });

    expect(res.body.orders.map((o) => o.id)).toEqual(['mine']);
  });

  test('extension 2a: missing customerId -> 400 (orders.js:88-89)', async () => {
    const res = await request(server).get('/api/orders/customer');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/customer id required/i);
  });

  test('a customer with no orders gets 200 and an empty list, not an error (orders.js:93-105)', async () => {
    const res = await request(server).get('/api/orders/customer').query({ customerId: 'nobody' });
    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });

  // --- HEADLINE FINDING (usecases.md UC7 extension 2c) ---
  // orders.js:202 stamps `confirmedAt` only when the status becomes 'preparing', never when it
  // becomes 'confirmed'. A tracker that labels that timestamp "Confirmed at ..." is showing the
  // time the kitchen STARTED COOKING, mislabeled.
  test('STAR FINDING: moving an order to "confirmed" records no confirmedAt; moving it to "preparing" is what stamps it (orders.js:202)', async () => {
    seedOrder('o1', 'cust-1', 'pending');

    await request(server).put('/api/orders/o1/status').send({ status: 'confirmed' });
    let res = await request(server).get('/api/orders/customer').query({ customerId: 'cust-1' });
    expect(res.body.orders[0].status).toBe('confirmed');
    expect(res.body.orders[0].confirmedAt).toBeFalsy(); // the "confirmed" transition left no timestamp

    await request(server).put('/api/orders/o1/status').send({ status: 'preparing' });
    res = await request(server).get('/api/orders/customer').query({ customerId: 'cust-1' });
    expect(res.body.orders[0].status).toBe('preparing');
    expect(res.body.orders[0].confirmedAt).toBeTruthy(); // ... but "preparing" does stamp confirmedAt
  });

  // --- FINDING: single-order lookup is a stub ---
  // orders.js:157-180 returns a hardcoded mock order (customerId 'customer123', one Pizza,
  // status 'pending') for ANY :id, and never touches Firestore.
  test('FINDING: GET /:id returns fabricated mock data regardless of the id or the real order (orders.js:157-180)', async () => {
    seedOrder('real-1', 'cust-1', 'delivered');

    const bogus = await request(server).get('/api/orders/anything-at-all');
    expect(bogus.status).toBe(200);
    expect(bogus.body.order.customerId).toBe('customer123');
    expect(bogus.body.order.items[0].name).toBe('Pizza');
    expect(bogus.body.order.status).toBe('pending');

    // even asking for the seeded real order returns the same fake
    const real = await request(server).get('/api/orders/real-1');
    expect(real.body.order.customerId).toBe('customer123');
    expect(real.body.order.status).toBe('pending'); // not 'delivered'
  });

  // --- FINDING: no transition rules (usecases.md UC7 ext 2b, UC12 ext 3a) ---
  // orders.js:184 only checks the new status is in an enum; any value is accepted from any state.
  // orders.js:202 only stamps confirmedAt/readyAt on 'preparing'/'ready'. So an order can land on
  // 'delivered' with every intermediate milestone missing -- the tracking screen shows "Delivered"
  // above blank "Confirmed" / "Ready" steps.
  test('FINDING: an order jumps straight from pending to delivered, and the tracked timeline has no confirmedAt/readyAt (orders.js:184, 202)', async () => {
    seedOrder('o1', 'cust-1', 'pending');

    const put = await request(server).put('/api/orders/o1/status').send({ status: 'delivered' });
    expect(put.status).toBe(200);

    const res = await request(server).get('/api/orders/customer').query({ customerId: 'cust-1' });
    expect(res.body.orders[0].status).toBe('delivered');
    expect(res.body.orders[0].confirmedAt).toBeFalsy();
    expect(res.body.orders[0].readyAt).toBeFalsy();
  });

  // --- Intentionally-failing "doc expectation" test ---
  // Asserts what "Track my order" implies -- looking up an order by id returns THAT order -- on
  // purpose, so the stub endpoint is a visible red test. Expected to fail until GET /:id reads
  // Firestore instead of returning mock data.
  test('[DOC EXPECTATION] GET /:id must return the real order for that id (EXPECTED TO FAIL -- see FINDING above)', async () => {
    seedOrder('real-7', 'cust-7', 'delivered');

    const res = await request(server).get('/api/orders/real-7');
    expect(res.body.order.customerId).toBe('cust-7');
    expect(res.body.order.status).toBe('delivered');
  });
});
