import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatDate, formatPHP } from '@/lib/format';
import type { OrderConfirmationData } from '@/lib/types';
import StoreFrame from '@/components/store/StoreFrame';
import { Alert, PageLoader } from '@/components/ui';
import { config } from '@/config';

const METHOD_LABELS: Record<string, string> = { cod: 'Cash on delivery', bank_transfer: 'Bank transfer', gcash: 'GCash' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function OrderConfirmation() {
  const { orderReference } = useParams();
  const [order, setOrder] = useState<OrderConfirmationData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_order_confirmation', { p_order_reference: orderReference ?? '' }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(errorMessage(err));
      setOrder((data ?? null) as OrderConfirmationData | null);
    });
    return () => { cancelled = true; };
  }, [orderReference]);

  if (order === undefined) return <PageLoader />;

  if (!order) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="font-display text-4xl">Order not found</h1>
        <p className="mt-3 text-sm text-sand-500">Check the order reference and try again.</p>
        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
        <Link to="/" className="btn-outline mt-6 self-start">Back to {config.platformName}</Link>
      </div>
    );
  }

  const manual = order.payment_method !== 'cod';
  const contact = [order.store.contact_email, order.store.contact_phone].filter(Boolean).join(' · ');

  return (
    <StoreFrame slug={order.store.slug}>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <p className="s-muted text-sm">Thank you. Your order has been placed.</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Order {order.order_reference}</h1>
        <p className="s-muted mt-2 text-sm">Keep this reference. You’ll need it if you contact {order.store.name} about your order. Placed {formatDate(order.created_at)}.</p>

        <div className="s-soft mt-8 space-y-3 px-5 py-4 text-sm">
          <p><span className="font-medium">Order status:</span> {cap(order.status)}</p>
          <p><span className="font-medium">Payment:</span> {METHOD_LABELS[order.payment_method] ?? order.payment_method} · {cap(order.payment_status)}</p>
          {order.payment_status === 'pending' && (
            manual
              ? <p>Please send your payment of <strong>{formatPHP(order.total)}</strong>. It stays <strong>pending</strong> until {order.store.name} confirms it has received it.</p>
              : <p>Please prepare <strong>{formatPHP(order.total)}</strong> to pay in cash on delivery.</p>
          )}
          {manual && order.payment_instructions && <p className="whitespace-pre-line border-t s-border pt-3">{order.payment_instructions}</p>}
        </div>

        <h2 className="mt-10 font-display text-2xl">Items</h2>
        <ul className="mt-3 divide-y s-border border-y s-border text-sm">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3 py-3">
              <span>{i.quantity} × {i.product_name}{i.variant_label && <span className="s-muted block">{i.variant_label}</span>}</span>
              <span>{formatPHP(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPHP(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shipping_fee === 0 ? 'Free' : formatPHP(order.shipping_fee)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatPHP(order.discount)}</dd></div>}
          <div className="flex justify-between border-t s-border pt-3 text-base font-medium"><dt>Total</dt><dd>{formatPHP(order.total)}</dd></div>
        </dl>

        {contact && <p className="s-muted mt-8 text-sm">Questions? Contact {order.store.name}: {contact}</p>}
        <Link to={`/store/${order.store.slug}`} className="s-btn mt-8">Continue shopping</Link>
      </div>
    </StoreFrame>
  );
}
