import { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { config } from '@/config';

export interface NavItem { to: string; label: string; end?: boolean }

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap px-3 py-2.5 text-sm transition-colors ${isActive ? 'font-medium text-black' : 'text-sand-500 hover:text-black'}`;

export default function Shell({ section, nav, switcher, banner }: { section: string; nav: NavItem[]; switcher?: ReactNode; banner?: ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/" className="font-display text-xl">{config.platformName}</Link>
            <span className="hidden text-sm text-sand-500 sm:inline">{section}</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {switcher}
            <span className="hidden max-w-[14rem] truncate text-sm text-sand-500 md:inline">{user?.email}</span>
            <button type="button" className="btn-quiet shrink-0" onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
        <nav aria-label={`${section} navigation`} className="flex overflow-x-auto border-t border-sand-200 px-2 lg:hidden">
          {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>{n.label}</NavLink>)}
        </nav>
      </header>
      <div className="lg:flex">
        <aside className="hidden min-h-[calc(100vh-57px)] w-56 shrink-0 border-r border-sand-200 bg-white lg:block">
          <nav aria-label={`${section} navigation`} className="flex flex-col p-3">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded px-3 py-2 text-sm transition-colors ${isActive ? 'bg-sand-100 font-medium text-black' : 'text-sand-500 hover:bg-sand-50 hover:text-black'}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-5xl">
            {banner && <div className="mb-6">{banner}</div>}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
