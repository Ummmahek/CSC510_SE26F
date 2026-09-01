// UC17: Watch my delivery on a map (Customer)
// Source under test: client/src/components/customer/Orders.tsx +
// client/src/components/delivery/DeliveryMap.tsx.
//
// Environment note — why these are SOURCE-INSPECTION tests, not render tests: this
// use case is client-only, DeliveryMap depends on the Google Maps SDK, and the
// router-dependent client entry is blocked as inherited (App.test.tsx cannot resolve
// react-router-dom; router-free components CAN run under the proj2/client CRA runner
// — see uc5-build-cart.test.tsx — but rendering a Maps-SDK component would need a
// full Maps mock; the root Jest has no TSX transform either). Rather than leave
// UC17 with zero executable coverage, these
// tests assert the headline finding directly against the component source: the
// courier position shown to the customer is FABRICATED — a 20-step, 1-second-tick
// linear interpolation started by a button the customer presses — with no input from
// the real delivery partner or the order status. Each assertion cites the lines it
// reads. The limitation (no DOM execution) is stated here and in the traceability
// notes rather than hidden.

const fs = require('fs');
const path = require('path');

const CLIENT_SRC = path.join(__dirname, '../client/src');

const mapSrc = fs.readFileSync(
  path.join(CLIENT_SRC, 'components/delivery/DeliveryMap.tsx'),
  'utf8'
);
const ordersSrc = fs.readFileSync(
  path.join(CLIENT_SRC, 'components/customer/Orders.tsx'),
  'utf8'
);

// Every file under client/src that mentions DeliveryMap at all.
function filesMentioning(needle, dir = CLIENT_SRC) {
  const hits = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) hits.push(...filesMentioning(needle, full));
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes(needle)) {
      hits.push(path.relative(CLIENT_SRC, full));
    }
  }
  return hits;
}

describe('UC17: Watch my delivery on a map (Customer) — source inspection', () => {
  test('the map is consumed ONLY by the customer order page — no delivery-partner screen references it (whole client/src scan)', () => {
    expect(filesMentioning('DeliveryMap').sort()).toEqual([
      'components/customer/Orders.tsx', // the sole consumer (renders <DeliveryMap ...>)
      'components/delivery/DeliveryMap.tsx', // the definition itself
    ]);
    expect(ordersSrc).toMatch(/<DeliveryMap/);
  });

  test('the page itself labels the feature a simulation: a visible <h3>Delivery Simulation</h3> heading (Orders.tsx:503)', () => {
    expect(ordersSrc).toMatch(/<h3>Delivery Simulation<\/h3>/);
  });

  test('the courier position is linearly interpolated between two fixed points (DeliveryMap.tsx interpolate/startDeliveryAnimation)', () => {
    expect(mapSrc).toMatch(/const interpolate/);
    expect(mapSrc).toMatch(/startDeliveryAnimation/);
    expect(mapSrc).toMatch(/interpolate\(restaurant,\s*customer,\s*progress\)/);
  });

  test('the animation is a hardcoded 20 steps on a 1000 ms setInterval — 20 seconds regardless of any real delivery (DeliveryMap.tsx:89-104)', () => {
    expect(mapSrc).toMatch(/duration\s*=\s*20\s*;/); // anchored: 200/2000 would not match
    expect(mapSrc).toMatch(/\},\s*1000\s*\);/); // the setInterval tick
    expect(mapSrc).toMatch(/setInterval/);
  });

  test('the animation is started by a button the customer presses, not by order state (DeliveryMap.tsx "Start Delivery")', () => {
    expect(mapSrc).toMatch(/Start Delivery/);
  });

  test('no real position source can reach the component: its full props contract is {restaurant, customer, onDelivered?} (DeliveryMap.tsx:8-12)', () => {
    // Pin the entire props interface, so ANY added input (an order, a partner id, a
    // live position feed) breaks this test — stronger than blacklisting name guesses.
    expect(mapSrc).toMatch(
      /interface DeliveryMapProps \{\s*restaurant: LatLng;\s*customer: LatLng;\s*onDelivered\?: \(\) => void;\s*\}/
    );
  });
});
