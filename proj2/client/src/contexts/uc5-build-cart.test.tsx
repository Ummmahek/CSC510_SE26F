// UC5: Build a cart (Customer)
// Source under test: client/src/contexts/CartContext.tsx
// See proj1a-report/usecases.md for the authoritative main scenario + extensions.
//
// Why this file lives in client/ and not proj2/tests/ with the others: UC5 is entirely
// client-side -- there is no cart endpoint on the server, and every UC5 extension in usecases.md
// is explicitly "not handled server-side". proj2/tests/ runs under jest testEnvironment:'node'
// with no DOM; the cart is a React context built on useState, so it needs the CRA / jsdom /
// @testing-library stack that only exists in proj2/client.
//
// Run:  cd proj2/client && CI=true npx react-scripts test src/contexts/uc5-build-cart.test.tsx

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from './CartContext';

const itemA = { id: 'a', name: 'Burger', price: 8.5, restaurantId: 'r1', restaurantName: 'Alpha' };
const itemB = { id: 'b', name: 'Fries', price: 3.25, restaurantId: 'r1', restaurantName: 'Alpha' };
const itemC = { id: 'c', name: 'Roll', price: 6, restaurantId: 'r2', restaurantName: 'Beta' };

const wrapper = ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>;

describe('UC5: Build a cart (Customer)', () => {
  test('main success scenario: add items, re-add to bump quantity, running total stays correct (CartContext.tsx:39-79)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(itemA); });
    act(() => { result.current.addItem(itemB); });
    act(() => { result.current.addItem(itemA); }); // same id -> quantity 2, not a second line

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.find((i) => i.id === 'a')!.quantity).toBe(2);
    expect(result.current.getTotalItems()).toBe(3);
    expect(result.current.getTotalPrice()).toBeCloseTo(8.5 * 2 + 3.25);
  });

  test('adjusting a quantity updates the running total (CartContext.tsx:57-67, 73-75)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(itemA); });
    act(() => { result.current.updateQuantity('a', 5); });

    expect(result.current.items[0].quantity).toBe(5);
    expect(result.current.getTotalPrice()).toBeCloseTo(8.5 * 5);
  });

  test('updateQuantity to 0 or below removes the line entirely (CartContext.tsx:58-61)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(itemA); });
    act(() => { result.current.addItem(itemB); });
    act(() => { result.current.updateQuantity('a', 0); });
    act(() => { result.current.updateQuantity('b', -3); });

    expect(result.current.items).toHaveLength(0);
  });

  test('removeItem and clearCart empty the cart as expected (CartContext.tsx:53-55, 69-71)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(itemA); });
    act(() => { result.current.addItem(itemB); });
    act(() => { result.current.removeItem('a'); });
    expect(result.current.items.map((i) => i.id)).toEqual(['b']);

    act(() => { result.current.clearCart(); });
    expect(result.current.items).toHaveLength(0);
  });

  // usecases.md UC5 extension 3a: a cart spanning several restaurants is silently split into one
  // order per restaurant at checkout. The context never guards against it -- so the "one coherent
  // order" stakeholder expectation is only enforced by that silent split, not by the cart.
  test('FINDING (ext 3a): the cart accepts items from different restaurants with no guard (CartContext.tsx:39-51)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => { result.current.addItem(itemA); }); // restaurantId r1
    act(() => { result.current.addItem(itemC); }); // restaurantId r2

    expect(result.current.items.map((i) => i.restaurantId).sort()).toEqual(['r1', 'r2']);
  });

  // usecases.md UC5 extension 1a: "the cart lives only in client state ... a page refresh empties
  // it." A remount of the provider is the test-equivalent of a refresh.
  test('STAR FINDING (ext 1a): the cart is component state only -- a remount (page refresh) loses it (CartContext.tsx:37)', () => {
    const first = renderHook(() => useCart(), { wrapper });
    act(() => { first.result.current.addItem(itemA); });
    expect(first.result.current.getTotalItems()).toBe(1);
    first.unmount();

    const afterReload = renderHook(() => useCart(), { wrapper });
    expect(afterReload.result.current.items).toHaveLength(0);
    // nothing was written anywhere durable either
    expect(window.localStorage.length).toBe(0);
  });

  // --- Intentionally-failing "doc expectation" test ---
  // Asserts what UC5's main scenario implies -- a half-built cart should still be there after a
  // refresh, on the way to checkout -- on purpose, so the gap shows as a visible red test.
  // Expected to fail until the cart is persisted (localStorage / server).
  test('[DOC EXPECTATION] a half-built cart should survive a page refresh (EXPECTED TO FAIL -- see STAR FINDING above)', () => {
    const first = renderHook(() => useCart(), { wrapper });
    act(() => { first.result.current.addItem(itemA); });
    first.unmount();

    const afterReload = renderHook(() => useCart(), { wrapper });
    expect(afterReload.result.current.items).toHaveLength(1);
  });
});
