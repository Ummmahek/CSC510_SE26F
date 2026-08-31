// UC20: See the donation impact (Meal-for-a-Meal)
// Source under test: server/routes/donations.js
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
//
// Environment note: Firestore is mocked (see tests/helpers/fakeFirestore.js) because neither
// Docker nor the Firestore emulator toolchain is available in this environment.

jest.mock('../server/config/firebase', () => require('./helpers/fakeFirestore').createFirestoreMock());

const request = require('supertest');
const { db } = require('../server/config/firebase');
const donationRoutes = require('../server/routes/donations');
const { buildApp } = require('./helpers/buildApp');

describe('UC20: See the donation impact (Meal-for-a-Meal)', () => {
  let server;

  beforeAll(() => {
    const app = buildApp({ '/api/donations': donationRoutes });
    server = app.listen(0);
  });

  afterAll((done) => { server.close(done); });

  beforeEach(() => db.__reset());

  function seedDeliveredOrders(count) {
    for (let i = 0; i < count; i++) {
      db.__seed('orders', `order-${i}`, { id: `order-${i}`, status: 'delivered' });
    }
  }

  test('main success scenario: meals donated = floor(delivered/10) (donations.js:15)', async () => {
    seedDeliveredOrders(37);
    const res = await request(server).get('/api/donations/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBe(37);
    expect(res.body.mealsDonated).toBe(3); // floor(37/10)
    expect(res.body.nextDonationIn).toBe(3); // 10 - (37 % 10)
  });

  test('main scenario edge case: zero delivered orders -> zero meals donated', async () => {
    const res = await request(server).get('/api/donations/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBe(0);
    expect(res.body.mealsDonated).toBe(0);
  });

  test('extension 2a (partial): POST /update rejects zero/negative meal amounts -> 400 (donations.js:47)', async () => {
    const zero = await request(server).post('/api/donations/update').send({ mealsToAdd: 0 });
    expect(zero.status).toBe(400);

    const negative = await request(server).post('/api/donations/update').send({ mealsToAdd: -5 });
    expect(negative.status).toBe(400);
  });

  test('STAR FINDING: any unauthenticated caller can inflate the stored donation counter without bound (donations.js:59)', async () => {
    seedDeliveredOrders(5); // real value: floor(5/10) = 0 meals donated
    const HUGE_AMOUNT = 999999999;

    // No customerId/ownerId/token of any kind -- the only guard is "amount > 0" (donations.js:47).
    const updateRes = await request(server)
      .post('/api/donations/update')
      .send({ mealsToAdd: HUGE_AMOUNT });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.mealsDonated).toBe(HUGE_AMOUNT);

    // The tampered value is now permanently persisted, decoupled from any real order activity.
    const settingsDoc = await db.collection('settings').doc('donations').get();
    expect(settingsDoc.data().counter).toBe(HUGE_AMOUNT);

    // --- Nuance vs. usecases.md's postcondition ---
    // usecases.md's UC20 postcondition says: "Displayed count matches the recorded (possibly
    // tampered) counter." Reading donations.js's GET /stats handler line by line shows it reads
    // the settings/donations doc (to lazily initialize it) but NEVER puts `donationCounter` into
    // its JSON response -- `mealsDonated` in the response is always freshly recomputed from the
    // real count of delivered orders. So today, the tampered counter is NOT what UC20's actual
    // viewing flow (GET /stats, consumed by client/src/pages/HomePage.tsx) shows to a customer.
    // The vulnerability (unbounded, unauthenticated write) is real and reproduced above; the
    // specific "customer sees the tampered number" consequence described in the doc's
    // postcondition currently is not, because /stats doesn't read the counter it corrupts.
    const statsRes = await request(server).get('/api/donations/stats');
    expect(statsRes.body.mealsDonated).toBe(0); // still the real floor(5/10)
    expect(statsRes.body.mealsDonated).not.toBe(HUGE_AMOUNT);
  });

  test('the counter has no upper bound and keeps compounding across repeated calls (donations.js:59)', async () => {
    await request(server).post('/api/donations/update').send({ mealsToAdd: 1000 });
    const second = await request(server).post('/api/donations/update').send({ mealsToAdd: 2000 });
    expect(second.status).toBe(200);
    expect(second.body.mealsDonated).toBe(3000);
  });

  test('POST /record logs a donation entry (donations.js:96-126)', async () => {
    const res = await request(server)
      .post('/api/donations/record')
      .send({ amount: 25, description: 'Test meal drive' });
    expect(res.status).toBe(200);
    expect(res.body.donation.amount).toBe(25);

    const historySnap = await db.collection('donationHistory').get();
    expect(historySnap.size).toBe(1);
  });

  test('POST /record rejects zero/negative amounts -> 400 (donations.js:101)', async () => {
    const zero = await request(server).post('/api/donations/record').send({ amount: 0 });
    expect(zero.status).toBe(400);
    const negative = await request(server).post('/api/donations/record').send({ amount: -5 });
    expect(negative.status).toBe(400);
  });

  test('GET /history returns recorded donations, most recent first (donations.js:76-94)', async () => {
    db.__seed('donationHistory', 'd1', { id: 'd1', amount: 10, createdAt: new Date('2026-01-01T00:00:00Z') });
    db.__seed('donationHistory', 'd2', { id: 'd2', amount: 20, createdAt: new Date('2026-06-01T00:00:00Z') });

    const res = await request(server).get('/api/donations/history');
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history[0].id).toBe('d2'); // most recently created, listed first
    expect(res.body.history[1].id).toBe('d1');
  });
});
