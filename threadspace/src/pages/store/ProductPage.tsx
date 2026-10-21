import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatPHP } from '@/lib/format';
import { publicImageUrl } from '@/lib/storage';
import { useCart, CartItem } from '@/lib/cart';
import type { Product, ProductImage, ProductVariant } from '@/lib/types';
import { useStoreCtx } from '@/components/store/StoreFrame';
import { Alert, ConfirmDialog, PageLoader } from '@/components/ui';

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const sizeRank = (s: string) => { const i = SIZE_ORDER.indexOf(s.toUpperCase()); return i === -1 ? 99 : i; };
const unique = (list: (string | null)[]) => Array.from(new Set(list.filter((x): x is string => Boolean(x))));

export default function ProductPage() {
  const { store } = useStoreCtx();
  const { productSlug } = useParams();
  const cart = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [conflict, setConflict] = useState<CartItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProduct(null); setSize(null); setColor(null); setQty(1); setActive(0); setAdded(false);
    (async () => {
      const { data: p, error: pe } = await supabase.from('products').select('*').eq('store_id', store.id).eq('slug', productSlug ?? '').eq('status', 'published').maybeSingle();
      if (cancelled) return;
      if (pe) setError(errorMessage(pe));
      if (!p) { setLoading(false); return; }
      const [i, v] = await Promise.all([
        supabase.from('product_images').select('*').eq('product_id', (p as Product).id),
        supabase.from('product_variants').select('*').eq('product_id', (p as Product).id).eq('is_active', true),
      ]);
      if (cancelled) return;
      const vs = ((v.data ?? []) as ProductVariant[]);
      setProduct(p as Product);
      setImages(((i.data ?? []) as ProductImage[]).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order));
      setVariants(vs);
      // If there's only one choice, pick it for the shopper.
      const sizes = unique(vs.map((x) => x.size)); const colors = unique(vs.map((x) => x.color));
      if (sizes.length === 1) setSize(sizes[0]);
      if (colors.length === 1) setColor(colors[0]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [store.id, productSlug]);

  const sizes = useMemo(() => unique(variants.map((v) => v.size)).sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b)), [variants]);
  const colors = useMemo(() => unique(variants.map((v) => v.color)), [variants]);
  const selected = variants.find((v) => (sizes.length ? v.size === size : !v.size) && (colors.length ? v.color === color : !v.color));
  const totalStock = variants.reduce((n, v) => n + v.stock_quantity, 0);
  const inCart = selected && cart.storeSlug === store.slug ? cart.items.find((i) => i.variantId === selected.id)?.quantity ?? 0 : 0;
  const canAdd = selected ? Math.max(0, Math.min(selected.stock_quantity - inCart, 10)) : 0;

  useEffect(() => { setQty((q) => Math.max(1, Math.min(q, canAdd || 1))); setAdded(false); }, [selected?.id, canAdd]);

  if (loading) return <PageLoader />;
  if (!product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center">
        {error && <div className="mb-6"><Alert>{error}</Alert></div>}
        <p className="font-display text-4xl">Product not found</p>
        <p className="s-muted mt-2 text-sm">It may have been removed or isn’t available right now.</p>
        <Link to={`/store/${store.slug}`} className="s-btn mt-6">Back to {store.name}</Link>
      </div>
    );
  }

  const sizeOk = (s: string) => variants.some((v) => v.size === s && v.stock_quantity > 0 && (!colors.length || !color || v.color === color));
  const colorOk = (c: string) => variants.some((v) => v.color === c && v.stock_quantity > 0 && (!sizes.length || !size || v.size === size));
  const onSale = product.compare_at_price != null && product.compare_at_price > product.price;
  const need = [sizes.length && !size ? 'a size' : '', colors.length && !color ? 'a color' : ''].filter(Boolean).join(' and ');

  const optionLabel = [selected?.size, selected?.color].filter(Boolean).join(' / ') || 'Standard';
  const makeItem = (): CartItem | null => {
    if (!selected) return null;
    return {
      variantId: selected.id, productId: product.id, productSlug: product.slug, name: product.name, optionLabel,
      price: product.price, quantity: qty, image: images[0]?.storage_path ?? null, stock: selected.stock_quantity,
    };
  };

  function add() {
    const item = makeItem();
    if (!item) return;
    const res = cart.addItem(store.slug, item);
    if (res.status === 'other_store') setConflict(item);
    else setAdded(true);
  }

  const mainUrl = publicImageUrl(images[active]?.storage_path);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Link to={`/store/${store.slug}`} className="s-muted text-sm hover:underline">← Back to {store.name}</Link>

      <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <div className="s-soft aspect-[3/4] overflow-hidden">
            {mainUrl ? <img src={mainUrl} alt={images[active]?.alt_text || product.name} className="h-full w-full object-cover" /> : (
              <div className="s-muted flex h-full items-center justify-center px-6 text-center font-display text-2xl">{product.name}</div>
            )}
          </div>
          {images.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product photos">
              {images.map((img, idx) => (
                <li key={img.id} className="shrink-0">
                  <button type="button" onClick={() => setActive(idx)} aria-label={`Show photo ${idx + 1}`} aria-current={idx === active}
                    className={`block h-20 w-16 overflow-hidden border ${idx === active ? '' : 's-border opacity-70 hover:opacity-100'}`} style={idx === active ? { borderColor: 'var(--b-text)' } : undefined}>
                    <img src={publicImageUrl(img.storage_path) ?? ''} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="s-muted text-sm">{product.category}</p>
          <h1 className="mt-1 font-display text-4xl leading-tight sm:text-5xl">{product.name}</h1>
          <p className="mt-4 text-xl">
            {formatPHP(product.price)}
            {onSale && <span className="s-muted ml-3 text-base line-through">{formatPHP(product.compare_at_price as number)}</span>}
          </p>

          {product.description && <p className="mt-6 whitespace-pre-line text-sm leading-relaxed">{product.description}</p>}

          {totalStock <= 0 ? (
            <p className="mt-8 font-medium" role="status">Sold out</p>
          ) : (
            <div className="mt-8 space-y-6">
              {sizes.length > 0 && (
                <div role="radiogroup" aria-label="Size">
                  <p className="mb-2 text-sm font-medium">Size{size ? `: ${size}` : ''}</p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => <button key={s} type="button" role="radio" aria-checked={size === s} disabled={!sizeOk(s)} className="s-chip min-w-[3rem]" onClick={() => setSize(s)}>{s}</button>)}
                  </div>
                </div>
              )}
              {colors.length > 0 && (
                <div role="radiogroup" aria-label="Color">
                  <p className="mb-2 text-sm font-medium">Color{color ? `: ${color}` : ''}</p>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c) => <button key={c} type="button" role="radio" aria-checked={color === c} disabled={!colorOk(c)} className="s-chip" onClick={() => setColor(c)}>{c}</button>)}
                  </div>
                </div>
              )}

              <p className="text-sm" role="status">
                {!selected
                  ? (need ? `Choose ${need}.` : 'This combination isn’t available.')
                  : selected.stock_quantity <= 0 ? 'Sold out in this option.'
                  : selected.stock_quantity <= 5 ? `Only ${selected.stock_quantity} left.`
                  : 'In stock.'}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center border s-border" role="group" aria-label="Quantity">
                  <button type="button" className="px-3.5 py-2.5 disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label="Decrease quantity">−</button>
                  <span className="min-w-[2rem] text-center text-sm" aria-live="polite">{qty}</span>
                  <button type="button" className="px-3.5 py-2.5 disabled:opacity-40" disabled={qty >= canAdd} onClick={() => setQty(qty + 1)} aria-label="Increase quantity">+</button>
                </div>
                <button type="button" className="s-btn flex-1 sm:flex-none sm:px-10" disabled={!selected || canAdd < 1} onClick={add}>
                  {selected && selected.stock_quantity > 0 && canAdd < 1 ? 'All available are in your cart' : 'Add to cart'}
                </button>
              </div>

              {added && (
                <div role="status" className="s-soft flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>Added to your cart.</span>
                  <span className="flex gap-4"><Link to="/cart" className="font-medium underline underline-offset-4">View cart</Link><Link to="/checkout" className="font-medium underline underline-offset-4">Checkout</Link></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(conflict)}
        title="Start a new cart?"
        message="Your cart already has items from another store. A cart can only hold items from one store at a time. Start a new cart with this item instead?"
        confirmLabel="Start new cart"
        onConfirm={() => { if (conflict) { cart.replaceWith(store.slug, conflict); setAdded(true); } setConflict(null); }}
        onCancel={() => setConflict(null)}
      />
    </div>
  );
}
