import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from 'react-router';
import { MotionConfig, motion } from 'motion/react';
import Lenis from 'lenis';
import { EASE, ScrollProgress, useSpotlight } from './motion';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bell,
  CalendarCheck,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Wrench,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useRealtimeConnection } from '../lib/socket';
import { NOTIFICATION_ICON, NotificationsProvider, useNotifications } from '../lib/notifications';
import { Avatar, PageLoader } from './ui';
import type { Role } from '../lib/types';

/** Shared by every page: realtime connection + notifications. */
export function Root() {
  useRealtimeConnection();
  useSpotlight();
  return (
    <MotionConfig reducedMotion="user">
      <NotificationsProvider>
        <ScrollRestoration />
        <Outlet />
      </NotificationsProvider>
    </MotionConfig>
  );
}

/** Each route fades and rises in. */
function PageTransition() {
  const { pathname } = useLocation();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <Outlet />
    </motion.div>
  );
}

/** Buttery smooth scrolling on the marketing pages (skipped when reduced motion is on). */
function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.12 });
    return () => lenis.destroy();
  }, []);
}

export function Logo({ dark, to = '/' }: { dark?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-[var(--shadow-glow)]">
        <Wrench className="h-[18px] w-[18px]" />
      </span>
      <span
        className={clsx(
          'text-lg font-extrabold tracking-tight',
          dark ? 'text-white' : 'text-slate-900',
        )}
      >
        Tech<span className="text-brand-500">Finder</span>
      </span>
    </Link>
  );
}

export const homeFor = (role: Role) => (role === 'admin' ? '/admin' : '/dashboard');

/* ------------------------------------------------------------------ */
/* Public (marketing) layout                                           */
/* ------------------------------------------------------------------ */

export function PublicLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dark = pathname === '/';
  useSmoothScroll();

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className={clsx(
          'sticky top-0 z-[500] border-b backdrop-blur-xl',
          dark ? 'border-white/10 bg-ink-950/95' : 'border-slate-200/70 bg-white/80',
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo dark={dark} />
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink
              to="/search"
              className={({ isActive }) =>
                clsx(
                  'rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                  dark
                    ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                    : isActive
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              Find technicians
            </NavLink>
            {!user && (
              <Link
                to="/register?role=technician"
                className={clsx(
                  'rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                  dark
                    ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                For technicians
              </Link>
            )}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link
                  to={homeFor(user.role)}
                  className={clsx(
                    'btn-ghost',
                    dark && 'text-slate-200 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
                <Link
                  to="/account"
                  className={clsx(
                    'flex items-center gap-2 rounded-xl py-1 pl-1 pr-3 transition',
                    dark ? 'hover:bg-white/10' : 'hover:bg-slate-100',
                  )}
                >
                  <Avatar name={user.fullName} url={user.avatarUrl} size="sm" />
                  <span
                    className={clsx(
                      'text-sm font-semibold',
                      dark ? 'text-white' : 'text-slate-800',
                    )}
                  >
                    {user.fullName.split(' ')[0]}
                  </span>
                </Link>
                <button
                  className={clsx(
                    'btn-ghost',
                    dark && 'text-slate-300 hover:bg-white/10 hover:text-white',
                  )}
                  onClick={() => logout().then(() => navigate('/'))}
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={clsx(
                    'btn-ghost',
                    dark && 'text-slate-200 hover:bg-white/10 hover:text-white',
                  )}
                >
                  Log in
                </Link>
                <Link to="/register" className="btn-primary">
                  Get started
                </Link>
              </>
            )}
          </div>
          <button
            className={clsx('md:hidden', dark && 'text-white')}
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div
            className="space-y-1 border-t border-slate-200 bg-white px-4 py-3 md:hidden"
            onClick={() => setOpen(false)}
          >
            <Link
              to="/search"
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              <Search className="h-4 w-4 text-brand-600" /> Find technicians
            </Link>
            {user ? (
              <>
                <Link
                  to={homeFor(user.role)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-semibold hover:bg-slate-50"
                >
                  <LayoutDashboard className="h-4 w-4 text-brand-600" /> Dashboard
                </Link>
                <button
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-semibold hover:bg-slate-50"
                  onClick={() => logout()}
                >
                  <LogOut className="h-4 w-4 text-brand-600" /> Log out
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/login" className="btn-secondary flex-1">
                  Log in
                </Link>
                <Link to="/register" className="btn-primary flex-1">
                  Get started
                </Link>
              </div>
            )}
          </div>
        )}
      </header>
      <ScrollProgress />
      <main className="flex-1">
        <PageTransition />
      </main>
      <footer className="bg-ink-950 text-slate-400">
        <div className="mx-auto grid grid-cols-1 max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo dark />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              Verified home-service professionals across Chattogram and Dhaka. Book a slot, track
              your technician live, and pay only when the job is done.
            </p>
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-300">
              <ShieldCheck className="h-4 w-4 text-brand-400" /> Every technician is verified before
              they appear in search
            </div>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Customers</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link className="hover:text-white" to="/search">
                  Find a technician
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" to="/dashboard">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" to="/register">
                  Create account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Professionals</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link className="hover:text-white" to="/register?role=technician">
                  Join as a technician
                </Link>
              </li>
              <li>
                <Link className="hover:text-white" to="/technician/profile">
                  Work profile
                </Link>
              </li>
              <li>
                <a className="hover:text-white" href="/api/docs">
                  Developer API
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-4 py-5 text-xs sm:flex-row">
            <span>© {new Date().getFullYear()} TechFinder. Built in Chattogram.</span>
            <span>Prices in BDT · Times in Asia/Dhaka</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App (dashboard) layout                                              */
/* ------------------------------------------------------------------ */

function NotificationBell() {
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-[var(--shadow-soft)] transition hover:text-slate-900"
        onClick={() => {
          setOpen(!open);
          if (!open) markAllRead();
        }}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 animate-fade-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-lift)]">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold">Notifications</div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              <Bell className="mx-auto mb-2 h-6 w-6 text-slate-300" />
              You're all caught up. Updates on your bookings appear here in real time.
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => {
                const Icon = NOTIFICATION_ICON[n.kind];
                return (
                  <li key={n.id}>
                    <Link
                      to={n.href ?? '#'}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{n.title}</span>
                        <span className="block text-xs text-slate-500">
                          {n.body} ·{' '}
                          {new Date(n.at).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  badge,
  end,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  badge?: number;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
          isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-400" />
          )}
          <Icon
            className={clsx(
              'h-[18px] w-[18px]',
              isActive ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-300',
            )}
          />
          <span className="flex-1">{label}</span>
          {!!badge && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-ink-900">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: () => api<{ pendingRequests: number; activeCount: number }>('/bookings/summary'),
    enabled: user?.role === 'customer' || user?.role === 'technician',
    staleTime: 30_000,
  });
  if (!user) return null;
  const isTech = user.role === 'technician';
  const roleLabel = { customer: 'Customer', technician: 'Technician', admin: 'Administrator' }[
    user.role
  ];

  return (
    <div
      className="flex h-full flex-col bg-ink-950 px-4 py-5"
      onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}
    >
      <div className="px-2">
        <Logo dark to={homeFor(user.role)} />
      </div>

      {user.role === 'customer' && (
        <Link to="/search" className="btn-primary mt-7 w-full py-3">
          <Plus className="h-4 w-4" /> Book a service
        </Link>
      )}

      <div className="mt-7 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        Menu
      </div>
      <nav className="mt-2 space-y-1">
        {user.role === 'admin' ? (
          <SidebarLink to="/admin" icon={LayoutDashboard} label="Overview" />
        ) : (
          <SidebarLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        )}
        {user.role !== 'admin' && (
          <SidebarLink
            to="/bookings"
            icon={CalendarCheck}
            label={isTech ? 'Jobs' : 'My bookings'}
            badge={isTech ? summary.data?.pendingRequests : summary.data?.activeCount}
          />
        )}
        {isTech && <SidebarLink to="/technician/profile" icon={Wrench} label="Work profile" />}
        <SidebarLink to="/search" icon={Search} label="Find technicians" />
      </nav>

      <div className="mt-7 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        Settings
      </div>
      <nav className="mt-2 space-y-1">
        <SidebarLink to="/account" icon={UserCog} label="Account" />
        <SidebarLink to="/" icon={Home} label="Back to website" end />
      </nav>

      <div className="mt-auto rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <Avatar name={user.fullName} url={user.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">{user.fullName}</div>
            <div className="text-xs text-slate-400">{roleLabel}</div>
          </div>
          <button
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            title="Log out"
            onClick={() => logout().then(() => navigate('/'))}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, ready } = useAuth();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  if (!ready) return <PageLoader />;
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-[600] hidden w-64 lg:block">
        <Sidebar />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-[700] lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-up shadow-2xl">
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-[500] border-b border-slate-200/70 bg-slate-50/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
            <button
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-200/60 lg:hidden"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              to="/search"
              className="hidden max-w-sm flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-400 shadow-[var(--shadow-soft)] transition hover:border-slate-300 sm:flex"
            >
              <Search className="h-4 w-4" /> Search technicians, services…
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <NotificationBell />
              <Link
                to="/account"
                className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-slate-200/60"
              >
                <Avatar name={user.fullName} url={user.avatarUrl} size="sm" />
                <span className="hidden text-sm font-bold text-slate-800 sm:block">
                  {user.fullName.split(' ')[0]}
                </span>
              </Link>
            </div>
          </div>
        </header>
        <main className="px-4 py-8 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <PageTransition />
          </div>
        </main>
      </div>
    </div>
  );
}

export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
