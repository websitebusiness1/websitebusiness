import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatDate, formatPHP } from '@/lib/format';
import { METHOD_LABELS, ORDER_STATUSES, cap, orderStatusClass, paymentStatusClass } from '@/lib/orders';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, EmptyState, PageHeader, PageLoader, Spinner } from '@/components/ui';

interface Row {
  id: string; order_number: number; order_reference: string; customer_name: string; total: number;
  status: string; payment_status: string; payment_method: string; created_at: string;
}
const PAGE = 50;
const COLUMNS = 'id, order_number, order_reference, customer_name, total, status, payment_status, payment_method, created_at';

export default function Orders() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | string>('all');
  const [payment, setPayment] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

  const fetchPage = useCallback(async (from: number) => {
    if (!storeId) return { data: [] as Row[], count: 0, error: null as unknown };
    let q = supabase.from('orders').select(COLUMNS, { count: 'exact' }).eq('store_id', storeId).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (status !== 'all') q = q.eq('status', status);
    if (payment !== 'all') q = q.eq('payment_status', payment);
    // Strip characters that have meaning inside a PostgREST filter before using the text in one.
    const needle = debounced.trim().replace(/[%*,()\\]/g, '');
    if (needle) {
      const parts = [`customer_name.ilike.%${needle}%`, `order_reference.ilike.%${needle}%`];
      if (/^#?\d{1,9}$/.test(needle)) parts.push(`order_number.eq.${needle.replace('#', '')}`);
      q = q.or(parts.join(','));
    }
    const { data, count, error: err } = await q;
    return { data: (data ?? []) as Row[], count: count ?? 0, error: err };
  }, [storeId, status, payment, debounced]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPage(0).then((r) => {
      if (cancelled) return;
      setError(r.error ? errorMessage(r.error) : null);
      setRows(r.data);
      setTotal(r.count);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchPage, tick]);

  async function loadMore() {
    setLoadingMore(true);
    const r = await fetchPage(rows.length);
    if (r.error) setError(errorMessage(r.error));
    else setRows((cur) => [...cur, ...r.data]);
    setLoadingMore(false);
  }

  const filtering = status !== 'all' || payment !== 'all' || debounced.trim() !== '';

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Orders from your storefront, newest first."
        actions={<button type="button" className="btn-outline" onClick={() => setTick((t) => t + 1)}>Refresh</button>}
      />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by order status">
        {['all', ...ORDER_STATUSES].map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${status === s ? 'border-black bg-black text-white' : 'border-sand-300 hover:border-black'}`}>
            {s === 'all' ? 'All' : cap(s)}
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-3">
        <input type="search" aria-label="Search orders" className="input max-w-xs" placeholder="Search name, reference or number" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by payment" className="input w-auto" value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option value="all">Any payment status</option>
          <option value="pending">Payment pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Payment failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {loading ? <PageLoader /> : rows.length === 0 ? (
        filtering
          ? <EmptyState title="No orders match">Try a different status, payment filter or search.</EmptyState>
          : <EmptyState title="No orders yet">When a customer checks out on your storefront, the order appears here.</EmptyState>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-sand-200 text-sand-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50">
                    <td className="px-4 py-3">
                      <Link to={`/dashboard/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">#{o.order_number}</Link>
                      <span className="block text-xs text-sand-500">{formatDate(o.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">{o.customer_name}</td>
                    <td className="px-4 py-3">{formatPHP(o.total)}</td>
                    <td className="px-4 py-3"><span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${orderStatusClass(o.status)}`}>{cap(o.status)}</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${paymentStatusClass(o.payment_status)}`}>{cap(o.payment_status)}</span>
                      <span className="block text-xs text-sand-500">{METHOD_LABELS[o.payment_method] ?? o.payment_method}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-sand-500">
            <span>Showing {rows.length} of {total}</span>
            {rows.length < total && <button type="button" className="btn-outline" disabled={loadingMore} onClick={loadMore}>{loadingMore && <Spinner />} Load more</button>}
          </div>
        </>
      )}
    </div>
  );
}
