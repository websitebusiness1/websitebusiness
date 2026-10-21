import { createContext, CSSProperties, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { publicImageUrl } from '@/lib/storage';
import { buildTheme, safeUrl } from '@/lib/theme';
import { useCart } from '@/lib/cart';
import { config } from '@/config';
import type { Store, StoreSettings } from '@/lib/types';
import { PageLoader } from '@/components/ui';

interface StoreCtx { store: Store; settings: StoreSettings | null }
const Ctx = createContext<StoreCtx | null>(null);

export function useStoreCtx(): StoreCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStoreCtx must be used inside StoreFrame');
  return c;
}

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; store: Store; settings: StoreSettings | null };

export default function StoreFrame({ slug, children }: { slug: string | null | undefined; children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const cart = useCart();

  useEffect(() => {
    if (!slug) { setState({ status: 'missing' }); return; }
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      // Suspended and archived stores are invisible to the public, so they look like they don't exist.
      const { data: store } = await supabase.from('stores').select('*').eq('slug', slug).eq('status', 'active').maybeSingle();
      if (cancelled) return;
      if (!store) { setState({ status: 'missing' }); return; }
      const { data: settings } = await supabase.from('store_settings').select('*').eq('store_id', (store as Store).id).maybeSingle();
      if (cancelled) return;
      setState({ status: 'ready', store: store as Store, settings: (settings ?? null) as StoreSettings | null });
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const store = state.status === 'ready' ? state.store : null;
  const theme = useMemo(() => buildTheme(store?.brand_colors), [store]);

  useEffect(() => {
    if (!store) return;
    const previous = document.title;
    document.title = store.name;
    return () => { document.title = previous; };
  }, [store]);

  if (state.status === 'loading') return <PageLoader />;
  if (state.status === 'missing') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="font-display text-4xl">Store not available</h1>
        <p className="mt-3 text-sm text-sand-500">This store doesn’t exist, or it isn’t open right now.</p>
        <Link to="/" className="btn-outline mt-6 self-start">Back to {config.platformName}</Link>
      </div>
    );
  }

  const { settings } = state;
  const logo = publicImageUrl(state.store.logo_path);
  const cartCount = cart.storeSlug === state.store.slug ? cart.count : 0;
  const socials = Object.entries(state.store.social_links ?? {})
    .map(([k, v]) => [k, safeUrl(v)] as const)
    .filter((x): x is readonly [string, string] => Boolean(x[1]));
  const s = state.store;

  return (
    <Ctx.Provider value={{ store: s, settings }}>
      <div className="store-root flex flex-col" style={theme as CSSProperties}>
        {settings?.announcement && (
          <p className="px-4 py-2 text-center text-xs font-medium" style={{ background: 'var(--b-primary)', color: 'var(--b-on-primary)' }}>
            {settings.announcement}
          </p>
        )}
        <header className="border-b s-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <Link to={`/store/${s.slug}`} className="flex min-w-0 items-center gap-3">
              {logo ? <img src={logo} alt={s.name} className="h-9 w-auto max-w-[10rem] object-contain" /> : <span className="truncate font-display text-2xl">{s.name}</span>}
            </Link>
            <Link to="/cart" className="relative inline-flex items-center gap-2 px-2 py-2 text-sm font-medium" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
              Cart
              <span className="inline-flex min-w-[1.4rem] justify-center rounded-full px-1.5 text-xs" style={{ background: cartCount ? 'var(--b-text)' : 'var(--b-soft)', color: cartCount ? 'var(--b-bg)' : 'var(--b-muted)' }}>{cartCount}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-16 border-t s-border">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-2">
            <div>
              <p className="font-display text-xl">{s.name}</p>
              {(s.contact_email || s.contact_phone || s.contact_address) && (
                <ul className="s-muted mt-3 space-y-1">
                  {s.contact_email && <li><a className="underline underline-offset-2" href={`mailto:${s.contact_email}`}>{s.contact_email}</a></li>}
                  {s.contact_phone && <li><a className="underline underline-offset-2" href={`tel:${s.contact_phone.replace(/\s+/g, '')}`}>{s.contact_phone}</a></li>}
                  {s.contact_address && <li>{s.contact_address}</li>}
                </ul>
              )}
            </div>
            {socials.length > 0 && (
              <div className="sm:text-right">
                <p className="s-muted mb-2">Follow us</p>
                <ul className="flex flex-wrap gap-x-5 gap-y-1 sm:justify-end">
                  {socials.map(([k, url]) => (
                    <li key={k}><a href={url} target="_blank" rel="noopener noreferrer" className="capitalize underline underline-offset-2">{k}</a></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </footer>
      </div>
    </Ctx.Provider>
  );
}
