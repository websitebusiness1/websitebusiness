import { Link } from 'react-router-dom';
import { useCart } from '@/lib/cart';
import { useCartSync } from '@/lib/useCartSync';
import { formatPHP } from '@/lib/format';
import { publicImageUrl } from '@/lib/storage';
import StoreFrame, { useStoreCtx } from '@/components/store/StoreFrame';
import { Alert, PageLoader } from '@/components/ui';
import { config } from '@/config';

function CartContent() {
  const { store } = useStoreCtx();
  const cart = useCart();
  const { syncing, notes } = useCartSync();

  if (syncing && cart.items.length > 0) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-4xl sm:text-5xl">Your cart</h1>

      {notes.length > 0 && <div className="mt-6 space-y-2">{notes.map((n) => <Alert key={n} kind="info">{n}</Alert>)}</div>}

      {cart.items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-display text-2xl">Your cart is empty</p>
          <Link to={`/store/${store.slug}`} className="s-btn mt-6">Continue shopping</Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y s-border border-y s-border">
            {cart.items.map((i) => {
              const img = publicImageUrl(i.image);
              return (
                <li key={i.variantId} className="flex gap-4 py-5">
                  <Link to={`/store/${store.slug}/product/${i.productSlug}`} className="s-soft block h-28 w-24 shrink-0 overflow-hidden">
                    {img && <img src={img} alt={i.name} className="h-full w-full object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/store/${store.slug}/product/${i.productSlug}`} className="font-medium hover:underline">{i.name}</Link>
                        <p className="s-muted text-sm">{i.optionLabel}</p>
                      </div>
                      <p className="shrink-0 text-sm font-medium">{formatPHP(i.price * i.quantity)}</p>
                    </div>
                    <p className="s-muted text-sm">{formatPHP(i.price)} each</p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center border s-border" role="group" aria-label={`Quantity for ${i.name}`}>
                        <button type="button" className="px-3 py-1.5 disabled:opacity-40" disabled={i.quantity <= 1} onClick={() => cart.setQuantity(i.variantId, i.quantity - 1)} aria-label="Decrease quantity">−</button>
                        <span className="min-w-[2rem] text-center text-sm" aria-live="polite">{i.quantity}</span>
                        <button type="button" className="px-3 py-1.5 disabled:opacity-40" disabled={i.quantity >= i.stock} onClick={() => cart.setQuantity(i.variantId, i.quantity + 1)} aria-label="Increase quantity">+</button>
                      </div>
                      <button type="button" className="text-sm underline underline-offset-4" onClick={() => cart.remove(i.variantId)} aria-label={`Remove ${i.name} from cart`}>Remove</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between text-lg">
            <span>Subtotal</span>
            <span className="font-medium">{formatPHP(cart.subtotal)}</span>
          </div>
          <p className="s-muted mt-1 text-sm">Shipping is added at checkout.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/checkout" className="s-btn flex-1 sm:flex-none sm:px-12">Checkout</Link>
            <Link to={`/store/${store.slug}`} className="s-btn s-btn-outline">Continue shopping</Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function CartPage() {
  const cart = useCart();
  if (!cart.storeSlug || cart.items.length === 0) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="font-display text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-sm text-sand-500">Add something from a store and it will show up here.</p>
        <Link to={cart.storeSlug ? `/store/${cart.storeSlug}` : '/'} className="btn-outline mt-6 self-start">{cart.storeSlug ? 'Back to the store' : `Back to ${config.platformName}`}</Link>
      </div>
    );
  }
  return <StoreFrame slug={cart.storeSlug}><CartContent /></StoreFrame>;
}
