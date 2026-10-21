import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SLUG_RE, errorMessage, formatDate } from '@/lib/format';
import { removeImage, uploadStoreImage, validateImage } from '@/lib/storage';
import type { BrandColors, Store, StoreStatus } from '@/lib/types';
import ImageSlot from '@/components/ImageSlot';
import MembersPanel from '@/components/MembersPanel';
import { Alert, ConfirmDialog, EmptyState, PageHeader, PageLoader, Spinner, StatusBadge } from '@/components/ui';

interface FormState {
  name: string;
  slug: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  website: string;
  colors: BrandColors;
}

const DEFAULT_COLORS: BrandColors = { primary: '#111111', accent: '#b08d57', background: '#faf8f5', text: '#111111' };
const COLOR_LABELS: [keyof BrandColors, string][] = [
  ['primary', 'Buttons and highlights'],
  ['accent', 'Accent'],
  ['background', 'Page background'],
  ['text', 'Text'],
];
const SOCIALS = ['facebook', 'instagram', 'tiktok', 'website'] as const;

function toForm(s: Store): FormState {
  return {
    name: s.name,
    slug: s.slug,
    contact_email: s.contact_email ?? '',
    contact_phone: s.contact_phone ?? '',
    contact_address: s.contact_address ?? '',
    facebook: s.social_links?.facebook ?? '',
    instagram: s.social_links?.instagram ?? '',
    tiktok: s.social_links?.tiktok ?? '',
    website: s.social_links?.website ?? '',
    colors: { ...DEFAULT_COLORS, ...(s.brand_colors ?? {}) },
  };
}

const STATUS_COPY: Record<StoreStatus, { title: string; message: string; label: string; danger: boolean }> = {
  active: { title: 'Activate this store?', message: 'The public storefront becomes visible again and the client can manage products and orders.', label: 'Activate store', danger: false },
  suspended: { title: 'Suspend this store?', message: 'The public storefront is hidden, customers can’t place orders and the client can’t make changes. Nothing is deleted.', label: 'Suspend store', danger: true },
  archived: { title: 'Archive this store?', message: 'The store is hidden and locked like a suspended store, but marked as finished. Nothing is deleted and you can reactivate it later.', label: 'Archive store', danger: true },
};

export default function OwnerStoreDetail() {
  const { id } = useParams();
  const [store, setStore] = useState<Store | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null);
  const [pendingStatus, setPendingStatus] = useState<StoreStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('stores').select('*').eq('id', id ?? '').maybeSingle();
    if (err) setError(errorMessage(err));
    const s = (data ?? null) as Store | null;
    setStore(s);
    setForm(s ? toForm(s) : null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;
  if (!store || !form) {
    return <EmptyState title="Store not found" action={<Link to="/owner/stores" className="btn-outline">Back to stores</Link>}>It may have been removed, or the link is wrong.</EmptyState>;
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm({ ...form, [key]: value });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form || !store) return;
    setError(null);
    setNotice(null);
    if (!SLUG_RE.test(form.slug) || form.slug.length < 2) {
      setError('The store address can only use lowercase letters, numbers and single hyphens.');
      return;
    }
    const social_links: Record<string, string> = {};
    for (const key of SOCIALS) {
      const v = form[key].trim();
      if (!v) continue;
      if (!/^https?:\/\//i.test(v)) { setError(`The ${key} link must start with http:// or https://`); return; }
      social_links[key] = v;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from('stores')
      .update({
        name: form.name.trim(),
        slug: form.slug,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_address: form.contact_address.trim() || null,
        social_links,
        brand_colors: form.colors,
      })
      .eq('id', store.id)
      .select('*')
      .single();
    setSaving(false);
    if (err) { setError(err.code === '23505' ? 'That store address is already taken.' : errorMessage(err)); return; }
    setStore(data as Store);
    setForm(toForm(data as Store));
    setNotice('Changes saved.');
  }

  async function pickImage(kind: 'logo' | 'banner', file: File) {
    if (!store) return;
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
      if (previous) removeImage(previous).catch(() => { /* old file cleanup is best-effort */ });
      setNotice(`${kind === 'logo' ? 'Logo' : 'Banner'} updated.`);
    } catch (e) {
      if (uploaded) removeImage(uploaded).catch(() => undefined);
      setError(`Upload failed: ${errorMessage(e)}`);
    } finally {
      setUploading(null);
    }
  }

  async function changeStatus() {
    if (!store || !pendingStatus) return;
    setStatusBusy(true);
    setError(null);
    const { data, error: err } = await supabase.from('stores').update({ status: pendingStatus }).eq('id', store.id).select('*').single();
    setStatusBusy(false);
    setPendingStatus(null);
    if (err) { setError(errorMessage(err)); return; }
    setStore(data as Store);
    setNotice(`Store is now ${(data as Store).status}.`);
  }

  return (
    <div>
      <PageHeader
        title={store.name}
        description={<>Created {formatDate(store.created_at)} · <span>/store/{store.slug}</span></>}
        actions={<><StatusBadge status={store.status} /><a className="btn-outline" href={`/store/${store.slug}`} target="_blank" rel="noopener noreferrer">View storefront</a></>}
      />
      <div className="space-y-4 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
      </div>

      <div className="mt-8 space-y-10">
        <section aria-labelledby="status-h">
          <h2 id="status-h" className="mb-3 font-display text-2xl">Status</h2>
          <div className="card flex flex-wrap items-center gap-3 p-4">
            {(['active', 'suspended', 'archived'] as StoreStatus[]).map((s) => (
              <button key={s} type="button" disabled={store.status === s} onClick={() => setPendingStatus(s)} className={store.status === s ? 'btn-primary' : 'btn-outline'}>
                {s === 'active' ? 'Active' : s === 'suspended' ? 'Suspend' : 'Archive'}
              </button>
            ))}
            <p className="hint w-full">Suspended and archived stores are hidden from the public and locked for the client. Nothing is deleted.</p>
          </div>
        </section>

        <form onSubmit={save} className="space-y-10">
          <section aria-labelledby="details-h">
            <h2 id="details-h" className="mb-3 font-display text-2xl">Details</h2>
            <div className="card grid gap-5 p-5 md:grid-cols-2">
              <div>
                <label htmlFor="d-name" className="label">Brand name</label>
                <input id="d-name" required maxLength={100} className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div>
                <label htmlFor="d-slug" className="label">Store address</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-sand-500">/store/</span>
                  <input id="d-slug" required maxLength={60} className="input" value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} />
                </div>
                <p className="hint">Changing this breaks links already shared.</p>
              </div>
              <div>
                <label htmlFor="d-email" className="label">Contact email</label>
                <input id="d-email" type="email" className="input" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
              </div>
              <div>
                <label htmlFor="d-phone" className="label">Contact phone</label>
                <input id="d-phone" type="tel" className="input" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="d-address" className="label">Address</label>
                <input id="d-address" className="input" value={form.contact_address} onChange={(e) => set('contact_address', e.target.value)} />
              </div>
              {SOCIALS.map((k) => (
                <div key={k}>
                  <label htmlFor={`d-${k}`} className="label capitalize">{k}</label>
                  <input id={`d-${k}`} type="url" placeholder="https://" className="input" value={form[k]} onChange={(e) => set(k, e.target.value)} />
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="colors-h">
            <h2 id="colors-h" className="mb-3 font-display text-2xl">Brand colors</h2>
            <div className="card grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {COLOR_LABELS.map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`c-${key}`} className="label">{label}</label>
                  <div className="flex items-center gap-2">
                    <input id={`c-${key}`} type="color" className="h-10 w-12 cursor-pointer rounded border border-sand-300 bg-white p-1" value={form.colors[key]} onChange={(e) => set('colors', { ...form.colors, [key]: e.target.value })} />
                    <code className="text-sm text-sand-500">{form.colors[key]}</code>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div>
            <button type="submit" className="btn-primary" disabled={saving}>{saving && <Spinner />} Save changes</button>
          </div>
        </form>

        <section aria-labelledby="images-h">
          <h2 id="images-h" className="mb-3 font-display text-2xl">Logo and banner</h2>
          <div className="card grid gap-6 p-5 md:grid-cols-[auto_1fr]">
            <ImageSlot label="Logo" path={store.logo_path} uploading={uploading === 'logo'} onPick={(f) => pickImage('logo', f)} />
            <ImageSlot label="Banner" path={store.banner_path} uploading={uploading === 'banner'} onPick={(f) => pickImage('banner', f)} wide />
            <p className="hint md:col-span-2">JPEG, PNG, WebP, AVIF or GIF, up to 5 MB. Images are public because they appear on the storefront.</p>
          </div>
        </section>

        <section aria-labelledby="members-h">
          <h2 id="members-h" className="mb-3 font-display text-2xl">Who manages this store</h2>
          <MembersPanel storeId={store.id} />
        </section>
      </div>

      {pendingStatus && (
        <ConfirmDialog
          open
          danger={STATUS_COPY[pendingStatus].danger}
          busy={statusBusy}
          title={STATUS_COPY[pendingStatus].title}
          message={STATUS_COPY[pendingStatus].message}
          confirmLabel={STATUS_COPY[pendingStatus].label}
          onConfirm={changeStatus}
          onCancel={() => setPendingStatus(null)}
        />
      )}
    </div>
  );
}
