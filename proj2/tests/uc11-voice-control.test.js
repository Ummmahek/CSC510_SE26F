// UC11: Control the app by voice (Customer)
// Source under test: server/routes/voice.js POST /classify
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
//
// Environment note: the route's only external dependency is the Gemini HTTP API via
// axios, so axios is jest-mocked — no Firestore (real, emulated, or fake) is involved.
// GEMINI_API_KEY is set/unset per test and restored afterward.

// axios must be mocked at the EXACT file server/routes/voice.js resolves. Two traps,
// both hit while writing this: (1) voice.js lives under server/, so its 'axios' is
// server/node_modules/axios — a bare jest.mock('axios') from this root-run test
// mocks nothing and the suite silently makes real HTTP calls to Google; (2) the
// package directory and its entry file are different registry keys — requiring
// '../server/node_modules/axios' lands on index.js while voice.js's require('axios')
// lands on dist/node/axios.cjs, so the mock must target the .cjs entry itself.
// A factory is used because Jest cannot parse axios's ESM sources to auto-mock them.
const AXIOS_ENTRY = '../server/node_modules/axios/dist/node/axios.cjs';
jest.mock('../server/node_modules/axios/dist/node/axios.cjs', () => ({ post: jest.fn() }));

const request = require('supertest');
const axios = require(AXIOS_ENTRY);
const voiceRoutes = require('../server/routes/voice');
const { buildApp } = require('./helpers/buildApp');

const ORIGINAL_KEY = process.env.GEMINI_API_KEY;

function geminiReply(text) {
  return { data: { candidates: [{ content: { parts: [{ text }] } }] } };
}

describe('UC11: Control the app by voice (Customer)', () => {
  let server;

  beforeAll(() => {
    const app = buildApp({ '/api/voice': voiceRoutes });
    server = app.listen(0);
  });

  afterAll((done) => {
    if (ORIGINAL_KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = ORIGINAL_KEY;
    server.close(done);
  });

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    axios.post.mockReset();
  });

  test('main success scenario: spoken text is classified into one of the five known commands (voice.js:31-77)', async () => {
    axios.post.mockResolvedValue(geminiReply('openCart'));

    const res = await request(server)
      .post('/api/voice/classify')
      .send({ userText: 'show me my cart' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ actionId: 'openCart' });
  });

  test('a whitespace-padded model reply is trimmed before matching (voice.js:67-68)', async () => {
    axios.post.mockResolvedValue(geminiReply('  goHome\n'));

    const res = await request(server)
      .post('/api/voice/classify')
      .send({ userText: 'take me back to the start' });

    expect(res.status).toBe(200);
    expect(res.body.actionId).toBe('goHome');
  });

  test('extension 1a: missing or non-string userText -> 400 (voice.js:35-37)', async () => {
    for (const body of [{}, { userText: '' }, { userText: 42 }]) {
      const res = await request(server).post('/api/voice/classify').send(body);
      expect(res.status).toBe(400);
    }
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('extension 2a: no GEMINI_API_KEY -> 500, feature dead (voice.js:39-42)', async () => {
    delete process.env.GEMINI_API_KEY;

    const res = await request(server)
      .post('/api/voice/classify')
      .send({ userText: 'open my cart' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/key is missing/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('extension 2b: unparseable model reply -> 422 with the raw text echoed (voice.js:71-75)', async () => {
    axios.post.mockResolvedValue(geminiReply('I think the user wants the cart page'));

    const res = await request(server)
      .post('/api/voice/classify')
      .send({ userText: 'cart please' });

    expect(res.status).toBe(422);
    expect(res.body.raw).toMatch(/cart page/);
  });

  test('extension 2c: upstream Gemini HTTP error status is passed through (voice.js:83-87)', async () => {
    axios.post.mockRejectedValue({ response: { status: 429, data: { error: 'quota' } } });

    const res = await request(server)
      .post('/api/voice/classify')
      .send({ userText: 'open my cart' });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/classification failed/i);
  });

  test('[DOC EXPECTATION] a food-ordering app\'s voice feature should be able to add an item or place an order (EXPECTED TO FAIL — the action list is 5 navigation commands only, voice.js:6-12)', async () => {
    // Even a perfectly-behaving model cannot produce an ordering action, because no
    // such action id exists. The doc's original name "Order by voice" was unimplementable.
    axios.post.mockResolvedValue(geminiReply('addToCart'));

    const res = await request(server)
      .post('/api/voice/classify')
      .send({ userText: 'order a pepperoni pizza' });

    expect(res.status).toBe(200); // actual: 422, actionId "addToCart" is not in ACTION_SET
  });
});
