// Shared fixture for UC15 (claim a delivery job) and UC16 (pick up and deliver an order).
// Both use cases are the same actor flow (a delivery partner claiming, then completing, a
// delivery) against routes/delivery.js, so both test files seed the same two-partner /
// one-ready-order world through this single helper instead of duplicating setup.

function seedDeliveryFixture(db, overrides = {}) {
  const now = new Date();

  const riderA = {
    id: 'rider-A',
    email: 'riderA@example.com',
    password: 'pw',
    role: 'delivery',
    profile: {},
    deliveryStatus: 'free',
    location: null,
    totalEarnings: 0,
    createdAt: now,
    updatedAt: now,
    ...(overrides.riderA || {}),
  };

  const riderB = {
    id: 'rider-B',
    email: 'riderB@example.com',
    password: 'pw',
    role: 'delivery',
    profile: {},
    deliveryStatus: 'free',
    location: null,
    totalEarnings: 0,
    createdAt: now,
    updatedAt: now,
    ...(overrides.riderB || {}),
  };

  const orderId = overrides.orderId || 'order-1';
  const order = {
    id: orderId,
    customerId: 'customer-1',
    restaurantId: 'restaurant-1',
    items: [{ menuItemId: 'item-1', quantity: 1, price: 20 }],
    totalAmount: 20,
    deliveryFee: 3,
    tipAmount: 2,
    status: 'ready',
    deliveryPartnerId: null,
    deliveryAddress: { street: '1 Main St', city: 'Raleigh', state: 'NC', zipCode: '27606' },
    createdAt: now,
    updatedAt: now,
    ...(overrides.order || {}),
  };

  db.__seed('users', riderA.id, riderA);
  db.__seed('users', riderB.id, riderB);
  db.__seed('orders', order.id, order);

  return { riderA, riderB, orderId, order };
}

module.exports = { seedDeliveryFixture };
