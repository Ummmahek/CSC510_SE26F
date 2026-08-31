// UC17: Watch my delivery on a map (Customer)
// Source under test: client/src/components/customer/Orders.tsx +
// client/src/components/delivery/DeliveryMap.tsx.
//
// Environment note — why these are SOURCE-INSPECTION tests, not render tests: this
// use case is client-only, and the inherited client test runner cannot load the app
// at all (react-router-dom v7 is unresolvable by CRA 5's Jest; the root Jest has no
// TSX transform either). Rather than leave UC17 with zero executable coverage, these
// tests assert the headline finding directly against the component source: the
// courier position shown to the customer is FABRICATED — a hardcoded 20-second
// linear interpolation started by a button the customer presses — with no input from
// the real delivery partner or the order status. Each assertion cites the lines it
// reads. The limitation (no DOM execution) is stated here and in the traceability
// notes rather than hidden.

const fs = require('fs');
const path = require('path');

const mapSrc = fs.readFileSync(
  path.join(__dirname, '../client/src/components/delivery/DeliveryMap.tsx'),
  'utf8'
);
const ordersSrc = fs.readFileSync(
  path.join(__dirname, '../client/src/components/customer/Orders.tsx'),
  'utf8'
);

describe('UC17: Watch my delivery on a map (Customer) — source inspection', () => {
  test('the map is consumed by the CUSTOMER order page, not by any delivery-partner screen (Orders.tsx)', () => {
    expect(ordersSrc).toMatch(/<DeliveryMap/);
    // The only import of DeliveryMap in the client tree is customer/Orders.tsx —
    // verified via grep in the review notes; here we pin the customer-side usage.
    expect(ordersSrc).toMatch(/Delivery Simulation/);
  });

  test('the courier position is linearly interpolated, not read from anywhere (DeliveryMap.tsx interpolate/startDeliveryAnimation)', () => {
    expect(mapSrc).toMatch(/const interpolate/);
    expect(mapSrc).toMatch(/startDeliveryAnimation/);
    expect(mapSrc).toMatch(/setInterval/);
  });

  test('the animation duration is a hardcoded 20 seconds (DeliveryMap.tsx)', () => {
    expect(mapSrc).toMatch(/duration\s*=\s*20/);
  });

  test('the animation is started by a button the customer presses, not by order state (DeliveryMap.tsx "Start Delivery")', () => {
    expect(mapSrc).toMatch(/Start Delivery/);
  });

  test('no real position source exists: the component never references the assigned partner, their id, or order status', () => {
    expect(mapSrc).not.toMatch(/riderId|deliveryPartnerId|currentLocation|geolocation/i);
    expect(mapSrc).not.toMatch(/status\s*===\s*['"]out_for_delivery['"]/);
  });
});
