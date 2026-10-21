import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage, formatDate } from '@/lib/format';
import type { Invitation, MemberRow } from '@/lib/types';
import { Alert, ConfirmDialog, EmptyState, PageLoader, Spinner } from './ui';

interface Props {
  /** When set, shows only this store's members. Otherwise shows every store and lets the owner pick one. */
  storeId?: string;
}

export default function MembersPanel({ storeId }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [target, setTarget] = useState(storeId ?? '');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<MemberRow | null>(null);

  const load = useCallback(async () => {
    const [m, i, s] = await Promise.all([
      supabase.rpc('owner_list_members'),
      supabase
        .from('store_invitations')
        .select('id, store_id, email, status, created_at, stores(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      storeId ? Promise.resolve(null) : supabase.from('stores').select('id, name').order('name'),
    ]);
    const firstError = m.error ?? i.error ?? s?.error;
    if (firstError) setError(errorMessage(firstError));
    setMembers((m.data ?? []) as MemberRow[]);
    setInvites((i.data ?? []) as unknown as Invitation[]);
    if (s?.data) setStores(s.data as { id: string; name: string }[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const visibleMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => !storeId || m.store_id === storeId)
      .filter((m) => !q || m.email.toLowerCase().includes(q) || m.store_name.toLowerCase().includes(q));
  }, [members, storeId, search]);

  const visibleInvites = useMemo(() => invites.filter((i) => !storeId || i.store_id === storeId), [invites, storeId]);

  async function assign(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!target) { setError('Choose a store first.'); return; }
    setBusy(true);
    const { data, error: err } = await supabase.rpc('owner_assign_member', { p_email: email, p_store_id: target });
    setBusy(false);
    if (err) { setError(errorMessage(err)); return; }
    setNotice(
      data === 'assigned'
        ? `${email.trim()} now has access to the store.`
        : `${email.trim()} doesn’t have an account yet. The invitation is saved: they get access when they sign in with that email.`,
    );
    setEmail('');
    load();
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const { error: err } = await supabase.from('store_members').delete().eq('store_id', removing.store_id).eq('user_id', removing.user_id);
    setBusy(false);
    setRemoving(null);
    if (err) setError(errorMessage(err));
    else { setNotice(`Removed ${removing.email} from ${removing.store_name}.`); load(); }
  }

  async function revoke(inv: Invitation) {
    const { error: err } = await supabase.from('store_invitations').update({ status: 'revoked' }).eq('id', inv.id);
    if (err) setError(errorMessage(err));
    else load();
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <form onSubmit={assign} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="member-email" className="label">Client email</label>
          <input id="member-email" type="email" required className="input" placeholder="client@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {!storeId && (
          <div className="min-w-[10rem]">
            <label htmlFor="member-store" className="label">Store</label>
            <select id="member-store" className="input" value={target} onChange={(e) => setTarget(e.target.value)} required>
              <option value="">Select a store</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>{busy && <Spinner />} Give access</button>
        <p className="hint w-full">
          If the email already has a confirmed account, access is granted straight away. Otherwise an invitation is saved and claimed automatically at their first sign-in. No password is ever set for them here.
        </p>
      </form>

      {!storeId && (
        <input
          type="search"
          aria-label="Search members"
          className="input max-w-sm"
          placeholder="Search by email or store"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {visibleMembers.length === 0 ? (
        <EmptyState title="No members yet">Give a client access above and they can manage this store from their own login.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-sand-200 text-sand-500">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                {!storeId && <th className="px-4 py-3 font-medium">Store</th>}
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((m) => (
                <tr key={`${m.store_id}-${m.user_id}`} className="border-b border-sand-100 last:border-0">
                  <td className="px-4 py-3">{m.email}</td>
                  {!storeId && <td className="px-4 py-3">{m.store_name}</td>}
                  <td className="px-4 py-3 text-sand-500">{formatDate(m.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="btn-quiet px-2 py-1 text-red-800" onClick={() => setRemoving(m)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visibleInvites.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-xl">Pending invitations</h3>
          <ul className="card divide-y divide-sand-100">
            {visibleInvites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {inv.email}
                  {!storeId && inv.stores?.name && <span className="text-sand-500"> for {inv.stores.name}</span>}
                  <span className="text-sand-500"> · sent {formatDate(inv.created_at)}</span>
                </span>
                <button type="button" className="btn-quiet px-2 py-1" onClick={() => revoke(inv)}>Revoke</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        danger
        busy={busy}
        title="Remove access?"
        message={removing && <>{removing.email} will no longer be able to manage {removing.store_name}. If they’re the store’s only admin, the store will have nobody managing it.</>}
        confirmLabel="Remove access"
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
