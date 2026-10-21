import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import type { ProductVariant } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, EmptyState, PageHeader, PageLoader, Spinner, Stat } from '@/components/ui';

const LOW = 5;
const optionLabel = (v: ProductVariant) => [v.size, v.color].filter(Boolean).join(' / ') || 'Standard';

export default function Inventory() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [names, setNames] = useState<Map<string, { name: string; status: string }>>(new Map());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  const load = useCallback(async () => {
    if (!storeId) return;
    const [v, p] = await Promise.all([
      supabase.from('product_variants').select('*').eq('store_id', storeId),
      supabase.from('products').select('id, name, status').eq('store_id', storeId),
    ]);
    const err = v.error ?? p.error;
    setError(err ? errorMessage(err) : null);
    setVariants((v.data ?? []) as ProductVariant[]);
    setNames(new Map(((p.data ?? []) as { id: string; name: string; status: string }[]).map((x) => [x.id, { name: x.name, status: x.status }])));
    setEdits({});
    setLoading(false);
  }, [storeId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return variants
      .filter((v) => v.is_active)
      .map((v) => ({ v, product: names.get(v.product_id) }))
      .filter(({ v, product }) => {
        if (filter === 'out' && v.stock_quantity > 0) return false;
        if (filter === 'low' && !(v.stock_quantity > 0 && v.stock_quantity <= LOW)) return false;
        if (!q) return true;
        return (product?.name ?? '').toLowerCase().includes(q) || (v.sku ?? '').toLowerCase().includes(q) || optionLabel(v).toLowerCase().includes(q);
      })
      .sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? '') || optionLabel(a.v).localeCompare(optionLabel(b.v)));
  }, [variants, names, search, filter]);

  const active = variants.filter((v) => v.is_active);
  const outCount = active.filter((v) => v.stock_quantity === 0).length;
  const lowCount = active.filter((v) => v.stock_quantity > 0 && v.stock_quantity <= LOW).length;

  async function saveStock(v: ProductVariant) {
    const raw = edits[v.id];
    const next = Number(raw);
    if (raw === undefined || raw.trim() === '' || !Number.isInteger(next) || next < 0 || next > 100000) {
      setError('Stock must be a whole number, 0 or more.');
      return;
    }
    setError(null);
    setNotice(null);
    setSavingId(v.id);
    // Only succeeds if the stock is still what you were looking at. A new order in the meantime means it won't be overwritten.
    const { data, error: err } = await supabase
      .from('product_variants')
      .update({ stock_quantity: next })
      .eq('id', v.id)
      .eq('stock_quantity', v.stock_quantity)
      .select('id');
    setSavingId(null);
    if (err) { setError(errorMessage(err)); return; }
    if (!data || data.length === 0) {
      setError('This stock level changed while you were editing (probably a new order), so it wasn’t overwritten. The list has been refreshed.');
      load();
      return;
    }
    setVariants((list) => list.map((x) => (x.id === v.id ? { ...x, stock_quantity: next } : x)));
    setEdits(({ [v.id]: _done, ...rest }) => rest);
    setNotice(`Updated stock for ${names.get(v.product_id)?.name ?? 'product'} (${optionLabel(v)}).`);
  }

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Inventory" description="Stock for every size and color. Customers can’t order more than what’s listed here." />
      <div className="mb-4 space-y-3 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
      </div>

      {active.length === 0 ? (
        <EmptyState title="No stock to manage yet" action={!readOnly ? <Link to="/dashboard/products/new" className="btn-primary">Add a product</Link> : undefined}>
          Sizes and colors appear here once you add them to a product.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <Stat label="Options" value={active.length} />
            <Stat label={`Low (${LOW} or fewer)`} value={lowCount} />
            <Stat label="Out of stock" value={outCount} />
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <input type="search" aria-label="Search inventory" className="input max-w-xs" placeholder="Search product, option or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Filter stock" className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All stock levels</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>

          {rows.length === 0 ? (
            <EmptyState title="Nothing matches">Try a different search or stock filter.</EmptyState>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-sand-200 text-sand-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Option</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">SKU</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ v, product }) => {
                    const edited = edits[v.id] !== undefined && edits[v.id] !== String(v.stock_quantity);
                    return (
                      <tr key={v.id} className="border-b border-sand-100 last:border-0">
                        <td className="px-4 py-3">
                          <Link to={`/dashboard/products/${v.product_id}`} className="font-medium underline-offset-4 hover:underline">{product?.name ?? 'Product'}</Link>
                          {product?.status === 'draft' && <span className="ml-2 text-xs text-sand-500">Draft</span>}
                        </td>
                        <td className="px-4 py-3">{optionLabel(v)}</td>
                        <td className="hidden px-4 py-3 text-sand-500 sm:table-cell">{v.sku ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              aria-label={`Stock for ${product?.name ?? 'product'} ${optionLabel(v)}`}
                              type="number" inputMode="numeric" min="0" step="1"
                              className={`input w-24 py-1.5 ${v.stock_quantity === 0 ? 'border-red-300' : ''}`}
                              disabled={readOnly}
                              value={edits[v.id] ?? String(v.stock_quantity)}
                              onChange={(e) => setEdits({ ...edits, [v.id]: e.target.value })}
                            />
                            {edited && (
                              <button type="button" className="btn-primary px-3 py-1.5" disabled={savingId === v.id} onClick={() => saveStock(v)}>
                                {savingId === v.id && <Spinner />} Save
                              </button>
                            )}
                            {!edited && v.stock_quantity === 0 && <span className="text-xs text-red-800">Out</span>}
                            {!edited && v.stock_quantity > 0 && v.stock_quantity <= LOW && <span className="text-xs text-amber-800">Low</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="hint mt-3">Options switched off (“On sale” unticked) on the product page aren’t listed here.</p>
        </>
      )}
    </div>
  );
}
