// UC14: Manage the menu (Restaurant)
// Source under test: server/routes/restaurant.js
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js) because neither
// Docker nor the Firestore emulator toolchain is available in this environment.

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

const request = require('supertest');
const { db } = require('../server/config/firebase');
const restaurantRoutes = require('../server/routes/restaurant');
const { buildApp } = require('./helpers/buildApp');

describe('UC14: Manage the menu (Restaurant)', () => {
  let server;

  beforeAll(() => {
    const app = buildApp({ '/api/restaurant': restaurantRoutes });
    server = app.listen(0);
  });

  afterAll((done) => { server.close(done); });

  beforeEach(() => {
    db.__reset();
    db.__seed('users', 'owner-1', {
      id: 'owner-1',
      email: 'owner1@example.com',
      password: 'pw',
      role: 'restaurant',
      profile: { menu: [] },
      deliveryStatus: null,
      location: null,
      totalEarnings: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  test('main success scenario: restaurant adds/edits menu items and customers see the update (restaurant.js: GET/PUT /menu)', async () => {
    const menu = [
      { name: 'Burger', price: 9.99, available: true },
      { name: 'Fries', price: 3.5, available: false },
    ];

    const putRes = await request(server)
      .put('/api/restaurant/menu')
      .send({ ownerId: 'owner-1', menu });
    expect(putRes.status).toBe(200);
    expect(putRes.body.menu).toEqual(menu);

    // "Customers see the updated menu" -- GET /menu is the read side of the same flow.
    const getRes = await request(server)
      .get('/api/restaurant/menu')
      .query({ ownerId: 'owner-1' });
    expect(getRes.status).toBe(200);
    expect(getRes.body.menu).toEqual(menu);
  });

  test('extension 1a: missing ownerId on GET /menu -> 400 (restaurant.js:83)', async () => {
    const res = await request(server).get('/api/restaurant/menu');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ownerId is required/i);
  });

  test('extension 3a: PUT /menu with an invalid body fails express-validator -> 400 (restaurant.js:116)', async () => {
    const res = await request(server)
      .put('/api/restaurant/menu')
      .send({ ownerId: 'owner-1', menu: 'not-an-array' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('extension 3b: PUT /menu for an ownerId with no matching restaurant user -> 404 (restaurant.js:131)', async () => {
    const res = await request(server)
      .put('/api/restaurant/menu')
      .send({ ownerId: 'no-such-owner', menu: [] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  // --- Extension 3c, as documented in usecases.md ---
  // "The profile endpoint silently creates the restaurant record if none exists
  //  (restaurant.js:58) -- onboarding and editing share one code path."
  //
  // This does NOT reproduce as documented. Reading restaurant.js:51 shows the PUT /profile
  // handler calls `Restaurant.findByOwnerId(user.id)` -- but grepping models/Restaurant.js
  // (and the whole repo) confirms `findByOwnerId` is never defined anywhere on the Restaurant
  // model. Calling it throws `TypeError: Restaurant.findByOwnerId is not a function`
  // synchronously, before either the "update existing" or "create new" branch is ever reached.
  // That TypeError is caught by the route's own try/catch and surfaces as a 500, not a silent
  // 200 creation and not a 404.
  //
  // This is a genuine mismatch between usecases.md and the current code, not something we
  // adjusted the test to paper over -- see the report notes for the full callout.
  test('MISMATCH vs usecases.md 3c: PUT /profile for a restaurant with NO existing restaurant record does not "silently create" one -- it 500s (restaurant.js:51, Restaurant.findByOwnerId is undefined)', async () => {
    const res = await request(server)
      .put('/api/restaurant/profile')
      .send({
        email: 'owner1@example.com',
        password: 'pw',
        restaurant: { name: 'New Spot', cuisine: 'Diner' },
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/findByOwnerId is not a function/);
  });

  test('follow-up: the same PUT /profile crash also happens when a Restaurant record already exists -- proving the endpoint is unconditionally broken, not just the "no prior restaurant" edge case', async () => {
    db.__seed('restaurants', 'rest-1', {
      id: 'rest-1',
      name: 'Existing Place',
      ownerId: 'owner-1',
      menu: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(server)
      .put('/api/restaurant/profile')
      .send({ email: 'owner1@example.com', password: 'pw', restaurant: { name: 'Renamed' } });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/findByOwnerId is not a function/);
  });

  test('BONUS FINDING: GET /profile is a stub -- always returns { user: null, restaurant: null } regardless of the caller (restaurant.js:8-20)', async () => {
    const res = await request(server).get('/api/restaurant/profile');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null, restaurant: null });

    // Passing what looks like an identifying query param changes nothing -- there is no lookup
    // logic in this handler at all, it ignores its input entirely.
    const withQuery = await request(server)
      .get('/api/restaurant/profile')
      .query({ ownerId: 'owner-1' });
    expect(withQuery.body).toEqual({ user: null, restaurant: null });
  });

  // --- Intentionally-failing "doc expectation" test ---
  // Everything above asserts what the code ACTUALLY does. This one instead asserts what
  // usecases.md 3c PROMISES ("silently creates the restaurant record if none exists"), on
  // purpose, so this failure is visible in plain `npm test` / CI output and in the demo video
  // -- not just buried in a passing test's comments. This is expected to fail until the app
  // either gets a real Restaurant.findByOwnerId() or the doc is corrected to match reality.
  test('[DOC EXPECTATION] usecases.md 3c: PUT /profile should silently create a restaurant when none exists (EXPECTED TO FAIL -- see MISMATCH test above for the real behavior)', async () => {
    const res = await request(server)
      .put('/api/restaurant/profile')
      .send({
        email: 'owner1@example.com',
        password: 'pw',
        restaurant: { name: 'New Spot', cuisine: 'Diner' },
      });

    expect(res.status).toBe(200);
    expect(res.body.restaurant).toBeDefined();
    expect(res.body.restaurant.name).toBe('New Spot');
  });
});
