import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, PageLoader, Spinner } from '@/components/ui';
import { config } from '@/config';

export default function Login() {
  const { user, loading, isOwner, memberships, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (from) navigate(from, { replace: true });
    else if (isOwner) navigate('/owner', { replace: true });
    else if (memberships.length > 0) navigate('/dashboard', { replace: true });
  }, [loading, user, isOwner, memberships, from, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const message = await signIn(email, password);
    setBusy(false);
    if (message) setError(message);
  }

  if (loading) return <PageLoader />;

  const signedInWithoutStore = user && !isOwner && memberships.length === 0;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-black p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="font-display text-2xl">{config.platformName}</Link>
        <p className="max-w-md font-display text-5xl leading-[1.05]">Your store, your products, your orders.</p>
        <p className="text-sm text-white/60">Accounts are created by the platform owner.</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="font-display text-2xl lg:hidden">{config.platformName}</Link>
          <h1 className="mt-8 font-display text-4xl lg:mt-0">Sign in</h1>
          {signedInWithoutStore ? (
            <div className="mt-6 space-y-4">
              <Alert kind="info">
                You’re signed in as {user.email}, but this account isn’t linked to a store yet. Ask the platform owner to add you.
              </Alert>
              <button type="button" className="btn-outline" onClick={() => signOut()}>Sign out</button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {error && <Alert>{error}</Alert>}
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label htmlFor="password" className="label">Password</label>
                <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy && <Spinner />} Sign in
              </button>
            </form>
          )}
          <p className="mt-8 text-sm text-sand-500">
            Want a store of your own? <Link to="/#contact" className="text-black underline">Get in touch</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
