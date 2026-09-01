// UC3: Manage profile (Any logged-in user)
// Sources under test: server/routes/customer.js (GET/PUT /profile), server/routes/auth.js
//   (PUT /profile), server/models/User.js (update / geocode).
// See proj1a-report/usecases.md -- UC3 is deliberately spread across multiple endpoints
// ("Profile updates are spread over four endpoints with different contracts"), so this file
// mounts both the customer and auth routers and contrasts them.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js) because neither
// Docker nor the Firestore emulator toolchain is available in this environment.

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

// axios lives only in server/node_modules (models/User.js is its sole consumer), so a bare
// jest.mock('axios', ...) cannot be resolved from tests/. Resolve it against the server dir and
// mock that exact module id. jest hoists this above the require()s below, so User.geocodeAddress()
// never makes a real network call.
jest.mock(
  require.resolve('axios', { paths: [require('path').join(__dirname, '..', 'server')] }),
  () => ({
    // No GOOGLE_MAPS_API_KEY in this env; a non-OK geocode response makes
    // User.geocodeAddress() resolve to null -- the same no-coordinates path a missing key produces.
    get: jest.fn().mockResolvedValue({ data: { status: 'REQUEST_DENIED', results: [] } }),
  })
);

const request = require('supertest');
const { db } = require('../server/config/firebase');
const customerRoutes = require('../server/routes/customer');
const authRoutes = require('../server/routes/auth');
const { buildApp } = require('./helpers/buildApp');

const OLD_COORDS = { latitude: 35.7796, longitude: -78.6382 }; // Raleigh
const NEW_ADDRESS = { street: '9 B Ave', city: 'Durham', state: 'NC', zipCode: '27701' };

describe('UC3: Manage profile (Any logged-in user)', () => {
  let server;

  beforeAll(() => {
    const app = buildApp({ '/api/customer': customerRoutes, '/api/auth': authRoutes });
    server = app.listen(0);
  });

  afterAll((done) => { server.close(done); });

  beforeEach(() => db.__reset());

  function seedCustomer(overrides = {}) {
    db.__seed('users', 'cust-1', {
      id: 'cust-1',
      email: 'cust1@example.com',
      password: 'pw',
      role: 'customer',
      profile: {
        name: 'Ada',
        phone: '1110000000',
        address: { street: '1 A St', city: 'Raleigh', state: 'NC', zipCode: '27601' },
      },
      deliveryStatus: null,
      location: { ...OLD_COORDS },
      totalEarnings: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  }

  function seedRestaurantUser() {
    db.__seed('users', 'rest-1', {
      id: 'rest-1',
      email: 'rest1@example.com',
      password: 'pw',
      role: 'restaurant',
      profile: { name: 'Bistro' },
      deliveryStatus: null,
      location: null,
      totalEarnings: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  test('main success scenario: a valid profile edit saves and is visible on the next read (customer.js:40-77, 9-37)', async () => {
    seedCustomer();

    const put = await request(server)
      .put('/api/customer/profile')
      .send({
        email: 'cust1@example.com',
        password: 'pw',
        profile: {
          name: 'Ada',
          phone: '2223334444',
          address: { street: '1 A St', city: 'Raleigh', state: 'NC', zipCode: '27601' },
        },
      });
    expect(put.status).toBe(200);
    expect(put.body.customer.profile.phone).toBe('2223334444');

    const read = await request(server)
      .post('/api/customer/profile')
      .send({ email: 'cust1@example.com', password: 'pw' });
    expect(read.status).toBe(200);
    expect(read.body.customer.profile.phone).toBe('2223334444');
  });

  test('auth guards: a wrong password and a non-customer role are each rejected -> 401 (customer.js:25, 60)', async () => {
    seedCustomer();
    seedRestaurantUser();

    const wrongPw = await request(server)
      .put('/api/customer/profile')
      .send({ email: 'cust1@example.com', password: 'nope', profile: { phone: '9' } });
    expect(wrongPw.status).toBe(401);

    const notCustomer = await request(server)
      .post('/api/customer/profile')
      .send({ email: 'rest1@example.com', password: 'pw' });
    expect(notCustomer.status).toBe(401);
    expect(notCustomer.body.error).toMatch(/not a customer/i);
  });

  // --- HEADLINE FINDING (usecases.md UC3 extension 3a) ---
  // models/User.js:119-124: on an address change with no lat/lng, update() calls geocodeAddress();
  // if that returns null (no API key / geocode failure) payload.location is never assigned, so the
  // OLD coordinates silently survive the address change. UC3's postcondition says distance-based
  // features should use the NEW address.
  test('STAR FINDING: changing the address keeps the stale coordinates when geocoding fails (models/User.js:119-124)', async () => {
    seedCustomer();

    const put = await request(server)
      .put('/api/customer/profile')
      .send({ email: 'cust1@example.com', password: 'pw', profile: { address: NEW_ADDRESS } });

    expect(put.status).toBe(200);
    // Address is now in Durham, but the persisted location is still the seeded Raleigh point.
    expect(put.body.customer.location).toEqual(OLD_COORDS);
  });

  // --- FINDING: full-map overwrite ---
  // customer.js:66 (and auth.js:127) call user.update({ profile }) with the whole profile object.
  // Firestore .update() replaces a map field wholesale unless dot-paths are used, so editing one
  // field drops every other field. usecases.md step 2 is "User edits fields (address, phone, ...)".
  test('FINDING: editing one profile field wipes the rest -- update({ profile }) replaces the whole map (customer.js:66)', async () => {
    seedCustomer();

    const put = await request(server)
      .put('/api/customer/profile')
      .send({ email: 'cust1@example.com', password: 'pw', profile: { phone: '2223334444' } });

    expect(put.status).toBe(200);
    expect(put.body.customer.profile.phone).toBe('2223334444');
    expect(put.body.customer.profile.name).toBeUndefined();    // 'Ada' is gone
    expect(put.body.customer.profile.address).toBeUndefined();  // so is the address
  });

  // --- FINDING: "four endpoints, different contracts", made concrete (x2) ---
  test('FINDING: contract divergence -- profile.phone is type-checked on PUT /api/customer/profile but not on PUT /api/auth/profile (customer.js:45-48 vs auth.js:109-112)', async () => {
    seedCustomer();

    const viaCustomer = await request(server)
      .put('/api/customer/profile')
      .send({ email: 'cust1@example.com', password: 'pw', profile: { phone: 12345 } });
    expect(viaCustomer.status).toBe(400); // profile.phone must be a string on this endpoint

    const viaAuth = await request(server)
      .put('/api/auth/profile')
      .send({ email: 'cust1@example.com', password: 'pw', profile: { phone: 12345 } });
    expect(viaAuth.status).toBe(200); // same payload, different endpoint, no field validation
  });

  test('FINDING: contract divergence -- PUT /api/auth/profile never checks role, PUT /api/customer/profile does (auth.js:123 vs customer.js:60)', async () => {
    seedRestaurantUser();

    const viaAuth = await request(server)
      .put('/api/auth/profile')
      .send({ email: 'rest1@example.com', password: 'pw', profile: { name: 'Bistro Renamed' } });
    expect(viaAuth.status).toBe(200); // a restaurant user edits their profile through the auth route

    const viaCustomer = await request(server)
      .put('/api/customer/profile')
      .send({ email: 'rest1@example.com', password: 'pw', profile: { name: 'X' } });
    expect(viaCustomer.status).toBe(401); // ... but is blocked on the customer route
  });

  // --- Intentionally-failing "doc expectation" test ---
  // Asserts the behavior UC3's postcondition implies -- an address change must be reflected in the
  // stored coordinates (or the request should fail) -- on purpose, so the defect shows as a red
  // test in `npm test` / CI. Expected to fail until models/User.js stops silently keeping stale
  // coordinates on a geocode miss.
  test('[DOC EXPECTATION] an address change must refresh (or reject), never silently keep old coordinates (EXPECTED TO FAIL -- see STAR FINDING above)', async () => {
    seedCustomer();

    const put = await request(server)
      .put('/api/customer/profile')
      .send({ email: 'cust1@example.com', password: 'pw', profile: { address: NEW_ADDRESS } });

    expect(put.body.customer.location).not.toEqual(OLD_COORDS);
  });
});
