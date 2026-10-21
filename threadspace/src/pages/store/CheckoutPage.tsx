import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/lib/cart';
import { useCartSync } from '@/lib/useCartSync';
import { errorMessage, formatPHP } from '@/lib/format';
import StoreFrame, { useStoreCtx } from '@/components/store/StoreFrame';
import { Alert, PageLoader, Spinner } from '@/components/ui';
import { config } from '@/config';

const METHOD_LABELS: Record<string, string> = { cod: 'Cash on delivery', bank_transfer: 'Bank transfer', gcash: 'GCash' };

function CheckoutContent() {
  const { store, settings } = useStoreCtx();
  const cart = useCart();
  const navigate = useNavigate();
  const [resync, setResync] = useState(0);
  const { syncing, notes } = useCartSync(resync);

  const methods = settings?.payment_methods?.length ? settings.payment_methods : ['cod'];
  const [method, setMethod] = useState(methods[0]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fee = settings?.shipping_fee ?? 0;
  const threshold = settings?.free_shipping_threshold;
  const shipping = threshold != null && cart.subtotal >= threshold ? 0 : fee;
  const total = cart.subtotal + shipping;
  const manual = method !== 'cod';
  const instructions = settings?.payment_instructions?.[method];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || syncing || cart.items.length === 0) return;
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.rpc('place_order', {
      p_store_slug: store.slug,
      p_customer_name: name,
      p_customer_email: email,
      p_customer_phone: phone,
      p_delivery_address: address,
      p_notes: orderNotes.trim() || null,
      p_payment_method: method,
      p_items: cart.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      setResync((n) => n + 1); // stock or availability may have changed: refresh the cart so it matches reality
      return;
    }
    navigate(`/order-confirmation/${encodeURIComponent(data as string)}`, { replace: true });
    cart.clear();
  }

  if (syncing && cart.items.length > 0) return <PageLoader />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-4xl sm:text-5xl">Checkout</h1>
      <div className="mt-6 space-y-2">{notes.map((n) => <Alert key={n} kind="info">{n}</Alert>)}</div>

      {cart.items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-display text-2xl">Your cart is empty</p>
          <Link to={`/store/${store.slug}`} className="s-btn mt-6">Continue shopping</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 grid gap-10 md:grid-cols-[1fr_22rem]">
          <div className="space-y-8">
            {error && <Alert>{error}</Alert>}

            <fieldset className="space-y-4">
              <legend className="mb-1 font-display text-2xl">Your details</legend>
              <div>
                <label htmlFor="co-name" className="mb-1.5 block text-sm font-medium">Full name</label>
                <input id="co-name" required autoComplete="name" maxLength={120} className="s-input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="co-email" className="mb-1.5 block text-sm font-medium">Email</label>
                  <input id="co-email" type="email" required autoComplete="email" className="s-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="co-phone" className="mb-1.5 block text-sm font-medium">Mobile number</label>
                  <input id="co-phone" type="tel" required autoComplete="tel" inputMode="tel" maxLength={25} placeholder="09XX XXX XXXX" className="s-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <label htmlFor="co-address" className="mb-1.5 block text-sm font-medium">Delivery address</label>
                <textarea id="co-address" required rows={3} autoComplete="street-address" maxLength={500} placeholder="House no., street, barangay, city, province, postal code" className="s-input" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <label htmlFor="co-notes" className="mb-1.5 block text-sm font-medium">Order notes (optional)</label>
                <textarea id="co-notes" rows={2} maxLength={1000} className="s-input" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 font-display text-2xl">Payment</legend>
              <div className="space-y-2">
                {methods.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-3 border s-border px-4 py-3 text-sm">
                    <input type="radio" name="payment" style={{ accentColor: 'var(--b-text)' }} checked={method === m} onChange={() => setMethod(m)} />
                    {METHOD_LABELS[m] ?? m}
                  </label>
                ))}
              </div>
              <div className="s-soft mt-3 px-4 py-3 text-sm">
                {manual ? (
                  <>
                    <p>Place your order first, then send your payment. Your payment shows as <strong>pending</strong> until the store confirms it has received it.</p>
                    {instructions && <p className="mt-2 whitespace-pre-line">{instructions}</p>}
                  </>
                ) : (
                  <p>Pay in cash when your order is delivered.</p>
                )}
              </div>
            </fieldset>
          </div>

          <aside className="md:sticky md:top-6 md:self-start">
            <h2 className="mb-4 font-display text-2xl">Order summary</h2>
            <ul className="space-y-3 border-y s-border py-4 text-sm">
              {cart.items.map((i) => (
                <li key={i.variantId} className="flex justify-between gap-3">
                  <span>{i.quantity} × {i.name}<span className="s-muted block">{i.optionLabel}</span></span>
                  <span>{formatPHP(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPHP(cart.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd>{shipping === 0 ? 'Free' : formatPHP(shipping)}</dd></div>
              <div className="flex justify-between border-t s-border pt-3 text-base font-medium"><dt>Total</dt><dd>{formatPHP(total)}</dd></div>
            </dl>
            <p className="s-muted mt-2 text-xs">Prices and stock are confirmed when you place the order.</p>
            <button type="submit" className="s-btn mt-6 w-full" disabled={busy || syncing}>
              {busy && <Spinner />} Place order
            </button>
            <Link to="/cart" className="mt-3 block text-center text-sm underline underline-offset-4">Back to cart</Link>
          </aside>
        </form>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const cart = useCart();
  if (!cart.storeSlug || cart.items.length === 0) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="font-display text-4xl">Nothing to check out</h1>
        <p className="mt-3 text-sm text-sand-500">Your cart is empty.</p>
        <Link to={cart.storeSlug ? `/store/${cart.storeSlug}` : '/'} className="btn-outline mt-6 self-start">{cart.storeSlug ? 'Back to the store' : `Back to ${config.platformName}`}</Link>
      </div>
    );
  }
  return <StoreFrame slug={cart.storeSlug}><CheckoutContent /></StoreFrame>;
}
