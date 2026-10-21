import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Membership, Store } from '@/lib/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** UI hint only. Real authorization is enforced by the database (RLS + server functions). */
  isOwner: boolean;
  memberships: Membership[];
  activeStore: Membership | null;
  setActiveStoreId: (id: string) => void;
  refresh: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const ACTIVE_KEY = 'activeStoreId';

function readActive(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(readActive);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setIsOwner(false);
      setMemberships([]);
      setProfileFor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // Turns any owner-created invitation for this confirmed email into a membership.
      await supabase.rpc('claim_my_invitations');
      const [owner, members] = await Promise.all([
        supabase.from('platform_owners').select('user_id').eq('user_id', userId).maybeSingle(),
        supabase.from('store_members').select('store_id, role, stores(*)').eq('user_id', userId),
      ]);
      if (cancelled) return;
      setIsOwner(Boolean(owner.data));
      const rows = (members.data ?? []) as unknown as { store_id: string; role: string; stores: Store | null }[];
      setMemberships(
        rows.filter((r) => r.stores).map((r) => ({ store_id: r.store_id, role: r.role, store: r.stores as Store })),
      );
      setProfileFor(userId);
    })();
    return () => { cancelled = true; };
  }, [userId, tick]);

  const setActiveStoreId = useCallback((id: string) => {
    setActiveId(id);
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* storage unavailable */ }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return null;
    return error.status === 400 ? 'Incorrect email or password.' : error.message;
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    user: session?.user ?? null,
    loading: !sessionReady || (userId !== null && profileFor !== userId),
    isOwner,
    memberships,
    activeStore: memberships.find((m) => m.store_id === activeId) ?? memberships[0] ?? null,
    setActiveStoreId,
    refresh: () => setTick((t) => t + 1),
    signIn,
    signOut,
  }), [session, sessionReady, userId, profileFor, isOwner, memberships, activeId, setActiveStoreId, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
