import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CartItem {
  variantId: string;
  productId: string;
  productSlug: string;
  name: string;
  optionLabel: string;
  /** Display price only. The real price is always recalculated by the database when the order is placed. */
  price: number;
  quantity: number;
  image: string | null;
  stock: number;
}

export interface SyncUpdate { variantId: string; remove?: boolean; price?: number; quantity?: number; stock?: number; name?: string }

interface CartState { storeSlug: string | null; items: CartItem[] }

interface CartApi extends CartState {
  count: number;
  subtotal: number;
  addItem: (storeSlug: string, item: CartItem) => { status: 'added' } | { status: 'other_store' };
  replaceWith: (storeSlug: string, item: CartItem) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  applySync: (updates: SyncUpdate[]) => void;
}

const KEY = 'threadspace.cart.v1';
const EMPTY: CartState = { storeSlug: null, items: [] };
const Ctx = createContext<CartApi | null>(null);

const isItem = (i: unknown): i is CartItem => {
  const o = i as CartItem;
  return !!o && typeof o.variantId === 'string' && typeof o.productId === 'string' && typeof o.productSlug === 'string'
    && typeof o.name === 'string' && typeof o.optionLabel === 'string' && typeof o.price === 'number'
    && Number.isInteger(o.quantity) && o.quantity > 0 && typeof o.stock === 'number';
};

function read(): CartState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw);
    if (!p || typeof p.storeSlug !== 'string' || !Array.isArray(p.items)) return EMPTY;
    const items = (p.items as unknown[]).filter(isItem);
    return items.length ? { storeSlug: p.storeSlug, items } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(read);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable: cart lives for this visit only */ }
  }, [state]);

  const merge = (items: CartItem[], item: CartItem): CartItem[] => {
    const existing = items.find((i) => i.variantId === item.variantId);
    if (!existing) return [...items, { ...item, quantity: Math.min(item.quantity, item.stock) }];
    return items.map((i) => i.variantId === item.variantId
      ? { ...i, ...item, quantity: Math.min(i.quantity + item.quantity, item.stock) }
      : i);
  };

  const addItem = useCallback<CartApi['addItem']>((storeSlug, item) => {
    if (state.items.length > 0 && state.storeSlug && state.storeSlug !== storeSlug) return { status: 'other_store' };
    setState((s) => ({ storeSlug, items: merge(s.storeSlug === storeSlug ? s.items : [], item) }));
    return { status: 'added' };
  }, [state.items.length, state.storeSlug]);

  const replaceWith = useCallback((storeSlug: string, item: CartItem) => {
    setState({ storeSlug, items: [{ ...item, quantity: Math.min(item.quantity, item.stock) }] });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) } : i)),
    }));
  }, []);

  const remove = useCallback((variantId: string) => {
    setState((s) => {
      const items = s.items.filter((i) => i.variantId !== variantId);
      return items.length ? { ...s, items } : EMPTY;
    });
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const applySync = useCallback((updates: SyncUpdate[]) => {
    setState((s) => {
      const items = s.items
        .filter((i) => !updates.some((u) => u.variantId === i.variantId && u.remove))
        .map((i) => {
          const u = updates.find((x) => x.variantId === i.variantId);
          return u ? { ...i, price: u.price ?? i.price, stock: u.stock ?? i.stock, name: u.name ?? i.name, quantity: u.quantity ?? i.quantity } : i;
        });
      return items.length ? { ...s, items } : EMPTY;
    });
  }, []);

  const value = useMemo<CartApi>(() => ({
    ...state,
    count: state.items.reduce((n, i) => n + i.quantity, 0),
    subtotal: state.items.reduce((n, i) => n + i.price * i.quantity, 0),
    addItem, replaceWith, setQuantity, remove, clear, applySync,
  }), [state, addItem, replaceWith, setQuantity, remove, clear, applySync]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}
