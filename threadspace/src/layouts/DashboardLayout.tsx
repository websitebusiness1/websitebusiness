import Shell from '@/components/Shell';
import { Alert } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';

export default function DashboardLayout() {
  const { memberships, activeStore, setActiveStoreId } = useAuth();
  const store = activeStore?.store;
  return (
    <Shell
      section={store?.name ?? 'Dashboard'}
      nav={[
        { to: '/dashboard', label: 'Overview', end: true },
        { to: '/dashboard/products', label: 'Products' },
        { to: '/dashboard/orders', label: 'Orders' },
        { to: '/dashboard/inventory', label: 'Inventory' },
        { to: '/dashboard/store-settings', label: 'Store settings' },
      ]}
      switcher={
        memberships.length > 1 ? (
          <select
            aria-label="Switch store"
            className="input w-auto max-w-[10rem] py-1.5"
            value={activeStore?.store_id}
            onChange={(e) => setActiveStoreId(e.target.value)}
          >
            {memberships.map((m) => <option key={m.store_id} value={m.store_id}>{m.store.name}</option>)}
          </select>
        ) : null
      }
      banner={
        store && store.status !== 'active' ? (
          <Alert kind="error">
            This store is {store.status}. Its public page is hidden and changes are disabled. Contact the platform owner to reactivate it.
          </Alert>
        ) : null
      }
    />
  );
}
