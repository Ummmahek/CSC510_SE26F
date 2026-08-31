// UC4: Browse nearby restaurants (Customer)
// Source under test: server/routes/customer.js
//   - GET /api/customer/restaurants             (list + per-read rating aggregation)
//   - GET /api/customer/restaurants-by-distance  (Haversine sort from the customer's saved point)
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js) because neither
// Docker nor the Firestore emulator toolchain is available in this environment.
//
// NOTE (documented, not asserted): customer.js:155 ends the GET /restaurants handler with an
// unguarded `console.log(restaurants[1].location)`. With 0 or 1 registered restaurants that throws
// a TypeError *after* res.json() has already sent 200, which the catch block then turns into
// ERR_HTTP_HEADERS_SENT (an unhandled rejection). We do not automate that -- it would pollute the
// raw-output capture -- but every test below seeds >= 2 restaurants to stay clear of it, which is
// itself the finding: the list endpoint is only safe above a hard-coded row count.

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

const request = require('supertest');
const { db } = require('../server/config/firebase');
const customerRoutes = require('../server/routes/customer');
const { buildApp } = require('./helpers/buildApp');

describe('UC4: Browse nearby restaurants (Customer)', () => {
  let server;

  beforeAll(() => {
    const app = buildApp({ '/api/customer': customerRoutes });
    server = app.listen(0);
  });

  afterAll((done) => { server.close(done); });

  beforeEach(() => db.__reset());

  function seedRestaurant(id, profile, location = null) {
    db.__seed('users', id, {
      id,
      email: `${id}@example.com`,
      password: 'pw',
      role: 'restaurant',
      profile,
      deliveryStatus: null,
      location,
      totalEarnings: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  function seedCustomer(id, location) {
    db.__seed('users', id, {
      id,
      email: `${id}@example.com`,
      password: 'pw',
      role: 'customer',
      profile: { name: 'Cust' },
      deliveryStatus: null,
      location,
      totalEarnings: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  function seedDeliveredRatedOrder(id, restaurantId, rating) {
    db.__seed('orders', id, {
      id,
      restaurantId,
      customerId: 'someone',
      status: 'delivered',
      ratings: { customer: { rating } },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  test('main success scenario: GET /restaurants returns every registered restaurant with its rating and menu (customer.js:80-154)', async () => {
    seedRestaurant('r1', { name: 'Alpha Diner', cuisine: 'American', menu: [{ name: 'Burger', price: 9 }] });
    seedRestaurant('r2', { name: 'Beta Sushi', cuisine: 'Japanese', menu: [] });

    const res = await request(server).get('/api/customer/restaurants');

    expect(res.status).toBe(200);
    expect(res.body.restaurants).toHaveLength(2);
    expect(res.body.restaurants.map((r) => r.name).sort()).toEqual(['Alpha Diner', 'Beta Sushi']);
    res.body.restaurants.forEach((r) => {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('rating');
      expect(r).toHaveProperty('menu');
    });
  });

  test('a restaurant user with no profile.name is silently omitted from the list (customer.js:96)', async () => {
    seedRestaurant('has-name-1', { name: 'Named One' });
    seedRestaurant('has-name-2', { name: 'Named Two' });
    seedRestaurant('no-name', { cuisine: 'Mystery' }); // no profile.name

    const res = await request(server).get('/api/customer/restaurants');

    expect(res.status).toBe(200);
    expect(res.body.restaurants).toHaveLength(2);
    expect(res.body.restaurants.map((r) => r.id)).not.toContain('no-name');
  });

  // usecases.md UC4 extension 2a: "Each restaurant's rating average is recomputed on every list
  // read by scanning all of its orders; no stored average exists."
  test('extension 2a: the rating is recomputed on read from delivered+rated orders only (customer.js:97-122)', async () => {
    seedRestaurant('rated', { name: 'Rated Place' });
    seedRestaurant('filler', { name: 'Filler' }); // keeps restaurants.length >= 2 (see file header)

    seedDeliveredRatedOrder('o1', 'rated', 5);
    seedDeliveredRatedOrder('o2', 'rated', 3);
    // a non-delivered order with a rating must NOT count
    db.__seed('orders', 'o3', {
      id: 'o3', restaurantId: 'rated', status: 'pending', ratings: { customer: { rating: 1 } },
      createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(server).get('/api/customer/restaurants');
    const rated = res.body.restaurants.find((r) => r.id === 'rated');

    expect(rated.rating).toBe(4); // (5 + 3) / 2; the pending 1-star is ignored

    // No aggregate is persisted anywhere -- the users doc still carries no rating field.
    const doc = await db.collection('users').doc('rated').get();
    expect(doc.data().rating).toBeUndefined();
    expect(doc.data().profile.rating).toBeUndefined();
  });

  test('GET /restaurants-by-distance: missing userId -> 400 (customer.js:173-175)', async () => {
    const res = await request(server).get('/api/customer/restaurants-by-distance');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing userId/i);
  });

  test('GET /restaurants-by-distance: unknown userId -> 404, and a customer with no saved location -> 400 (customer.js:181-189)', async () => {
    const unknown = await request(server)
      .get('/api/customer/restaurants-by-distance')
      .query({ userId: 'nobody' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toMatch(/user not found/i);

    seedCustomer('loc-less', null);
    const noLoc = await request(server)
      .get('/api/customer/restaurants-by-distance')
      .query({ userId: 'loc-less' });
    expect(noLoc.status).toBe(400);
    expect(noLoc.body.error).toMatch(/no saved location/i);
  });

  test('main success scenario (distance): restaurants come back sorted nearest-first with a mileage figure (customer.js:207-296)', async () => {
    seedCustomer('cust-1', { latitude: 35.7796, longitude: -78.6382 }); // Raleigh
    seedRestaurant('near', { name: 'Near Cafe' }, { latitude: 35.7800, longitude: -78.6400 });
    seedRestaurant('far', { name: 'Far Grill' }, { latitude: 36.1000, longitude: -79.1000 });

    const res = await request(server)
      .get('/api/customer/restaurants-by-distance')
      .query({ userId: 'cust-1' });

    expect(res.status).toBe(200);
    expect(res.body.restaurants.map((r) => r.name)).toEqual(['Near Cafe', 'Far Grill']);
    expect(res.body.restaurants[0].distanceKm).toBeLessThanOrEqual(res.body.restaurants[1].distanceKm);
    expect(typeof res.body.restaurants[0].distanceMiles).toBe('number');
  });
});
