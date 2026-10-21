import { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { PageLoader } from '@/components/ui';

// These guards only decide what to *show*. Every query is still checked by RLS in the database.

function Blocked({ title, children }: { title: string; children: ReactNode }) {
  const { signOut } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-3 text-sm text-sand-500">{children}</p>
      <div className="mt-6 flex gap-2">
        <Link to="/" className="btn-outline">Back to home</Link>
        <button type="button" className="btn-quiet" onClick={() => signOut()}>Sign out</button>
      </div>
    </div>
  );
}

export function RequireOwner({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <PageLoader />;
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!auth.isOwner) return <Blocked title="Owner area">This area is only for the platform owner.</Blocked>;
  return <>{children}</>;
}

export function RequireMember({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <PageLoader />;
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (auth.memberships.length === 0) {
    return (
      <Blocked title="No store assigned">
        This account isn’t linked to a store yet. Ask the platform owner to add you to your store.
        {auth.isOwner && <> You’re signed in as the owner, so you can manage stores from the <Link className="underline" to="/owner">owner area</Link>.</>}
      </Blocked>
    );
  }
  return <>{children}</>;
}
