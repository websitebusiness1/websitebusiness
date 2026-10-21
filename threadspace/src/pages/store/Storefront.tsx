import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { publicImageUrl } from '@/lib/storage';
import type { Product, ProductImage } from '@/lib/types';
import { useStoreCtx } from '@/components/store/StoreFrame';
import ProductCard from '@/components/store/ProductCard';
import { Alert, PageLoader } from '@/components/ui';

type Sort = 'new' | 'low' | 'high';

export default function Storefront() {
  const { store, settings } = useStoreCtx();
  const [products, setProducts] = useState<Product[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [stock, setStock] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState<Sort>('new');
  const [hideSold, setHideSold] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, i, v] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', store.id).eq('status', 'published').order('created_at', { ascending: false }),
        supabase.from('product_images').select('*').eq('store_id', store.id),
        supabase.from('product_variants').select('product_id, stock_quantity').eq('store_id', store.id),
      ]);
      if (cancelled) return;
      const err = p.error ?? i.error ?? v.error;
      if (err) setError(errorMessage(err));
      setProducts((p.data ?? []) as Product[]);
      setImages((i.data ?? []) as ProductImage[]);
      const totals = new Map<string, number>();
      ((v.data ?? []) as { product_id: string; stock_quantity: number }[]).forEach((x) => totals.set(x.product_id, (totals.get(x.product_id) ?? 0) + x.stock_quantity));
      setStock(totals);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [store.id]);

  const imagesBy = useMemo(() => {
    const m = new Map<string, ProductImage[]>();
    images.forEach((i) => m.set(i.product_id, [...(m.get(i.product_id) ?? []), i]));
    return m;
  }, [images]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);
  const soldOut = (p: Product) => (stock.get(p.id) ?? 0) <= 0;
  const filtering = q.trim() !== '' || cat !== 'all' || hideSold || sort !== 'new';

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = products.filter((p) =>
      (cat === 'all' || p.category === cat) &&
      (!hideSold || !soldOut(p)) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle)));
    if (sort === 'low') list.sort((a, b) => a.price - b.price);
    if (sort === 'high') list.sort((a, b) => b.price - a.price);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, stock, q, cat, sort, hideSold]);

  const featured = products.filter((p) => p.is_featured).slice(0, 8);
  const newest = products.slice(0, 8);
  const banner = publicImageUrl(store.banner_path);
  const heading = settings?.hero_heading?.trim() || store.name;
  const sub = settings?.hero_subheading?.trim();

  const grid = (list: Product[]) => (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {list.map((p) => (
        <li key={p.id}><ProductCard product={p} images={imagesBy.get(p.id) ?? []} soldOut={soldOut(p)} storeSlug={store.slug} /></li>
      ))}
    </ul>
  );

  return (
    <div>
      <section className="relative" aria-label="Welcome">
        {banner ? (
          <div className="relative h-[46vh] min-h-[18rem] w-full overflow-hidden sm:h-[56vh]">
            <img src={banner} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-end bg-black/35">
              <div className="mx-auto w-full max-w-6xl px-4 pb-10 text-white">
                <h1 className="max-w-2xl font-display text-4xl leading-[1.02] sm:text-6xl">{heading}</h1>
                {sub && <p className="mt-3 max-w-xl text-base text-white/90">{sub}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--b-primary)', color: 'var(--b-on-primary)' }}>
            <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
              <h1 className="max-w-3xl font-display text-5xl leading-[1] sm:text-7xl">{heading}</h1>
              {sub && <p className="mt-4 max-w-xl text-base opacity-85">{sub}</p>}
            </div>
          </div>
        )}
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {loading ? <PageLoader /> : error ? (
          <div className="py-10"><Alert>{error}</Alert></div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-display text-3xl">New pieces are on the way</p>
            <p className="s-muted mt-2 text-sm">This store hasn’t published any products yet. Please check back soon.</p>
          </div>
        ) : (
          <>
            {!filtering && featured.length > 0 && (
              <section className="pt-14" aria-labelledby="featured-h">
                <h2 id="featured-h" className="mb-6 font-display text-3xl">Featured</h2>
                {grid(featured)}
              </section>
            )}
            {!filtering && (
              <section className="pt-14" aria-labelledby="new-h">
                <h2 id="new-h" className="mb-6 font-display text-3xl">New arrivals</h2>
                {grid(newest)}
              </section>
            )}

            <section className="pt-14" aria-labelledby="all-h">
              <h2 id="all-h" className="mb-6 font-display text-3xl">{filtering ? 'Results' : 'All products'}</h2>

              <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Categories">
                <button type="button" className="s-chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
                {categories.map((c) => <button key={c} type="button" className="s-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
              </div>
              <div className="mb-8 flex flex-wrap items-center gap-3">
                <input type="search" aria-label="Search products" placeholder="Search" className="s-input max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
                <select aria-label="Sort products" className="s-input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="new">Newest</option>
                  <option value="low">Price: low to high</option>
                  <option value="high">Price: high to low</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" style={{ accentColor: 'var(--b-text)' }} checked={hideSold} onChange={(e) => setHideSold(e.target.checked)} />
                  Hide sold out
                </label>
              </div>

              {shown.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="font-display text-2xl">Nothing matches</p>
                  <p className="s-muted mt-1 text-sm">Try a different search or category.</p>
                  <button type="button" className="s-btn s-btn-outline mt-5" onClick={() => { setQ(''); setCat('all'); setSort('new'); setHideSold(false); }}>Clear filters</button>
                </div>
              ) : grid(shown)}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
