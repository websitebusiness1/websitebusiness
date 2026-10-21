import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useCart, SyncUpdate } from './cart';
import { formatPHP } from './format';

/**
 * Re-checks every cart line against the live catalogue (current price, stock, still on sale).
 * Anything no longer buyable is removed and explained, so the shopper never reaches checkout with a stale cart.
 */
export function useCartSync(resyncKey = 0) {
  const cart = useCart();
  const [syncing, setSyncing] = useState(true);
  const [notes, setNotes] = useState<string[]>([]);
  const itemsRef = useRef(cart.items);
  itemsRef.current = cart.items;
  const idsKey = cart.items.map((i) => i.variantId).join(',');

  useEffect(() => {
    const items = itemsRef.current;
    if (items.length === 0) { setSyncing(false); return; }
    let cancelled = false;
    setSyncing(true);
    (async () => {
      const { data: vs, error } = await supabase
        .from('product_variants')
        .select('id, product_id, stock_quantity')
        .in('id', items.map((i) => i.variantId));
      if (cancelled) return;
      if (error) { setSyncing(false); return; }
      const variants = (vs ?? []) as { id: string; product_id: string; stock_quantity: number }[];
      const productIds = Array.from(new Set(variants.map((v) => v.product_id)));
      const { data: ps } = productIds.length
        ? await supabase.from('products').select('id, name, price').in('id', productIds)
        : { data: [] as { id: string; name: string; price: number }[] };
      if (cancelled) return;
      const products = new Map(((ps ?? []) as { id: string; name: string; price: number }[]).map((p) => [p.id, p]));
      const variantMap = new Map(variants.map((v) => [v.id, v]));

      const updates: SyncUpdate[] = [];
      const messages: string[] = [];
      for (const item of items) {
        const v = variantMap.get(item.variantId);
        const p = v ? products.get(v.product_id) : undefined;
        if (!v || !p) { updates.push({ variantId: item.variantId, remove: true }); messages.push(`${item.name} (${item.optionLabel}) is no longer available and was removed.`); continue; }
        if (v.stock_quantity <= 0) { updates.push({ variantId: item.variantId, remove: true }); messages.push(`${item.name} (${item.optionLabel}) just sold out and was removed.`); continue; }
        const quantity = Math.min(item.quantity, v.stock_quantity);
        if (quantity < item.quantity) messages.push(`Only ${v.stock_quantity} of ${item.name} (${item.optionLabel}) left, so the quantity was lowered.`);
        if (Number(p.price) !== item.price) messages.push(`The price of ${item.name} changed to ${formatPHP(p.price)}.`);
        updates.push({ variantId: item.variantId, price: Number(p.price), stock: v.stock_quantity, quantity, name: p.name });
      }
      cart.applySync(updates);
      setNotes(messages);
      setSyncing(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, resyncKey]);

  return { syncing, notes };
}
