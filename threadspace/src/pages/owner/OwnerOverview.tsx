import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatDate, formatPHP } from '@/lib/format';
import type { Store } from '@/lib/types';
import { Alert, EmptyState, PageHeader, PageLoader, Stat, StatusBadge } from '@/components/ui';

interface RecentOrder {
  id: string;
  order_number: number;
  order_reference: string;
  total: number;
  status: string;
  created_at: string;
  stores: { name: string } | null;
}

export default function OwnerOverview() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState(0);
  const [orders, setOrders] = useState(0);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, p, o, r] = await Promise.all([
        supabase.from('stores').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id, order_number, order_reference, total, status, created_at, stores(name)').order('created_at', { ascending: false }).limit(6),
      ]);
      const err = s.error ?? p.error ?? o.error ?? r.error;
      if (err) setError(errorMessage(err));
      setStores((s.data ?? []) as Store[]);
      setProducts(p.count ?? 0);
      setOrders(o.count ?? 0);
      setRecent((r.data ?? []) as unknown as RecentOrder[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <PageLoader />;
  const count = (status: Store['status']) => stores.filter((s) => s.status === status).length;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Everything across your platform."
        actions={<Link to="/owner/stores/new" className="btn-primary">New store</Link>}
      />
      {error && <div className="mb-6"><Alert>{error}</Alert></div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="Stores" value={stores.length} />
        <Stat label="Active" value={count('active')} />
        <Stat label="Suspended" value={count('suspended')} />
        <Stat label="Products" value={products} />
        <Stat label="Orders" value={orders} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-2xl">Newest stores</h2>
          {stores.length === 0 ? (
            <EmptyState title="No stores yet" action={<Link to="/owner/stores/new" className="btn-primary">Create the first store</Link>} />
          ) : (
            <ul className="card divide-y divide-sand-100">
              {stores.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <Link to={`/owner/stores/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-sand-50">
                    <span>
                      <span className="font-medium">{s.name}</span>
                      <span className="block text-xs text-sand-500">Created {formatDate(s.created_at)}</span>
                    </span>
                    <StatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl">Latest orders</h2>
          {recent.length === 0 ? (
            <EmptyState title="No orders yet">Orders from any store will show up here.</EmptyState>
          ) : (
            <ul className="card divide-y divide-sand-100">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{o.stores?.name ?? 'Store'} · #{o.order_number}</span>
                    <span className="block text-xs text-sand-500">{formatDate(o.created_at)} · {o.status}</span>
                  </span>
                  <span>{formatPHP(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
