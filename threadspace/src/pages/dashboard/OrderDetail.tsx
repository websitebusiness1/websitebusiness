import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatPHP } from '@/lib/format';
import { METHOD_LABELS, ORDER_STATUSES, PAYMENT_STATUSES, cap, orderStatusClass, paymentStatusClass } from '@/lib/orders';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, ConfirmDialog, EmptyState, PageHeader, PageLoader, Spinner } from '@/components/ui';

interface Order {
  id: string; store_id: string; order_number: number; order_reference: string;
  customer_name: string; customer_email: string; customer_phone: string; delivery_address: string; notes: string | null;
  subtotal: number; shipping_fee: number; discount: number; total: number;
  status: string; payment_status: string; payment_method: string; created_at: string; updated_at: string;
}
interface Item { id: string; product_name: string; variant_label: string | null; unit_price: number; quantity: number; line_total: number }

type Pending = { kind: 'status' | 'payment'; value: string } | null;

const dt = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

export default function OrderDetail() {
  const { id } = useParams();
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [nextPayment, setNextPayment] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    const [o, i] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id ?? '').eq('store_id', storeId).maybeSingle(),
      supabase.from('order_items').select('id, product_name, variant_label, unit_price, quantity, line_total').eq('order_id', id ?? '').eq('store_id', storeId).order('created_at'),
    ]);
    const err = o.error ?? i.error;
    if (err) setError(errorMessage(err));
    const ord = (o.data ?? null) as Order | null;
    setOrder(ord);
    setItems((i.data ?? []) as Item[]);
    setNextStatus(ord?.status ?? '');
    setNextPayment(ord?.payment_status ?? '');
    setLoading(false);
  }, [id, storeId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (loading) return <PageLoader />;
  if (!order) {
    return <EmptyState title="Order not found" action={<Link to="/dashboard/orders" className="btn-outline">Back to orders</Link>}>It may belong to a different store.</EmptyState>;
  }

  const cancelled = order.status === 'cancelled';

  async function apply(p: NonNullable<Pending>) {
    if (!order) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const column = p.kind === 'status' ? 'status' : 'payment_status';
    // Only applies if the order is still in the state this screen showed, so two people can't silently overwrite each other.
    const { data, error: err } = await supabase.from('orders').update({ [column]: p.value }).eq('id', order.id).eq(column, order[column]).select('id');
    setBusy(false);
    setPending(null);
    if (err) { setError(errorMessage(err)); await load(); return; }
    if (!data || data.length === 0) { setError('This order was changed by someone else while you were looking at it. It has been reloaded.'); await load(); return; }
    setNotice(p.kind === 'status' ? `Order marked ${p.value}.` : `Payment marked ${p.value}.`);
    await load();
  }

  function requestStatus() {
    if (nextStatus === order!.status) return;
    if (nextStatus === 'cancelled') setPending({ kind: 'status', value: nextStatus });
    else apply({ kind: 'status', value: nextStatus });
  }
  function requestPayment() {
    if (nextPayment === order!.payment_status) return;
    if (nextPayment === 'paid' || nextPayment === 'refunded') setPending({ kind: 'payment', value: nextPayment });
    else apply({ kind: 'payment', value: nextPayment });
  }

  const confirmCopy = pending?.kind === 'status'
    ? { title: 'Cancel this order?', message: 'The stock for these items goes back on sale and the order can’t be reopened. Tell the customer if they’re expecting it.', label: 'Cancel order', danger: true }
    : pending?.value === 'refunded'
      ? { title: 'Mark as refunded?', message: 'Only do this once you have actually returned the customer’s money.', label: 'Mark refunded', danger: false }
      : { title: 'Mark payment as received?', message: <>Only do this after you’ve checked that <strong>{formatPHP(order.total)}</strong> has really arrived (in your bank, GCash or cash on hand). A customer saying they paid, or sending a screenshot, isn’t proof.</>, label: 'Yes, payment received', danger: false };

  return (
    <div>
      <Link to="/dashboard/orders" className="text-sm text-sand-500 hover:text-black">← All orders</Link>
      <div className="mt-3">
        <PageHeader
          title={`Order #${order.order_number}`}
          description={<>{order.order_reference} · placed {dt.format(new Date(order.created_at))}</>}
          actions={<>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${orderStatusClass(order.status)}`}>{cap(order.status)}</span>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${paymentStatusClass(order.payment_status)}`}>Payment {order.payment_status}</span>
          </>}
        />
      </div>
      <div className="mb-6 space-y-3 empty:hidden">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {readOnly && <Alert kind="info">This store is not active, so orders can’t be changed right now.</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="items-h">
            <h2 id="items-h" className="mb-3 font-display text-2xl">Items</h2>
            <ul className="divide-y divide-sand-100 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-3">
                  <span>{i.quantity} × {i.product_name}{i.variant_label && <span className="block text-sand-500">{i.variant_label} · {formatPHP(i.unit_price)} each</span>}</span>
                  <span className="shrink-0">{formatPHP(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-sand-200 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-sand-500">Subtotal</dt><dd>{formatPHP(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-sand-500">Shipping</dt><dd>{order.shipping_fee === 0 ? 'Free' : formatPHP(order.shipping_fee)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between"><dt className="text-sand-500">Discount</dt><dd>−{formatPHP(order.discount)}</dd></div>}
              <div className="flex justify-between pt-1 text-base font-medium"><dt>Total</dt><dd>{formatPHP(order.total)}</dd></div>
            </dl>
          </section>

          <section className="card p-5" aria-labelledby="cust-h">
            <h2 id="cust-h" className="mb-3 font-display text-2xl">Customer and delivery</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-sand-500">Name</dt><dd className="mt-0.5">{order.customer_name}</dd></div>
              <div><dt className="text-sand-500">Mobile</dt><dd className="mt-0.5"><a className="underline underline-offset-2" href={`tel:${order.customer_phone.replace(/\s+/g, '')}`}>{order.customer_phone}</a></dd></div>
              <div><dt className="text-sand-500">Email</dt><dd className="mt-0.5 break-all"><a className="underline underline-offset-2" href={`mailto:${order.customer_email}`}>{order.customer_email}</a></dd></div>
              <div><dt className="text-sand-500">Payment method</dt><dd className="mt-0.5">{METHOD_LABELS[order.payment_method] ?? order.payment_method}</dd></div>
              <div className="sm:col-span-2"><dt className="text-sand-500">Delivery address</dt><dd className="mt-0.5 whitespace-pre-line">{order.delivery_address}</dd></div>
              {order.notes && <div className="sm:col-span-2"><dt className="text-sand-500">Customer notes</dt><dd className="mt-0.5 whitespace-pre-line">{order.notes}</dd></div>}
            </dl>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="ful-h">
            <h2 id="ful-h" className="mb-3 font-display text-2xl">Fulfillment</h2>
            {cancelled ? (
              <p className="text-sm text-sand-500">This order was cancelled. Its stock went back on sale, and cancelled orders can’t be reopened.</p>
            ) : (
              <>
                <label htmlFor="o-status" className="label">Order status</label>
                <select id="o-status" className="input" value={nextStatus} disabled={readOnly || busy} onChange={(e) => setNextStatus(e.target.value)}>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                </select>
                <button type="button" className="btn-primary mt-3 w-full" disabled={readOnly || busy || nextStatus === order.status} onClick={requestStatus}>
                  {busy && pending === null && <Spinner />} Update status
                </button>
              </>
            )}
          </section>

          <section className="card p-5" aria-labelledby="pay-h">
            <h2 id="pay-h" className="mb-1 font-display text-2xl">Payment</h2>
            <p className="mb-3 text-sm text-sand-500">
              {order.payment_status === 'pending'
                ? order.payment_method === 'cod' ? 'Cash is collected on delivery. Mark it paid once you have the money.' : 'Waiting for you to confirm the money has arrived.'
                : `Marked ${order.payment_status}.`}
            </p>
            <label htmlFor="o-pay" className="label">Payment status</label>
            <select id="o-pay" className="input" value={nextPayment} disabled={readOnly || busy} onChange={(e) => setNextPayment(e.target.value)}>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </select>
            <button type="button" className="btn-primary mt-3 w-full" disabled={readOnly || busy || nextPayment === order.payment_status} onClick={requestPayment}>Update payment</button>
          </section>

          {!cancelled && !readOnly && (
            <button type="button" className="btn-danger w-full" disabled={busy} onClick={() => setPending({ kind: 'status', value: 'cancelled' })}>Cancel order</button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        danger={confirmCopy.danger}
        busy={busy}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.label}
        onConfirm={() => pending && apply(pending)}
        onCancel={() => { setPending(null); setNextStatus(order.status); setNextPayment(order.payment_status); }}
      />
    </div>
  );
}
