import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  CalendarClock,
  Check,
  MapPin,
  Navigation,
  ShieldCheck,
  Wallet,
  Wrench,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PRESET_LOCATIONS, type LatLng } from '../lib/geo';
import type { Category } from '../lib/types';
import { ErrorBox, Field, Spinner } from '../components/ui';
import { LocationPicker } from '../components/maps';
import { homeFor } from '../components/Layout';
import { motion } from 'motion/react';
import { Aurora, EASE } from '../components/motion';
import { CategoryIcon } from '../components/categories';

function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
        <Aurora />
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col justify-center px-14 py-16 text-white">
          <span className="eyebrow w-fit">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified professionals only
          </span>
          <h2 className="mt-6 max-w-md text-4xl font-extrabold leading-tight text-white">
            Home repairs, <span className="text-gradient">without the guesswork.</span>
          </h2>
          <ul className="mt-8 space-y-4 text-slate-300">
            {[
              [MapPin, 'Find rated technicians within minutes of you'],
              [CalendarClock, 'Book a guaranteed time slot'],
              [Navigation, 'Track them live and chat in the app'],
              [Wallet, 'Pay only once the job is done'],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof MapPin;
              return (
                <motion.li
                  key={text as string}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 + i * 0.1, ease: EASE }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-brand-300">
                    <I className="h-4 w-4" />
                  </span>
                  {text as string}
                </motion.li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-fade-up">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Only allow same-site relative redirects (prevents open-redirect via ?next=). */
const safeNext = (next: string | null) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : null;

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email, password);
      navigate(safeNext(params.get('next')) ?? homeFor(u.role), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const demo = (who: 'customer' | 'technician' | 'admin') => {
    setEmail(`${who}@techfinder.dev`);
    setPassword('Demo@12345');
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle={
        <>
          New here?{' '}
          <Link className="font-semibold text-brand-700" to="/register">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Log in
        </button>
        <Link
          to="/forgot-password"
          className="block text-center text-sm text-slate-500 hover:text-slate-800"
        >
          Forgot your password?
        </Link>
      </form>
      <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-600">
        <div className="font-bold text-slate-800">Try a demo account</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['customer', 'technician', 'admin'] as const).map((w) => (
            <button
              key={w}
              type="button"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold capitalize hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800"
              onClick={() => demo(w)}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
    </AuthCard>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<'customer' | 'technician'>(
    params.get('role') === 'technician' ? 'technician' : 'customer',
  );
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [tech, setTech] = useState({
    experienceYears: 2,
    hourlyRateBdt: 500,
    serviceRadiusKm: 10,
    bio: '',
    areaLabel: '',
  });
  const [loc, setLoc] = useState<LatLng>(PRESET_LOCATIONS[0]!);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fieldErrors = error instanceof ApiError ? error.fieldErrors() : {};

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: Category[] }>('/categories').then((r) => r.items),
    enabled: role === 'technician',
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { role, ...form, phone: form.phone || undefined };
      if (role === 'technician') {
        body.profile = {
          ...tech,
          bio: tech.bio || undefined,
          areaLabel: tech.areaLabel || undefined,
          ...loc,
          categoryIds,
        };
      }
      const u = await register(body);
      navigate(u.role === 'technician' ? '/technician/profile' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle={
        <>
          Already have one?{' '}
          <Link className="font-semibold text-brand-700" to="/login">
            Log in
          </Link>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-bold">
        {(['customer', 'technician'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={clsx(
              'rounded-lg py-2.5 transition',
              role === r ? 'bg-white shadow-sm' : 'text-slate-500',
            )}
          >
            {r === 'customer' ? 'I need a service' : "I'm a technician"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" error={fieldErrors.fullName}>
          <input
            className="input"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field
          label="Password"
          error={fieldErrors.password}
          hint="At least 8 characters, with a letter and a number"
        >
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field
          label={role === 'technician' ? 'Mobile number' : 'Mobile number (optional)'}
          error={fieldErrors.phone}
        >
          <input
            className="input"
            type="tel"
            placeholder="01XXXXXXXXX"
            required={role === 'technician'}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>

        {role === 'technician' && (
          <>
            <div className="flex items-center gap-3 pt-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Wrench className="h-4 w-4" />
              </span>
              <div>
                <div className="font-bold text-slate-900">Your work</div>
                <div className="text-xs text-slate-500">
                  This is what customers see when they search
                </div>
              </div>
            </div>
            <div>
              <span className="label">Services you offer</span>
              <div className="grid grid-cols-2 gap-2">
                {categories.data?.map((c) => {
                  const on = categoryIds.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() =>
                        setCategoryIds(
                          on ? categoryIds.filter((x) => x !== c.id) : [...categoryIds, c.id],
                        )
                      }
                      className={clsx(
                        'flex items-center gap-2 rounded-xl border p-2 text-left text-sm font-semibold transition',
                        on
                          ? 'border-brand-500 bg-brand-50 text-brand-900 ring-2 ring-brand-100'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                      )}
                    >
                      <CategoryIcon slug={c.slug} size="sm" />
                      <span className="min-w-0 flex-1 leading-tight">{c.name}</span>
                      {on && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                    </button>
                  );
                })}
              </div>
              {fieldErrors['profile.categoryIds'] && (
                <span className="mt-1.5 block text-xs font-medium text-rose-600">
                  Choose at least one service
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Experience">
                <div className="relative">
                  <input
                    className="input pr-10"
                    type="number"
                    min={0}
                    max={60}
                    value={tech.experienceYears}
                    onChange={(e) => setTech({ ...tech, experienceYears: +e.target.value })}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    yrs
                  </span>
                </div>
              </Field>
              <Field label="Hourly rate">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    className="input pl-7"
                    type="number"
                    min={100}
                    step={50}
                    value={tech.hourlyRateBdt}
                    onChange={(e) => setTech({ ...tech, hourlyRateBdt: +e.target.value })}
                  />
                </div>
              </Field>
              <Field label="Travel radius">
                <div className="relative">
                  <input
                    className="input pr-9"
                    type="number"
                    min={1}
                    max={100}
                    value={tech.serviceRadiusKm}
                    onChange={(e) => setTech({ ...tech, serviceRadiusKm: +e.target.value })}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    km
                  </span>
                </div>
              </Field>
            </div>
            <Field label="Area name" hint="Shown to customers, e.g. “Agrabad, Chattogram”">
              <input
                className="input"
                value={tech.areaLabel}
                onChange={(e) => setTech({ ...tech, areaLabel: e.target.value })}
              />
            </Field>
            <div>
              <span className="label">Your base location</span>
              <LocationPicker
                value={loc}
                onChange={setLoc}
                height={220}
                radiusKm={tech.serviceRadiusKm}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Tap the map or drag the pin. The circle shows where you'll get requests from.
              </p>
            </div>
            <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
              <ShieldCheck className="h-4 w-4 shrink-0" /> An admin reviews new technician profiles
              before they appear in search.
            </div>
          </>
        )}

        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Create account
        </button>
      </form>
    </AuthCard>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError(err);
    }
  };
  return (
    <AuthCard title="Reset your password">
      {sent ? (
        <p className="text-sm text-slate-600">
          If that email is registered, a reset link is on its way. In local development, open the
          Mailpit inbox at{' '}
          <a
            className="font-semibold text-brand-700"
            href="http://localhost:8025"
            target="_blank"
            rel="noreferrer"
          >
            localhost:8025
          </a>
          .
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <ErrorBox error={error} />
          <button className="btn-primary w-full">Send reset link</button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token: params.get('token'), password },
      });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err);
    }
  };
  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint="At least 8 characters, with a letter and a number">
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primary w-full">Update password</button>
      </form>
    </AuthCard>
  );
}
