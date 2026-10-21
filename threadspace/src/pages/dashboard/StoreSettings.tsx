import { CSSProperties, FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { removeImage, uploadStoreImage, validateImage } from '@/lib/storage';
import { buildTheme } from '@/lib/theme';
import { useAuth } from '@/auth/AuthProvider';
import type { BrandColors, Store, StoreSettings as Settings } from '@/lib/types';
import ImageSlot from '@/components/ImageSlot';
import { Alert, PageHeader, PageLoader, Spinner } from '@/components/ui';

const DEFAULT_COLORS: BrandColors = { primary: '#111111', accent: '#b08d57', background: '#faf8f5', text: '#111111' };
const COLOR_LABELS: [keyof BrandColors, string][] = [
  ['primary', 'Buttons and top bar'],
  ['accent', 'Sale badges'],
  ['background', 'Page background'],
  ['text', 'Text'],
];
const SOCIALS = ['facebook', 'instagram', 'tiktok', 'website'] as const;

interface Form {
  name: string; contact_email: string; contact_phone: string; contact_address: string;
  facebook: string; instagram: string; tiktok: string; website: string;
  colors: BrandColors;
  announcement: string; hero_heading: string; hero_subheading: string;
  shipping_fee: string; free_threshold: string;
  cod: boolean; bank: boolean; gcash: boolean; bank_instructions: string; gcash_instructions: string;
}

function toForm(s: Store, st: Settings | null): Form {
  const methods = st?.payment_methods ?? ['cod'];
  return {
    name: s.name,
    contact_email: s.contact_email ?? '', contact_phone: s.contact_phone ?? '', contact_address: s.contact_address ?? '',
    facebook: s.social_links?.facebook ?? '', instagram: s.social_links?.instagram ?? '', tiktok: s.social_links?.tiktok ?? '', website: s.social_links?.website ?? '',
    colors: { ...DEFAULT_COLORS, ...(s.brand_colors ?? {}) },
    announcement: st?.announcement ?? '', hero_heading: st?.hero_heading ?? '', hero_subheading: st?.hero_subheading ?? '',
    shipping_fee: String(st?.shipping_fee ?? 0),
    free_threshold: st?.free_shipping_threshold != null ? String(st.free_shipping_threshold) : '',
    cod: methods.includes('cod'), bank: methods.includes('bank_transfer'), gcash: methods.includes('gcash'),
    bank_instructions: st?.payment_instructions?.bank_transfer ?? '', gcash_instructions: st?.payment_instructions?.gcash ?? '',
  };
}

export default function StoreSettings() {
  const { activeStore, refresh } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';

  const [store, setStore] = useState<Store | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    const [s, st] = await Promise.all([
      supabase.from('stores').select('*').eq('id', storeId).maybeSingle(),
      supabase.from('store_settings').select('*').eq('store_id', storeId).maybeSingle(),
    ]);
    const err = s.error ?? st.error;
    if (err) setError(errorMessage(err));
    const row = (s.data ?? null) as Store | null;
    setStore(row);
    setForm(row ? toForm(row, (st.data ?? null) as Settings | null) : null);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { setLoading(true); setNotice(null); setError(null); load(); }, [load]);

  if (loading) return <PageLoader />;
  if (!store || !form) return <Alert>Couldn’t load your store settings.</Alert>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const dis = readOnly || saving;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!store || !form || readOnly) return;
    setError(null);
    setNotice(null);

    if (!form.name.trim()) { setError('Your store needs a name.'); return; }
    const social_links: Record<string, string> = {};
    for (const k of SOCIALS) {
      const v = form[k].trim();
      if (!v) continue;
      if (!/^https?:\/\//i.test(v)) { setError(`The ${k} link must start with http:// or https://`); return; }
      social_links[k] = v;
    }
    const fee = Number(form.shipping_fee);
    if (form.shipping_fee.trim() === '' || !Number.isFinite(fee) || fee < 0 || fee > 100000) { setError('Enter a valid shipping fee (0 or more).'); return; }
    let threshold: number | null = null;
    if (form.free_threshold.trim() !== '') {
      threshold = Number(form.free_threshold);
      if (!Number.isFinite(threshold) || threshold < 0) { setError('Enter a valid amount for free shipping, or leave it empty.'); return; }
    }
    const methods = [form.cod && 'cod', form.bank && 'bank_transfer', form.gcash && 'gcash'].filter(Boolean) as string[];
    if (methods.length === 0) { setError('Turn on at least one payment method, or customers can’t check out.'); return; }
    if (form.bank && !form.bank_instructions.trim()) { setError('Add your bank details so customers know where to send payment.'); return; }
    if (form.gcash && !form.gcash_instructions.trim()) { setError('Add your GCash number and name so customers know where to send payment.'); return; }
    const payment_instructions: Record<string, string> = {};
    if (form.bank_instructions.trim()) payment_instructions.bank_transfer = form.bank_instructions.trim();
    if (form.gcash_instructions.trim()) payment_instructions.gcash = form.gcash_instructions.trim();

    setSaving(true);
    const a = await supabase.from('stores').update({
      name: form.name.trim(),
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      contact_address: form.contact_address.trim() || null,
      social_links,
      brand_colors: form.colors,
    }).eq('id', store.id);
    const b = await supabase.from('store_settings').upsert({
      store_id: store.id,
      announcement: form.announcement.trim() || null,
      hero_heading: form.hero_heading.trim() || null,
      hero_subheading: form.hero_subheading.trim() || null,
      shipping_fee: Math.round(fee * 100) / 100,
      free_shipping_threshold: threshold,
      payment_methods: methods,
      payment_instructions,
    }, { onConflict: 'store_id' });
    setSaving(false);

    if (a.error || b.error) {
      setError(`Some changes didn’t save: ${errorMessage(a.error ?? b.error)}`);
    } else {
      setNotice('Settings saved. Your storefront now shows the changes.');
    }
    refresh();
    await load();
  }

  async function pickImage(kind: 'logo' | 'banner', file: File) {
    if (!store || readOnly) return;
    setError(null);
    setNotice(null);
    const invalid = validateImage(file);
    if (invalid) { setError(invalid); return; }
    setUploading(kind);
    const column = kind === 'logo' ? 'logo_path' : 'banner_path';
    const previous = store[column];
    let uploaded: string | null = null;
    try {
      uploaded = await uploadStoreImage(store.id, file, kind);
      const { error: err } = await supabase.from('stores').update({ [column]: uploaded }).eq('id', store.id);
      if (err) throw err;
      setStore({ ...store, [column]: uploaded });
      if (previous) removeImage(previous).catch(() => undefined);
      setNotice(`${kind === 'logo' ? 'Logo' : 'Banner'} updated.`);
      refresh();
    } catch (err) {
      if (uploaded) removeImage(uploaded).catch(() => undefined);
      setError(`Upload failed: ${errorMessage(err)}`);
    } finally {
      setUploading(null);
    }
  }

  const theme = { ...buildTheme(form.colors), minHeight: 0 } as CSSProperties;

  return (
    <div>
      <PageHeader title="Store settings" description="How your storefront looks, what customers pay, and how you’re reached." />
      <div className="mb-6 space-y-3 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {readOnly && <Alert kind="info">This store is not active, so settings can’t be changed right now.</Alert>}
      </div>

      <section aria-labelledby="ss-images" className="mb-10">
        <h2 id="ss-images" className="mb-3 font-display text-2xl">Logo and banner</h2>
        <div className="card grid gap-6 p-5 md:grid-cols-[auto_1fr]">
          <ImageSlot label="Logo" path={store.logo_path} uploading={uploading === 'logo'} disabled={readOnly} onPick={(f) => pickImage('logo', f)} />
          <ImageSlot label="Banner" path={store.banner_path} uploading={uploading === 'banner'} disabled={readOnly} onPick={(f) => pickImage('banner', f)} wide />
          <p className="hint md:col-span-2">JPEG, PNG, WebP, AVIF or GIF, up to 5 MB. A wide banner works best. These show on your public storefront.</p>
        </div>
      </section>

      <form onSubmit={save} className="space-y-10">
        <section aria-labelledby="ss-brand">
          <h2 id="ss-brand" className="mb-3 font-display text-2xl">Brand</h2>
          <div className="card space-y-6 p-5">
            <div className="max-w-md">
              <label htmlFor="ss-name" className="label">Brand name</label>
              <input id="ss-name" required maxLength={100} className="input" value={form.name} disabled={dis} onChange={(e) => set('name', e.target.value)} />
              <p className="hint">Your store address (/store/{store.slug}) can only be changed by the platform owner.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {COLOR_LABELS.map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`ss-c-${key}`} className="label">{label}</label>
                  <div className="flex items-center gap-2">
                    <input id={`ss-c-${key}`} type="color" disabled={dis} className="h-10 w-12 cursor-pointer rounded border border-sand-300 bg-white p-1" value={form.colors[key]} onChange={(e) => set('colors', { ...form.colors, [key]: e.target.value })} />
                    <code className="text-sm text-sand-500">{form.colors[key]}</code>
                  </div>
                </div>
              ))}
            </div>
            <div className="store-root rounded border s-border p-5" style={theme} aria-label="Color preview">
              <p className="font-display text-2xl">{form.name || 'Your brand'}</p>
              <p className="s-muted mt-1 text-sm">This is how your colors look together.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="s-btn">Add to cart</span>
                <span className="s-chip">M</span>
                <span className="s-chip" aria-pressed="true">L</span>
                <span className="s-badge">Sale</span>
              </div>
            </div>
            <p className="hint">If the text and background colors are too close to read, the storefront automatically adjusts the text.</p>
          </div>
        </section>

        <section aria-labelledby="ss-content">
          <h2 id="ss-content" className="mb-3 font-display text-2xl">Storefront text</h2>
          <div className="card grid gap-5 p-5">
            <div>
              <label htmlFor="ss-ann" className="label">Announcement bar (optional)</label>
              <input id="ss-ann" maxLength={140} className="input" placeholder="Free shipping on orders over ₱2,000" value={form.announcement} disabled={dis} onChange={(e) => set('announcement', e.target.value)} />
              <p className="hint">A thin bar across the top of every page.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="ss-hh" className="label">Homepage heading (optional)</label>
                <input id="ss-hh" maxLength={80} className="input" placeholder={form.name} value={form.hero_heading} disabled={dis} onChange={(e) => set('hero_heading', e.target.value)} />
                <p className="hint">Defaults to your brand name.</p>
              </div>
              <div>
                <label htmlFor="ss-hs" className="label">Homepage subheading (optional)</label>
                <input id="ss-hs" maxLength={200} className="input" value={form.hero_subheading} disabled={dis} onChange={(e) => set('hero_subheading', e.target.value)} />
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="ss-ship">
          <h2 id="ss-ship" className="mb-3 font-display text-2xl">Shipping</h2>
          <div className="card grid gap-5 p-5 md:grid-cols-2">
            <div>
              <label htmlFor="ss-fee" className="label">Shipping fee (₱)</label>
              <input id="ss-fee" type="number" inputMode="decimal" min="0" step="0.01" required className="input" value={form.shipping_fee} disabled={dis} onChange={(e) => set('shipping_fee', e.target.value)} />
              <p className="hint">Enter 0 for free shipping on everything.</p>
            </div>
            <div>
              <label htmlFor="ss-free" className="label">Free shipping from (₱, optional)</label>
              <input id="ss-free" type="number" inputMode="decimal" min="0" step="0.01" className="input" value={form.free_threshold} disabled={dis} onChange={(e) => set('free_threshold', e.target.value)} />
              <p className="hint">Orders at or above this amount ship free.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="ss-pay">
          <h2 id="ss-pay" className="mb-3 font-display text-2xl">Payment methods</h2>
          <div className="card space-y-5 p-5">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-black" checked={form.cod} disabled={dis} onChange={(e) => set('cod', e.target.checked)} />
              <span><span className="font-medium">Cash on delivery</span><span className="block text-sand-500">Customers pay when the order arrives.</span></span>
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-black" checked={form.bank} disabled={dis} onChange={(e) => set('bank', e.target.checked)} />
                <span className="font-medium">Bank transfer</span>
              </label>
              {form.bank && (
                <div>
                  <label htmlFor="ss-bank" className="label">Bank details shown to customers</label>
                  <textarea id="ss-bank" rows={3} maxLength={1000} className="input" placeholder={'Bank name\nAccount name\nAccount number'} value={form.bank_instructions} disabled={dis} onChange={(e) => set('bank_instructions', e.target.value)} />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-black" checked={form.gcash} disabled={dis} onChange={(e) => set('gcash', e.target.checked)} />
                <span className="font-medium">GCash</span>
              </label>
              {form.gcash && (
                <div>
                  <label htmlFor="ss-gcash" className="label">GCash details shown to customers</label>
                  <textarea id="ss-gcash" rows={3} maxLength={1000} className="input" placeholder={'GCash number\nAccount name'} value={form.gcash_instructions} disabled={dis} onChange={(e) => set('gcash_instructions', e.target.value)} />
                </div>
              )}
            </div>
            <p className="hint">Bank transfer and GCash orders show as <strong>payment pending</strong> until you open the order and mark the payment received. Do that only after you’ve checked the money arrived.</p>
          </div>
        </section>

        <section aria-labelledby="ss-contact">
          <h2 id="ss-contact" className="mb-3 font-display text-2xl">Contact and social links</h2>
          <div className="card grid gap-5 p-5 md:grid-cols-2">
            <div>
              <label htmlFor="ss-email" className="label">Contact email</label>
              <input id="ss-email" type="email" className="input" value={form.contact_email} disabled={dis} onChange={(e) => set('contact_email', e.target.value)} />
            </div>
            <div>
              <label htmlFor="ss-phone" className="label">Contact phone</label>
              <input id="ss-phone" type="tel" className="input" value={form.contact_phone} disabled={dis} onChange={(e) => set('contact_phone', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="ss-addr" className="label">Address</label>
              <input id="ss-addr" className="input" value={form.contact_address} disabled={dis} onChange={(e) => set('contact_address', e.target.value)} />
            </div>
            {SOCIALS.map((k) => (
              <div key={k}>
                <label htmlFor={`ss-${k}`} className="label capitalize">{k}</label>
                <input id={`ss-${k}`} type="url" placeholder="https://" className="input" value={form[k]} disabled={dis} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
          </div>
        </section>

        {!readOnly && (
          <div><button type="submit" className="btn-primary" disabled={saving}>{saving && <Spinner />} Save settings</button></div>
        )}
      </form>
    </div>
  );
}
