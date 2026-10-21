import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatDate } from '@/lib/format';
import type { MemberRow, Store } from '@/lib/types';
import { Alert, EmptyState, PageHeader, PageLoader, StatusBadge } from '@/components/ui';

export default function OwnerStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | Store['status']>('all');

  useEffect(() => {
    (async () => {
      const [s, m] = await Promise.all([
        supabase.from('stores').select('*').order('created_at', { ascending: false }),
        supabase.rpc('owner_list_members'),
      ]);
      const err = s.error ?? m.error;
      if (err) setError(errorMessage(err));
      setStores((s.data ?? []) as Store[]);
      setMembers((m.data ?? []) as MemberRow[]);
      setLoading(false);
    })();
  }, []);

  const adminsByStore = useMemo(() => {
    const map = new Map<string, string[]>();
    members.forEach((m) => map.set(m.store_id, [...(map.get(m.store_id) ?? []), m.email]));
    return map;
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.slug.includes(q) || (adminsByStore.get(s.id) ?? []).some((e) => e.toLowerCase().includes(q));
    });
  }, [stores, search, status, adminsByStore]);

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Stores" description="Every client store on the platform." actions={<Link to="/owner/stores/new" className="btn-primary">New store</Link>} />
      {error && <div className="mb-6"><Alert>{error}</Alert></div>}

      <div className="mb-4 flex flex-wrap gap-3">
        <input type="search" aria-label="Search stores" className="input max-w-sm" placeholder="Search by name, address or admin email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by status" className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {stores.length === 0 ? (
        <EmptyState title="No stores yet" action={<Link to="/owner/stores/new" className="btn-primary">Create the first store</Link>} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No stores match">Try a different search or status.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-sand-200 text-sand-500">
              <tr>
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const admins = adminsByStore.get(s.id) ?? [];
                return (
                  <tr key={s.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50">
                    <td className="px-4 py-3">
                      <Link to={`/owner/stores/${s.id}`} className="font-medium underline-offset-4 hover:underline">{s.name}</Link>
                      <span className="block text-xs text-sand-500">/store/{s.slug}</span>
                    </td>
                    <td className="px-4 py-3 text-sand-700">{admins.length ? admins.join(', ') : <span className="text-sand-500">No admin yet</span>}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-sand-500">{formatDate(s.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
