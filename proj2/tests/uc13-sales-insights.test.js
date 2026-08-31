// UC13: Review sales performance (Restaurant)
// Source under test: server/routes/orders.js GET /restaurant — the only server-side
// half of this use case. The aggregation itself (volume/revenue charts) runs in the
// browser (client/src/components/restaurant/Insights.tsx) and cannot be exercised
// here: the client test runner is broken as inherited (react-router-dom v7 cannot be
// resolved by CRA 5's Jest — see traceability notes). These tests therefore pin down
// the data contract the client aggregation depends on.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js).

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

const request = require('supertest');
const { db } = require('../server/config/firebase');
const orderRoutes = require('../server/routes/orders');
const { buildApp } = require('./helpers/buildApp');

// supertest accepts the app object directly — no real TCP listener needed.
const app = buildApp({ '/api/orders': orderRoutes });

describe('UC13: Review sales performance (Restaurant)', () => {
  beforeEach(() => db.__reset());

  function seedOrder(id, restaurantId, overrides = {}) {
    db.__seed('orders', id, {
      customerId: 'cust-1',
      restaurantId,
      items: [{ menuItemId: 'item-1', quantity: 1, price: 10 }],
      totalAmount: 10,
      status: 'delivered',
      createdAt: new Date('2026-08-01T12:00:00Z'),
      updatedAt: new Date('2026-08-01T12:00:00Z'),
      ...overrides,
    });
  }

  test("main success scenario: returns exactly the restaurant's own orders (orders.js:113-142)", async () => {
    seedOrder('order-1', 'rest-1');
    seedOrder('order-2', 'rest-1', { totalAmount: 25 });
    seedOrder('order-3', 'rest-OTHER');

    const res = await request(app).get('/api/orders/restaurant?restaurantId=rest-1');

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.orders.map((o) => o.id).sort()).toEqual(['order-1', 'order-2']);
  });

  test('data contract for the client-side aggregation: totalAmount, status, and serialized dates are present (orders.js:127-137)', async () => {
    seedOrder('order-1', 'rest-1');

    const res = await request(app).get('/api/orders/restaurant?restaurantId=rest-1');

    const order = res.body.orders[0];
    expect(order.totalAmount).toBe(10);
    expect(order.status).toBe('delivered');
    // Insights.tsx builds time buckets from createdAt; it must serialize to a valid date.
    expect(Number.isNaN(Date.parse(order.createdAt))).toBe(false);
  });

  test('extension 2a: missing restaurantId -> 400 (orders.js:119)', async () => {
    const res = await request(app).get('/api/orders/restaurant');
    expect(res.status).toBe(400);
  });

  test('extension 2b (documented cost): the endpoint returns the FULL raw order list — no server-side aggregation, pagination, or date filtering exists for the insights view', async () => {
    for (let i = 0; i < 60; i++) seedOrder(`order-${i}`, 'rest-1');

    const res = await request(app).get('/api/orders/restaurant?restaurantId=rest-1');

    // All 60 come back in one response; the browser does all aggregation
    // (client/src/components/restaurant/Insights.tsx:1-45), so payload size grows
    // linearly with order history.
    expect(res.body.orders).toHaveLength(60);
  });
});
