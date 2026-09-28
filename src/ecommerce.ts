import type { Params } from './types';

export interface CartItem {
  sku: string;
  name: string;
  category: string | string[];
  price: number;
  quantity: number;
}

/** Exponent-string rounding avoids float artefacts (10.005 → 10.01, not 10). */
export function roundAmount(value: number): number {
  const shifted = Math.round(Number(`${value}e2`));
  return Number.isFinite(shifted) ? Number(`${shifted}e-2`) : Math.round(value * 100) / 100;
}

const money = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? roundAmount(value) : undefined;

/** Cart state mirroring Matomo JS: adding an existing SKU replaces it. */
export class Cart {
  private list: CartItem[] = [];

  add(sku: string, name = '', category: string | string[] = '', price = 0, quantity = 1): void {
    if (typeof sku !== 'string' || sku === '') return;
    const item: CartItem = {
      sku,
      name,
      category,
      price: Number.isFinite(price) ? price : 0,
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
    };
    const index = this.list.findIndex((i) => i.sku === sku);
    if (index === -1) this.list.push(item);
    else this.list[index] = item;
  }

  remove(sku: string): void {
    this.list = this.list.filter((i) => i.sku !== sku);
  }

  clear(): void {
    this.list = [];
  }

  get items(): CartItem[] {
    return this.list.map((i) => ({ ...i }));
  }
}

export function ecItems(items: CartItem[]): string {
  return JSON.stringify(
    items.map((i) => [i.sku, i.name, i.category, roundAmount(i.price), i.quantity]),
  );
}

export function productViewParams(
  sku?: string,
  name?: string,
  category?: string | string[],
  price?: number,
): Params {
  return {
    _pks: sku,
    _pkn: name,
    _pkc: Array.isArray(category) ? JSON.stringify(category) : category,
    _pkp: money(price),
  };
}

export function cartUpdateParams(items: CartItem[], grandTotal: number): Params {
  return { idgoal: 0, ec_items: ecItems(items), revenue: money(grandTotal) };
}

export function orderParams(
  items: CartItem[],
  orderId: string,
  grandTotal: number,
  subTotal?: number,
  tax?: number,
  shipping?: number,
  discount?: number,
): Params {
  return {
    idgoal: 0,
    ec_id: orderId,
    ec_items: ecItems(items),
    revenue: money(grandTotal),
    ec_st: money(subTotal),
    ec_tx: money(tax),
    ec_sh: money(shipping),
    ec_dt: money(discount),
  };
}
