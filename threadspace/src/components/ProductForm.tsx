import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatDate } from '@/lib/format';
import { ALLOWED_IMAGE_TYPES, publicImageUrl, removeImage, uploadStoreImage, validateImage } from '@/lib/storage';
import type { Product, ProductImage, ProductStatus, ProductVariant } from '@/lib/types';
import { Alert, ConfirmDialog, Spinner } from './ui';

export interface Flash { notice?: string; warnings: string[] }

interface Props {
  storeId: string;
  readOnly: boolean;
  categories: string[];
  initial?: { product: Product; images: ProductImage[]; variants: ProductVariant[] };
  flash?: Flash;
  onSaved: (flash: Flash) => void;
}

interface PendingImage { key: string; file: File; url: string }
interface VariantRow { key: string; id?: string; size: string; color: string; sku: string; stock: string; active: boolean; loadedStock?: number }

const MAX_IMAGES = 10;
const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const label = (v: { size: string; color: string }) => [v.size.trim(), v.color.trim()].filter(Boolean).join(' / ') || 'Standard';

function friendly(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code === '23505') return 'Two options share the same size and color (or the same SKU). Each combination can only be listed once.';
  return errorMessage(err);
}

export default function ProductForm({ storeId, readOnly, categories, initial, flash, onSaved }: Props) {
  const navigate = useNavigate();
  const product = initial?.product;

  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [compareAt, setCompareAt] = useState(product?.compare_at_price != null ? String(product.compare_at_price) : '');
  const [featured, setFeatured] = useState(product?.is_featured ?? false);
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? 'draft');

  const [existing, setExisting] = useState<ProductImage[]>(() => [...(initial?.images ?? [])].sort((a, b) => a.sort_order - b.sort_order));
  const [removed, setRemoved] = useState<ProductImage[]>([]);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(() => {
    const c = initial?.images.find((i) => i.is_cover);
    return c ? `e:${c.id}` : null;
  });

  const [variants, setVariants] = useState<VariantRow[]>(() =>
    [...(initial?.variants ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((v) => ({
        key: v.id, id: v.id, size: v.size ?? '', color: v.color ?? '', sku: v.sku ?? '',
        stock: String(v.stock_quantity), active: v.is_active, loadedStock: v.stock_quantity,
      })),
  );
  const [removedVariants, setRemovedVariants] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Free preview URLs when the form goes away.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const tiles = [
    ...existing.map((i) => ({ key: `e:${i.id}`, url: publicImageUrl(i.storage_path), name: i.alt_text ?? 'Product photo' })),
    ...pending.map((p) => ({ key: `p:${p.key}`, url: p.url, name: p.file.name })),
  ];
  const effectiveCover = coverKey && tiles.some((t) => t.key === coverKey) ? coverKey : tiles[0]?.key ?? null;

  function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setError(null);
    const room = MAX_IMAGES - tiles.length;
    const next: PendingImage[] = [];
    for (const file of files) {
      const invalid = validateImage(file);
      if (invalid) { setError(`${file.name}: ${invalid}`); continue; }
      if (next.length >= room) { setError(`A product can have up to ${MAX_IMAGES} photos.`); break; }
      next.push({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file) });
    }
    if (next.length) setPending((p) => [...p, ...next]);
  }

  function removeTile(key: string) {
    if (key.startsWith('e:')) {
      const img = existing.find((i) => `e:${i.id}` === key);
      if (img) { setExisting((l) => l.filter((i) => i.id !== img.id)); setRemoved((l) => [...l, img]); }
    } else {
      const p = pending.find((x) => `p:${x.key}` === key);
      if (p) { URL.revokeObjectURL(p.url); setPending((l) => l.filter((x) => x.key !== p.key)); }
    }
  }

  const setVariant = (key: string, patch: Partial<VariantRow>) => setVariants((l) => l.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const addVariant = (size = '') => setVariants((l) => [...l, { key: crypto.randomUUID(), size, color: '', sku: '', stock: '0', active: true }]);
  function removeVariant(v: VariantRow) {
    if (v.id) setRemovedVariants((l) => [...l, v.id as string]);
    setVariants((l) => l.filter((x) => x.key !== v.key));
  }

  function validate(): string | null {
    if (!name.trim()) return 'Give the product a name.';
    const p = Number(price);
    if (price.trim() === '' || !Number.isFinite(p) || p < 0 || p > 10_000_000) return 'Enter a valid price.';
    if (compareAt.trim() !== '') {
      const c = Number(compareAt);
      if (!Number.isFinite(c) || c < p) return 'The compare-at price must be at least the selling price.';
    }
    const seen = new Set<string>();
    const skus = new Set<string>();
    for (const v of variants) {
      const stock = Number(v.stock);
      if (v.stock.trim() === '' || !Number.isInteger(stock) || stock < 0 || stock > 100000) return `Stock for “${label(v)}” must be a whole number, 0 or more.`;
      const combo = `${v.size.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`;
      if (seen.has(combo)) return `“${label(v)}” is listed twice. Each size and color combination can only appear once.`;
      seen.add(combo);
      const sku = v.sku.trim().toLowerCase();
      if (sku) { if (skus.has(sku)) return `The SKU “${v.sku.trim()}” is used twice.`; skus.add(sku); }
    }
    if (status === 'published') {
      if (tiles.length === 0) return 'Add at least one photo before publishing, or save as a draft.';
      if (!variants.some((v) => v.active)) return 'Add at least one size or color option before publishing, or save as a draft.';
    }
    return null;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    const problem = validate();
    if (problem) { setError(problem); return; }
    setSaving(true);
    const warnings: string[] = [];
    try {
      const fields = {
        name: name.trim(),
        description: description.trim(),
        price: Math.round(Number(price) * 100) / 100,
        compare_at_price: compareAt.trim() ? Math.round(Number(compareAt) * 100) / 100 : null,
        category: category.trim() || 'Clothing',
        is_featured: featured,
      };
      let productId = product?.id;
      if (!productId) {
        // New products start as drafts; they're published only after photos and options saved successfully.
        const { data, error: err } = await supabase.from('products').insert({ ...fields, store_id: storeId, status: 'draft' }).select('id').single();
        if (err) throw err;
        productId = data.id as string;
      } else {
        const { error: err } = await supabase.from('products').update(fields).eq('id', productId);
        if (err) throw err;
      }

      // Photos: removals first, then uploads
      for (const img of removed) {
        const { error: err } = await supabase.from('product_images').delete().eq('id', img.id);
        if (err) warnings.push(`Could not remove a photo: ${errorMessage(err)}`);
        else removeImage(img.storage_path).catch(() => { /* cleanup is best-effort */ });
      }
      const inserted = new Map<string, string>();
      let order = existing.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1;
      for (const p of pending) {
        let path: string | null = null;
        try {
          path = await uploadStoreImage(storeId, p.file, 'product');
          const { data, error: err } = await supabase
            .from('product_images')
            .insert({ product_id: productId, store_id: storeId, storage_path: path, alt_text: fields.name, sort_order: order++, is_cover: false })
            .select('id')
            .single();
          if (err) throw err;
          inserted.set(p.key, data.id as string);
        } catch (err) {
          if (path) removeImage(path).catch(() => undefined);
          warnings.push(`Could not upload ${p.file.name}: ${errorMessage(err)}`);
        }
      }

      let coverId: string | undefined;
      if (effectiveCover?.startsWith('e:')) coverId = existing.find((i) => `e:${i.id}` === effectiveCover)?.id;
      else if (effectiveCover?.startsWith('p:')) coverId = inserted.get(effectiveCover.slice(2));
      if (!coverId) coverId = existing[0]?.id ?? Array.from(inserted.values())[0];
      if (coverId) {
        const a = await supabase.from('product_images').update({ is_cover: false }).eq('product_id', productId).eq('is_cover', true).neq('id', coverId);
        const b = await supabase.from('product_images').update({ is_cover: true }).eq('id', coverId);
        if (a.error || b.error) warnings.push('Could not set the cover photo. The first photo will be used.');
      }

      // Options and stock
      for (const id of removedVariants) {
        const { error: err } = await supabase.from('product_variants').delete().eq('id', id);
        if (err) warnings.push(`Could not remove an option: ${errorMessage(err)}`);
      }
      for (const v of variants) {
        const row = { size: v.size.trim() || null, color: v.color.trim() || null, sku: v.sku.trim() || null, stock_quantity: Number(v.stock), is_active: v.active };
        try {
          if (v.id) {
            // Only write stock if the person changed it, and only if nobody (e.g. a new order) changed it meanwhile.
            const stockChanged = row.stock_quantity !== v.loadedStock;
            const { stock_quantity: _omit, ...withoutStock } = row;
            let q = supabase.from('product_variants').update(stockChanged ? row : withoutStock).eq('id', v.id);
            if (stockChanged) q = q.eq('stock_quantity', v.loadedStock as number);
            const { data, error: err } = await q.select('id');
            if (err) throw err;
            if (!data || data.length === 0) warnings.push(`Stock for “${label(v)}” changed while you were editing (an order may have come in), so it wasn’t overwritten. The page now shows the current number.`);
          } else {
            const { error: err } = await supabase.from('product_variants').insert({ ...row, product_id: productId, store_id: storeId });
            if (err) throw err;
          }
        } catch (err) {
          warnings.push(`“${label(v)}”: ${friendly(err)}`);
        }
      }

      // Publish only if the saved data really supports it
      const [imgCount, varCount] = await Promise.all([
        supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId),
        supabase.from('product_variants').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('is_active', true),
      ]);
      let finalStatus: ProductStatus = 'draft';
      if (status === 'published') {
        if ((imgCount.count ?? 0) > 0 && (varCount.count ?? 0) > 0) finalStatus = 'published';
        else warnings.push('The product was saved as a draft because its photos or options didn’t save completely. Fix that and publish again.');
      }
      const { error: statusErr } = await supabase.from('products').update({ status: finalStatus }).eq('id', productId);
      if (statusErr) warnings.push(`Could not update visibility: ${errorMessage(statusErr)}`);

      const result: Flash = { notice: product ? 'Product saved.' : 'Product created.', warnings };
      pending.forEach((p) => URL.revokeObjectURL(p.url));
      if (!product) navigate(`/dashboard/products/${productId}`, { replace: true, state: result });
      else onSaved(result);
    } catch (err) {
      setError(`Couldn’t save: ${friendly(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!product) return;
    setDeleting(true);
    const paths = [...existing, ...removed].map((i) => i.storage_path);
    const { error: err } = await supabase.from('products').delete().eq('id', product.id);
    if (err) { setDeleting(false); setConfirmDelete(false); setError(`Couldn’t delete: ${errorMessage(err)}`); return; }
    if (paths.length) supabase.storage.from('product-images').remove(paths).catch(() => undefined);
    navigate('/dashboard/products', { replace: true, state: { notice: `“${product.name}” was deleted.` } });
  }

  const dis = readOnly || saving;

  return (
    <form onSubmit={save} className="space-y-10">
      <div className="space-y-3 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {flash?.notice && <Alert kind="success">{flash.notice}</Alert>}
        {flash?.warnings.map((w) => <Alert key={w}>{w}</Alert>)}
        {readOnly && <Alert kind="info">This store is not active, so products can’t be changed right now.</Alert>}
      </div>

      <section aria-labelledby="pf-details">
        <h2 id="pf-details" className="mb-3 font-display text-2xl">Details</h2>
        <div className="card grid gap-5 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="pf-name" className="label">Product name</label>
            <input id="pf-name" required maxLength={200} className="input" value={name} disabled={dis} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="pf-desc" className="label">Description</label>
            <textarea id="pf-desc" rows={4} maxLength={4000} className="input" value={description} disabled={dis} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pf-price" className="label">Price (₱)</label>
            <input id="pf-price" required type="number" inputMode="decimal" min="0" step="0.01" className="input" value={price} disabled={dis} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pf-compare" className="label">Compare-at price (₱, optional)</label>
            <input id="pf-compare" type="number" inputMode="decimal" min="0" step="0.01" className="input" value={compareAt} disabled={dis} onChange={(e) => setCompareAt(e.target.value)} />
            <p className="hint">The original price, shown crossed out when it’s higher than the selling price.</p>
          </div>
          <div>
            <label htmlFor="pf-cat" className="label">Category</label>
            <input id="pf-cat" list="pf-cats" maxLength={60} placeholder="Clothing" className="input" value={category} disabled={dis} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="pf-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <label className="flex items-center gap-3 self-end pb-2.5 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-black" checked={featured} disabled={dis} onChange={(e) => setFeatured(e.target.checked)} />
            Feature this product on the storefront
          </label>
        </div>
      </section>

      <section aria-labelledby="pf-photos">
        <h2 id="pf-photos" className="mb-3 font-display text-2xl">Photos</h2>
        <div className="card p-5">
          {tiles.length === 0 ? (
            <p className="mb-4 text-sm text-sand-500">No photos yet. The first photo you add becomes the cover.</p>
          ) : (
            <ul className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {tiles.map((t) => {
                const isCover = t.key === effectiveCover;
                return (
                  <li key={t.key} className="group relative">
                    <div className={`aspect-[3/4] overflow-hidden rounded border bg-sand-50 ${isCover ? 'border-black' : 'border-sand-200'}`}>
                      {t.url ? <img src={t.url} alt={t.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-sand-500">Not available</div>}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1 text-xs">
                      {isCover ? <span className="font-medium">Cover</span> : (
                        <button type="button" className="text-sand-500 underline underline-offset-2 hover:text-black disabled:no-underline" disabled={dis} onClick={() => setCoverKey(t.key)}>Set as cover</button>
                      )}
                      <button type="button" className="text-red-800 underline underline-offset-2 disabled:opacity-50" disabled={dis} onClick={() => removeTile(t.key)} aria-label={`Remove photo ${t.name}`}>Remove</button>
                    </div>
                    {t.key.startsWith('p:') && <span className="absolute left-1.5 top-1.5 rounded-sm bg-black px-1.5 py-0.5 text-[10px] text-white">Not saved yet</span>}
                  </li>
                );
              })}
            </ul>
          )}
          <label className={`btn-outline cursor-pointer ${dis || tiles.length >= MAX_IMAGES ? 'pointer-events-none opacity-50' : ''}`}>
            Add photos
            <input type="file" multiple className="sr-only" accept={Object.keys(ALLOWED_IMAGE_TYPES).join(',')} onChange={addFiles} disabled={dis || tiles.length >= MAX_IMAGES} />
          </label>
          <p className="hint">Up to {MAX_IMAGES} photos. JPEG, PNG, WebP, AVIF or GIF, 5 MB each. Photos upload when you save.</p>
        </div>
      </section>

      <section aria-labelledby="pf-variants">
        <h2 id="pf-variants" className="mb-3 font-display text-2xl">Sizes, colors and stock</h2>
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-sand-500">Quick add:</span>
            {SIZE_PRESETS.map((s) => {
              const has = variants.some((v) => v.size.trim().toUpperCase() === s && !v.color.trim());
              return <button key={s} type="button" className="btn-outline px-3 py-1.5" disabled={dis || has} onClick={() => addVariant(s)}>{s}</button>;
            })}
            <button type="button" className="btn-quiet px-3 py-1.5" disabled={dis} onClick={() => addVariant()}>+ Custom option</button>
          </div>
          {variants.length === 0 ? (
            <p className="text-sm text-sand-500">No options yet. Add at least one size or color (or a single “Standard” option) so customers can buy this product.</p>
          ) : (
            <div className="space-y-3">
              {variants.map((v) => (
                <div key={v.key} className="grid grid-cols-2 items-end gap-3 rounded border border-sand-200 p-3 md:grid-cols-[1fr_1fr_1fr_6rem_auto_auto]">
                  <div>
                    <label className="label" htmlFor={`v-size-${v.key}`}>Size</label>
                    <input id={`v-size-${v.key}`} maxLength={40} className="input" value={v.size} disabled={dis} onChange={(e) => setVariant(v.key, { size: e.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`v-color-${v.key}`}>Color</label>
                    <input id={`v-color-${v.key}`} maxLength={40} className="input" value={v.color} disabled={dis} onChange={(e) => setVariant(v.key, { color: e.target.value })} />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="label" htmlFor={`v-sku-${v.key}`}>SKU (optional)</label>
                    <input id={`v-sku-${v.key}`} maxLength={80} className="input" value={v.sku} disabled={dis} onChange={(e) => setVariant(v.key, { sku: e.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`v-stock-${v.key}`}>Stock</label>
                    <input id={`v-stock-${v.key}`} type="number" inputMode="numeric" min="0" step="1" className="input" value={v.stock} disabled={dis} onChange={(e) => setVariant(v.key, { stock: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 pb-2.5 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-black" checked={v.active} disabled={dis} onChange={(e) => setVariant(v.key, { active: e.target.checked })} />
                    On sale
                  </label>
                  <button type="button" className="btn-quiet pb-2.5 text-red-800" disabled={dis} onClick={() => removeVariant(v)} aria-label={`Remove option ${label(v)}`}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <p className="hint">Leave size and color empty for a single “Standard” option. Customers can’t order more than the stock you enter.</p>
        </div>
      </section>

      <section aria-labelledby="pf-visibility">
        <h2 id="pf-visibility" className="mb-3 font-display text-2xl">Visibility</h2>
        <fieldset className="card space-y-3 p-5" disabled={dis}>
          <legend className="sr-only">Visibility</legend>
          {([
            ['draft', 'Draft', 'Only you can see it. Customers can’t find or buy it.'],
            ['published', 'Published', 'Visible on your storefront. Needs at least one photo and one option.'],
          ] as [ProductStatus, string, string][]).map(([value, title, text]) => (
            <label key={value} className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="radio" name="status" className="mt-1 accent-black" checked={status === value} onChange={() => setStatus(value)} />
              <span><span className="font-medium">{title}</span><span className="block text-sand-500">{text}</span></span>
            </label>
          ))}
        </fieldset>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-sand-200 pt-6">
        <div className="flex gap-2">
          {!readOnly && <button type="submit" className="btn-primary" disabled={saving}>{saving && <Spinner />} {product ? 'Save changes' : 'Create product'}</button>}
          <Link to="/dashboard/products" className="btn-quiet">{product ? 'Back to products' : 'Cancel'}</Link>
        </div>
        {product && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-sand-500">
            <span>Created {formatDate(product.created_at)}</span>
            <span>Updated {formatDate(product.updated_at)}</span>
            {!readOnly && <button type="button" className="btn-danger px-3 py-1.5" onClick={() => setConfirmDelete(true)}>Delete product</button>}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        busy={deleting}
        title="Delete this product?"
        message={<>“{product?.name}” and its photos and options will be permanently deleted. Past orders keep their record of what was bought. This can’t be undone. To just hide it, set it to Draft instead.</>}
        confirmLabel="Delete product"
        onConfirm={deleteProduct}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}
