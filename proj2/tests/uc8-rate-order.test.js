// UC8: Rate a delivered order (Customer)
// Source under test: server/routes/orders.js POST /:id/rate
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js) — same
// setup and rationale as the UC10/14/15/16/20 suites.

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

const request = require('supertest');
const { db } = require('../server/config/firebase');
const orderRoutes = require('../server/routes/orders');
const { buildApp } = require('./helpers/buildApp');

// supertest accepts the app object directly — no real TCP listener needed.
const app = buildApp({ '/api/orders': orderRoutes });

describe('UC8: Rate a delivered order (Customer)', () => {
  beforeEach(() => db.__reset());

  function seedOrder(id, overrides = {}) {
    db.__seed('orders', id, {
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      items: [{ menuItemId: 'item-1', quantity: 1, price: 20 }],
      totalAmount: 20,
      status: 'delivered',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  }

  test('main success scenario: a 1-5 star rating on an own delivered order is stored once (orders.js:245-303)', async () => {
    seedOrder('order-1');

    const res = await request(app)
      .post('/api/orders/order-1/rate')
      .send({ customerId: 'cust-1', rating: 4, review: 'good' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ orderId: 'order-1', rating: 4 });

    const doc = await db.collection('orders').doc('order-1').get();
    expect(doc.data().ratings.customer).toMatchObject({ rating: 4, review: 'good' });
  });

  test('review is optional: rating without review stores an empty review string', async () => {
    seedOrder('order-1');

    const res = await request(app)
      .post('/api/orders/order-1/rate')
      .send({ customerId: 'cust-1', rating: 5 });

    expect(res.status).toBe(200);
    const doc = await db.collection('orders').doc('order-1').get();
    expect(doc.data().ratings.customer.review).toBe('');
  });

  test.each([[0], [6], [3.5], ['four']])(
    'extension 1a: invalid rating %p -> 400 (orders.js:246)',
    async (rating) => {
      seedOrder('order-1');

      const res = await request(app)
        .post('/api/orders/order-1/rate')
        .send({ customerId: 'cust-1', rating });
      expect(res.status).toBe(400);
    }
  );

  test('extension 2a: order not found -> 404 (orders.js:262)', async () => {
    const res = await request(app)
      .post('/api/orders/no-such-order/rate')
      .send({ customerId: 'cust-1', rating: 4 });

    expect(res.status).toBe(404);
  });

  test("extension 2b: another customer's order -> 403 (orders.js:269)", async () => {
    seedOrder('order-1');

    const res = await request(app)
      .post('/api/orders/order-1/rate')
      .send({ customerId: 'someone-else', rating: 4 });

    expect(res.status).toBe(403);
  });

  test('extension 2c: order not delivered yet -> 400 (orders.js:273)', async () => {
    seedOrder('order-1', { status: 'preparing' });

    const res = await request(app)
      .post('/api/orders/order-1/rate')
      .send({ customerId: 'cust-1', rating: 4 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/delivered/i);
  });

  test('extension 2d: already rated -> 400, and the first rating survives (orders.js:278)', async () => {
    seedOrder('order-1');

    const first = await request(app)
      .post('/api/orders/order-1/rate')
      .send({ customerId: 'cust-1', rating: 2, review: 'first' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/orders/order-1/rate')
      .send({ customerId: 'cust-1', rating: 5, review: 'second' });
    expect(second.status).toBe(400);

    const doc = await db.collection('orders').doc('order-1').get();
    expect(doc.data().ratings.customer).toMatchObject({ rating: 2, review: 'first' });
  });

  test('extension 3a (documented derivation): rating is written only to the order document — the restaurant document is byte-identical before and after (orders.js:291-294)', async () => {
    seedOrder('order-1');
    db.__seed('users', 'rest-1', { role: 'restaurant', profile: { restaurantName: 'R' } });
    const before = (await db.collection('users').doc('rest-1').get()).data();

    await request(app)
      .post('/api/orders/order-1/rate')
      .send({ customerId: 'cust-1', rating: 4 });

    // Whole-document comparison (not a guessed field name): averages are recomputed
    // at read time by scanning orders (customer.js:97-122), which UC4/UC8 3a document.
    const after = (await db.collection('users').doc('rest-1').get()).data();
    expect(after).toEqual(before);
  });
});
