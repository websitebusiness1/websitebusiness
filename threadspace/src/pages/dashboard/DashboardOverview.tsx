import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatPHP } from '@/lib/format';
import type { DashboardStats } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, PageHeader, PageLoader, Stat } from '@/components/ui';

export default function DashboardOverview() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    setStats(null);
    setError(null);
    supabase.rpc('store_dashboard_stats', { p_store_id: storeId }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(errorMessage(err));
      else setStats(data as DashboardStats);
    });
    return () => { cancelled = true; };
  }, [storeId]);

  if (!activeStore) return null;
  const store = activeStore.store;

  return (
    <div>
      <PageHeader
        title="Overview"
        description={<>Numbers for {store.name}, from recorded products and orders only.</>}
        actions={store.status === 'active' ? <a className="btn-outline" href={`/store/${store.slug}`} target="_blank" rel="noopener noreferrer">View your store</a> : undefined}
      />
      {error && <Alert>{error}</Alert>}
      {!stats && !error && <PageLoader />}
      {stats && stats.pending_orders > 0 && (
        <div className="mb-6"><Alert kind="info">You have {stats.pending_orders} pending order{stats.pending_orders === 1 ? '' : 's'}. <Link to="/dashboard/orders" className="font-medium underline underline-offset-2">Review orders</Link></Alert></div>
      )}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Total products" value={stats.total_products} />
          <Stat label="Published" value={stats.published_products} note="Visible on your store" />
          <Stat label="Drafts" value={stats.draft_products} note="Hidden from customers" />
          <Stat label="Total orders" value={stats.total_orders} />
          <Stat label="Pending orders" value={stats.pending_orders} note="Waiting for you to confirm" />
          <Stat label="Recorded sales" value={formatPHP(stats.recorded_sales)} note="All orders except cancelled" />
          <Stat label="Payment confirmed" value={formatPHP(stats.paid_sales)} note="Orders you marked as paid" />
        </div>
      )}
    </div>
  );
}
