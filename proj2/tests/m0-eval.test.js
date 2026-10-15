const path = require('path');
const fs = require('fs');
const {
  createPrng,
  simulateOrders,
  computeRepeatOrderMetrics,
  generateGitHubIssue,
  formatReport,
  getUtcIsoWeek
} = require('../../scripts/m0-eval');

describe('M0: Repeat-Order-Rate Evaluation Instrument', () => {
  describe('Deterministic PRNG (Mulberry32)', () => {
    test('produces identical sequences with the same seed', () => {
      const prng1 = createPrng(42);
      const prng2 = createPrng(42);

      const seq1 = [prng1(), prng1(), prng1(), prng1(), prng1()];
      const seq2 = [prng2(), prng2(), prng2(), prng2(), prng2()];

      expect(seq1).toEqual(seq2);
    });

    test('produces different sequences with different seeds', () => {
      const prngA = createPrng(101);
      const prngB = createPrng(202);

      expect(prngA()).not.toBe(prngB());
    });
  });

  describe('Seeded Synthetic Order Generator', () => {
    test('is fully reproducible: rerun produces identical order logs and counts', () => {
      const run1 = simulateOrders({ seed: 42, weeks: 4, customers: 20 });
      const run2 = simulateOrders({ seed: 42, weeks: 4, customers: 20 });

      expect(run1.length).toBe(run2.length);
      expect(run1).toEqual(run2);
    });

    test('generates valid discrete order events with required schema fields', () => {
      const orders = simulateOrders({ seed: 42, weeks: 2, customers: 10 });
      expect(orders.length).toBeGreaterThan(0);

      const sample = orders[0];
      expect(sample).toHaveProperty('orderId');
      expect(sample).toHaveProperty('customerId');
      expect(sample).toHaveProperty('group');
      expect(sample).toHaveProperty('timestamp');
      expect(sample).toHaveProperty('totalAmount');
      expect(sample).toHaveProperty('status', 'delivered');

      expect(['control', 'leaderboard']).toContain(sample.group);
      expect(typeof sample.totalAmount).toBe('number');
      expect(sample.totalAmount).toBeGreaterThan(0);
      expect(!Number.isNaN(new Date(sample.timestamp).getTime())).toBe(true);
    });

    test('orders are sorted chronologically', () => {
      const orders = simulateOrders({ seed: 42, weeks: 4, customers: 15 });
      for (let i = 1; i < orders.length; i++) {
        const prev = new Date(orders[i - 1].timestamp).getTime();
        const curr = new Date(orders[i].timestamp).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });
  });

  describe('Repeat-Order Rate Metric Computation (Evaluator)', () => {
    test('computes exact repeat rates on a known hand-crafted order fixture', () => {
      // Week 1: 2026-W36 (2026-09-01)
      // Control group:
      // - cust_c1: 1 order  -> active=1, repeat=0
      // - cust_c2: 2 orders -> active=1, repeat=1
      // Control W36: active=2, repeat=1 -> rate = 1/2 = 50.0%
      // Leaderboard group:
      // - cust_l1: 3 orders -> active=1, repeat=1
      // - cust_l2: 2 orders -> active=1, repeat=1
      // Leaderboard W36: active=2, repeat=2 -> rate = 2/2 = 100.0%
      const fixtureOrders = [
        { customerId: 'cust_c1', group: 'control', timestamp: '2026-09-01T12:00:00Z' },
        { customerId: 'cust_c2', group: 'control', timestamp: '2026-09-01T13:00:00Z' },
        { customerId: 'cust_c2', group: 'control', timestamp: '2026-09-03T18:00:00Z' },
        { customerId: 'cust_l1', group: 'leaderboard', timestamp: '2026-09-01T12:30:00Z' },
        { customerId: 'cust_l1', group: 'leaderboard', timestamp: '2026-09-02T19:00:00Z' },
        { customerId: 'cust_l1', group: 'leaderboard', timestamp: '2026-09-04T18:00:00Z' },
        { customerId: 'cust_l2', group: 'leaderboard', timestamp: '2026-09-02T12:00:00Z' },
        { customerId: 'cust_l2', group: 'leaderboard', timestamp: '2026-09-05T19:00:00Z' }
      ];

      const metrics = computeRepeatOrderMetrics(fixtureOrders, { targetLift: 0.20 });

      expect(metrics.control.pooledRate).toBeCloseTo(0.50, 4);
      expect(metrics.leaderboard.pooledRate).toBeCloseTo(1.00, 4);

      // Lift = (1.00 - 0.50) / 0.50 = +100%
      expect(metrics.lift).toBeCloseTo(1.00, 4);
      expect(metrics.liftPercentage).toBeCloseTo(100.0, 2);
      expect(metrics.passed).toBe(true);
      expect(metrics.decision).toBe('PERSEVERE');
    });

    test('ISO week derivation helper handles week boundaries correctly in UTC', () => {
      // 2026-08-31 is Monday of W36
      const mon = new Date('2026-08-31T10:00:00Z');
      const sun = new Date('2026-09-06T22:00:00Z');
      const nextMon = new Date('2026-09-07T08:00:00Z');

      expect(getUtcIsoWeek(mon)).toBe('2026-W36');
      expect(getUtcIsoWeek(sun)).toBe('2026-W36');
      expect(getUtcIsoWeek(nextMon)).toBe('2026-W37');
    });
  });

  describe('Falsifiability: The Eval Can Fail (Mandatory Requirement)', () => {
    test('default scenario passes hypothesis with >= 20% lift', () => {
      const orders = simulateOrders({ seed: 42, scenario: 'default', weeks: 8, customers: 100 });
      const result = computeRepeatOrderMetrics(orders, { targetLift: 0.20 });

      expect(result.liftPercentage).toBeGreaterThanOrEqual(20.0);
      expect(result.passed).toBe(true);
      expect(result.decision).toBe('PERSEVERE');
    });

    test('low-lift scenario fails hypothesis (< 20% lift) and produces RE-PLAN / DESCOPE', () => {
      const orders = simulateOrders({ seed: 42, scenario: 'low-lift', weeks: 8, customers: 100 });
      const result = computeRepeatOrderMetrics(orders, { targetLift: 0.20 });

      expect(result.liftPercentage).toBeLessThan(20.0);
      expect(result.passed).toBe(false);
      expect(result.decision).toBe('RE-PLAN / DESCOPE');
    });

    test('zero-lift scenario fails hypothesis with near 0% lift', () => {
      const orders = simulateOrders({ seed: 42, scenario: 'zero-lift', weeks: 8, customers: 100 });
      const result = computeRepeatOrderMetrics(orders, { targetLift: 0.20 });

      expect(result.liftPercentage).toBeLessThan(20.0);
      expect(result.passed).toBe(false);
      expect(result.decision).toBe('RE-PLAN / DESCOPE');
    });
  });

  describe('GitHub Issue Generation & Reporting', () => {
    test('generates PERSEVERE issue content on successful evaluation', () => {
      const passedResult = {
        targetLift: 0.20,
        targetLiftPercentage: 20.0,
        passed: true,
        lift: 0.249,
        liftPercentage: 24.9,
        decision: 'PERSEVERE',
        control: { pooledRate: 0.341, totalActiveCustomerWeeks: 390, totalRepeatCustomerWeeks: 133, totalOrders: 560 },
        leaderboard: { pooledRate: 0.426, totalActiveCustomerWeeks: 385, totalRepeatCustomerWeeks: 164, totalOrders: 613 },
        weeks: ['2026-W36', '2026-W37'],
        stats: { zScore: 2.43, pValue: 0.015, statisticallySignificant: true }
      };

      const issue = generateGitHubIssue(passedResult);
      expect(issue.title).toContain('PERSEVERE');
      expect(issue.title).toContain('+24.90%');
      expect(issue.body).toContain('PASS');
      expect(issue.body).toContain('Milestone 2');
    });

    test('generates structured RE-PLAN / DESCOPE issue content on failure', () => {
      const failedResult = {
        targetLift: 0.20,
        targetLiftPercentage: 20.0,
        passed: false,
        lift: 0.0267,
        liftPercentage: 2.67,
        decision: 'RE-PLAN / DESCOPE',
        control: { pooledRate: 0.341, totalActiveCustomerWeeks: 390, totalRepeatCustomerWeeks: 133, totalOrders: 560 },
        leaderboard: { pooledRate: 0.350, totalActiveCustomerWeeks: 377, totalRepeatCustomerWeeks: 132, totalOrders: 547 },
        weeks: ['2026-W36'],
        stats: { zScore: 0.26, pValue: 0.604, statisticallySignificant: false }
      };

      const issue = generateGitHubIssue(failedResult);
      expect(issue.title).toContain('RE-PLAN / DESCOPE');
      expect(issue.body).toContain('Option A');
      expect(issue.body).toContain('Option B');
      expect(issue.body).toContain('Option C');
      expect(issue.body).toContain('FAIL');
    });

    test('formatReport formats terminal output with weekly breakdown table', () => {
      const orders = simulateOrders({ seed: 42, weeks: 2, customers: 15 });
      const result = computeRepeatOrderMetrics(orders);
      const text = formatReport(result, { seed: 42 });

      expect(text).toContain('HUNGRY WOLF — M0 REPEAT-ORDER-RATE EVALUATION REPORT');
      expect(text).toContain('WEEKLY BREAKDOWN');
      expect(text).toContain('HYPOTHESIS VERDICT');
    });
  });

  describe('Real Pilot Data Ingestion (Bonus Deliverable)', () => {
    test('successfully ingests sample pilot orders JSON dataset and computes lift', () => {
      const pilotFilePath = path.resolve(__dirname, '../../data/pilot-orders-sample.json');
      expect(fs.existsSync(pilotFilePath)).toBe(true);

      const rawContent = fs.readFileSync(pilotFilePath, 'utf8');
      const pilotOrders = JSON.parse(rawContent);

      expect(Array.isArray(pilotOrders)).toBe(true);
      expect(pilotOrders.length).toBe(50);

      const evalResult = computeRepeatOrderMetrics(pilotOrders, { targetLift: 0.20 });
      expect(evalResult.weeks.length).toBe(4);
      expect(evalResult.passed).toBe(true);
      expect(evalResult.decision).toBe('PERSEVERE');
      expect(evalResult.stats.statisticallySignificant).toBe(true);
    });
  });

  describe('Edge Cases and Guard Handling', () => {
    test('gracefully handles empty orders array', () => {
      const result = computeRepeatOrderMetrics([]);
      expect(result.control.pooledRate).toBe(0);
      expect(result.leaderboard.pooledRate).toBe(0);
      expect(result.liftPercentage).toBe(0);
      expect(result.passed).toBe(false);
      expect(result.decision).toBe('RE-PLAN / DESCOPE');
    });

    test('ignores corrupted order objects without crashing', () => {
      const corrupted = [
        null,
        {},
        { customerId: 'cust1' }, // missing timestamp
        { timestamp: '2026-09-01' }, // missing customerId
        { customerId: 'cust2', timestamp: 'invalid-date' }, // invalid date
        { customerId: 'cust3', group: 'control', timestamp: '2026-09-01T12:00:00Z' } // valid
      ];

      const result = computeRepeatOrderMetrics(corrupted);
      expect(result.control.totalActiveCustomerWeeks).toBe(1);
    });
  });
});
