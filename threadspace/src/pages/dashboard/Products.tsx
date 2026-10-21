import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatDate, formatPHP } from '@/lib/format';
import { publicImageUrl } from '@/lib/storage';
import type { Product } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, EmptyState, PageHeader, PageLoader } from '@/components/ui';

interface ImgRow { product_id: string; storage_path: string; is_cover: boolean; sort_order: number }
interface VarRow { product_id: string; stock_quantity: number; is_active: boolean }

export default function Products() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';
  const flash = (useLocation().state as { notice?: string } | null)?.notice;

  const [products, setProducts] = useState<Product[]>([]);
  const [images, setImages] = useState<ImgRow[]>([]);
  const [variants, setVariants] = useState<VarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [p, i, v] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
        supabase.from('product_images').select('product_id, storage_path, is_cover, sort_order').eq('store_id', storeId),
        supabase.from('product_variants').select('product_id, stock_quantity, is_active').eq('store_id', storeId),
      ]);
      if (cancelled) return;
      const err = p.error ?? i.error ?? v.error;
      setError(err ? errorMessage(err) : null);
      setProducts((p.data ?? []) as Product[]);
      setImages((i.data ?? []) as ImgRow[]);
      setVariants((v.data ?? []) as VarRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  const coverFor = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...images].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
    sorted.forEach((i) => { if (!map.has(i.product_id)) map.set(i.product_id, i.storage_path); });
    return map;
  }, [images]);

  const stockFor = useMemo(() => {
    const map = new Map<string, { total: number; options: number }>();
    variants.filter((v) => v.is_active).forEach((v) => {
      const cur = map.get(v.product_id) ?? { total: 0, options: 0 };
      map.set(v.product_id, { total: cur.total + v.stock_quantity, options: cur.options + 1 });
    });
    return map;
  }, [variants]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) =>
      (status === 'all' || p.status === status) &&
      (category === 'all' || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q)));
  }, [products, search, status, category]);

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Everything in your store. Drafts stay hidden from customers."
        actions={!readOnly ? <Link to="/dashboard/products/new" className="btn-primary">Add product</Link> : undefined}
      />
      <div className="mb-4 space-y-3 empty:hidden">
        {flash && <Alert kind="success">{flash}</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          action={!readOnly ? <Link to="/dashboard/products/new" className="btn-primary">Add your first product</Link> : undefined}
        >
          Add photos, sizes and prices, then publish when you’re ready for customers to see it.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <input type="search" aria-label="Search products" className="input max-w-xs" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Filter by status" className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <select aria-label="Filter by category" className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No products match">Try a different search or filter.</EmptyState>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-sand-200 text-sand-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Created</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const url = publicImageUrl(coverFor.get(p.id));
                    const stock = stockFor.get(p.id);
                    return (
                      <tr key={p.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50">
                        <td className="px-4 py-3">
                          <Link to={`/dashboard/products/${p.id}`} className="flex items-center gap-3">
                            <span className="h-14 w-11 shrink-0 overflow-hidden rounded-sm bg-sand-100">
                              {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                            </span>
                            <span>
                              <span className="block font-medium underline-offset-4 hover:underline">{p.name}</span>
                              <span className="block text-xs text-sand-500">{p.category}{p.is_featured ? ' · Featured' : ''}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {formatPHP(p.price)}
                          {p.compare_at_price != null && p.compare_at_price > p.price && <span className="block text-xs text-sand-500 line-through">{formatPHP(p.compare_at_price)}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {!stock ? <span className="text-sand-500">No options</span> : stock.total === 0 ? <span className="text-red-800">Out of stock</span> : `${stock.total} in ${stock.options} option${stock.options === 1 ? '' : 's'}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${p.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-sand-200 bg-sand-100 text-sand-700'}`}>
                            {p.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-sand-500 md:table-cell">{formatDate(p.created_at)}</td>
                        <td className="hidden px-4 py-3 text-sand-500 md:table-cell">{formatDate(p.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
