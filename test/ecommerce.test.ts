import { describe, expect, it } from 'vitest';
import {
  Cart,
  cartUpdateParams,
  ecItems,
  orderParams,
  productViewParams,
  roundAmount,
} from '../src/ecommerce';

describe('ecommerce', () => {
  it('rounds amounts to 2 decimals', () => {
    expect(roundAmount(10.005)).toBe(10.01);
    expect(roundAmount(0.1 + 0.2)).toBe(0.3);
  });

  it('adds, replaces and removes cart items by sku', () => {
    const cart = new Cart();
    cart.add('SKU1', 'Tea', 'Drinks', 12.5, 2);
    cart.add('SKU2', 'Cup', ['Home', 'Kitchen'], 30);
    cart.add('SKU1', 'Tea', 'Drinks', 12.5, 3);
    expect(cart.items).toEqual([
      { sku: 'SKU1', name: 'Tea', category: 'Drinks', price: 12.5, quantity: 3 },
      { sku: 'SKU2', name: 'Cup', category: ['Home', 'Kitchen'], price: 30, quantity: 1 },
    ]);
    cart.remove('SKU2');
    expect(cart.items).toHaveLength(1);
    cart.clear();
    expect(cart.items).toEqual([]);
  });

  it('ignores items without sku and clamps bad numbers', () => {
    const cart = new Cart();
    cart.add('', 'x');
    cart.add('S', 'x', '', Number.NaN, -2);
    expect(cart.items).toEqual([{ sku: 'S', name: 'x', category: '', price: 0, quantity: 1 }]);
  });

  it('serialises ec_items like Matomo JS', () => {
    expect(
      ecItems([{ sku: 'S', name: 'N', category: ['A', 'B'], price: 1.234, quantity: 2 }]),
    ).toBe('[["S","N",["A","B"],1.23,2]]');
  });

  it('builds product view params', () => {
    expect(productViewParams('S', 'N', ['A'], 9.999)).toEqual({
      _pks: 'S',
      _pkn: 'N',
      _pkc: '["A"]',
      _pkp: 10,
    });
    expect(productViewParams(undefined, undefined, 'Shoes')).toEqual({
      _pks: undefined,
      _pkn: undefined,
      _pkc: 'Shoes',
      _pkp: undefined,
    });
  });

  it('builds cart update and order params', () => {
    const items = [{ sku: 'S', name: 'N', category: '', price: 5, quantity: 2 }];
    expect(cartUpdateParams(items, 10)).toEqual({
      idgoal: 0,
      ec_items: '[["S","N","",5,2]]',
      revenue: 10,
    });
    expect(orderParams(items, 'O-1', 12.345, 10, 1, 2, 0.5)).toEqual({
      idgoal: 0,
      ec_id: 'O-1',
      ec_items: '[["S","N","",5,2]]',
      revenue: 12.35,
      ec_st: 10,
      ec_tx: 1,
      ec_sh: 2,
      ec_dt: 0.5,
    });
    expect(orderParams([], 'O-2', 1)).toMatchObject({ ec_st: undefined, ec_dt: undefined });
  });
});
