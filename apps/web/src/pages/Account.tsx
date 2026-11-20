import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { api, ApiError, setSession } from '../lib/api';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/format';
import type { User } from '../lib/types';
import { Avatar, ErrorBox, Field, PageHeader, Section, Spinner } from '../components/ui';

const ROLE_STYLE = {
  customer: 'bg-sky-100 text-sky-800',
  technician: 'bg-amber-100 text-amber-800',
  admin: 'bg-violet-100 text-violet-800',
};

function PasswordStrength({ value }: { value: string }) {
  const checks = [
    value.length >= 8,
    /[A-Za-z]/.test(value),
    /\d/.test(value),
    value.length >= 12 || /[^A-Za-z0-9]/.test(value),
  ];
  const score = checks.filter(Boolean).length;
  const label = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={clsx(
              'h-1.5 flex-1 rounded-full',
              i < score ? (score <= 2 ? 'bg-amber-400' : 'bg-brand-500') : 'bg-slate-200',
            )}
          />
        ))}
      </div>
      {value && <div className="mt-1 text-xs font-semibold text-slate-500">{label}</div>}
    </div>
  );
}

export default function Account() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'profile' | 'security'>('profile');
  const [fullName, setFullName] = useState(user!.fullName);
  const [phone, setPhone] = useState(user!.phone ?? '');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api<User>('/users/me', { method: 'PATCH', body: { fullName, phone: phone || null } }),
    onSuccess: (u) => {
      setUser(u);
      setMsg('Profile saved');
    },
  });
  const avatar = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('avatar', file);
      return api<User>('/users/me/avatar', { method: 'POST', body: fd });
    },
    onSuccess: (u) => {
      setUser(u);
      setMsg('Photo updated');
    },
  });
  const changePw = useMutation({
    mutationFn: () =>
      api<{ accessToken: string }>('/users/me/password', { method: 'POST', body: pw }),
    onSuccess: (r) => {
      // Other sessions were signed out; this one continues with a fresh token.
      setSession(r.accessToken, user);
      setPw({ currentPassword: '', newPassword: '' });
      setMsg('Password changed. You have been signed out on all other devices.');
    },
  });
  const [del, setDel] = useState({ password: '', confirm: '' });
  const deleteAccount = useMutation({
    mutationFn: () =>
      api('/users/me', {
        method: 'DELETE',
        body: { password: del.password, confirm: del.confirm },
      }),
    onSuccess: () => {
      setSession(null, null);
      navigate('/', { replace: true });
    },
  });
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors() : {};
  const u = user!;

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Account"
        subtitle="Manage your profile, photo and sign-in security."
      />

      {msg && (
        <div className="mb-6 flex animate-fade-up items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="h-4 w-4" /> {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="card self-start overflow-hidden">
          <div className="relative h-24 overflow-hidden bg-ink-950">
            <div className="bg-grid absolute inset-0 opacity-60" />
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-brand-500/50 blur-2xl" />
          </div>
          <div className="-mt-12 flex flex-col items-center px-6 pb-6 text-center">
            <label className="group relative cursor-pointer" title="Change photo">
              <Avatar name={u.fullName} url={u.avatarUrl} size="xl" ring />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink-950/50 text-white opacity-0 transition group-hover:opacity-100">
                {avatar.isPending ? (
                  <Spinner className="h-6 w-6 text-white" />
                ) : (
                  <Camera className="h-6 w-6" />
                )}
              </span>
              <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white ring-4 ring-white">
                <Camera className="h-4 w-4" />
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && avatar.mutate(e.target.files[0])}
              />
            </label>
            <h2 className="mt-4 text-xl font-extrabold">{u.fullName}</h2>
            <span
              className={clsx(
                'mt-1.5 rounded-full px-3 py-0.5 text-xs font-bold capitalize',
                ROLE_STYLE[u.role],
              )}
            >
              {u.role}
            </span>
            <dl className="mt-5 w-full space-y-2.5 text-left text-sm">
              <div className="flex items-center gap-2.5 text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />{' '}
                <span className="truncate">{u.email}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-600">
                <Phone className="h-4 w-4 text-slate-400" />{' '}
                {u.phone ?? <span className="text-slate-400">No phone added</span>}
              </div>
              <div className="flex items-center gap-2.5 text-slate-600">
                <ShieldCheck className="h-4 w-4 text-slate-400" /> Member since{' '}
                {formatDate(u.createdAt)}
              </div>
            </dl>
            <p className="mt-4 text-xs text-slate-400">JPEG, PNG or WebP · max 2 MB</p>
            <div className="mt-2 w-full">
              <ErrorBox error={avatar.error} />
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="flex w-fit rounded-xl bg-slate-200/60 p-1 text-sm font-bold">
            {(
              [
                ['profile', 'Profile', UserRound],
                ['security', 'Security', Lock],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={clsx(
                  'flex items-center gap-2 rounded-lg px-4 py-2 transition',
                  tab === k
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {tab === 'profile' ? (
            <Section
              icon={UserRound}
              title="Personal information"
              description="Your name and number are shared with the other party on a booking."
            >
              <form
                className="space-y-5"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  setMsg(null);
                  save.mutate();
                }}
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Full name" error={fieldErrors.fullName}>
                    <input
                      className="input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Mobile number"
                    error={fieldErrors.phone}
                    hint="Bangladeshi mobile, e.g. 017XXXXXXXX"
                  >
                    <input
                      className="input"
                      value={phone}
                      placeholder="01XXXXXXXXX"
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Email address" hint="Contact support to change your email.">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input className="input pl-10" value={u.email} disabled />
                  </div>
                </Field>
                <ErrorBox
                  error={save.isError && !Object.keys(fieldErrors).length ? save.error : null}
                />
                <div className="flex justify-end border-t border-slate-100 pt-5">
                  <button className="btn-primary" disabled={save.isPending}>
                    {save.isPending && <Spinner className="h-4 w-4 text-white" />} Save changes
                  </button>
                </div>
              </form>
            </Section>
          ) : (
            <>
              <Section
                icon={KeyRound}
                title="Change password"
                description="This device stays signed in; every other session is signed out."
              >
                <form
                  className="space-y-5"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    setMsg(null);
                    changePw.mutate();
                  }}
                >
                  <Field label="Current password">
                    <input
                      className="input"
                      type="password"
                      autoComplete="current-password"
                      value={pw.currentPassword}
                      onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
                    />
                  </Field>
                  <div>
                    <Field
                      label="New password"
                      hint="At least 8 characters, with a letter and a number"
                    >
                      <input
                        className="input"
                        type="password"
                        autoComplete="new-password"
                        value={pw.newPassword}
                        onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                      />
                    </Field>
                    <PasswordStrength value={pw.newPassword} />
                  </div>
                  <ErrorBox error={changePw.error} />
                  <div className="flex justify-end border-t border-slate-100 pt-5">
                    <button
                      className="btn-primary"
                      disabled={
                        changePw.isPending || !pw.currentPassword || pw.newPassword.length < 8
                      }
                    >
                      {changePw.isPending && <Spinner className="h-4 w-4 text-white" />} Update
                      password
                    </button>
                  </div>
                </form>
              </Section>
              <Section icon={ShieldCheck} title="How your account is protected">
                <ul className="grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  {[
                    'Passwords are hashed with bcrypt; we never store them in plain text.',
                    'Sessions use short-lived tokens that rotate automatically.',
                    'A stolen session token is detected and every session is signed out.',
                    'Resetting your password signs you out everywhere.',
                  ].map((t) => (
                    <li key={t} className="flex gap-2 rounded-xl bg-slate-50 p-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {t}
                    </li>
                  ))}
                </ul>
                <button className="btn-danger mt-5" onClick={() => logout()}>
                  <LogOut className="h-4 w-4" /> Sign out of this device
                </button>
              </Section>
              {u.role !== 'admin' && (
                <section className="card overflow-hidden border-rose-200">
                  <div className="flex items-center gap-3 border-b border-rose-100 bg-rose-50/60 px-6 py-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                      <Trash2 className="h-[18px] w-[18px]" />
                    </span>
                    <div>
                      <h2 className="font-bold text-rose-900">Delete account</h2>
                      <p className="text-sm text-rose-700/80">
                        Permanently erases your name, phone, photo and messages, cancels open
                        bookings and signs you out everywhere.
                      </p>
                    </div>
                  </div>
                  <form
                    className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      deleteAccount.mutate();
                    }}
                  >
                    <Field label="Your password">
                      <input
                        className="input"
                        type="password"
                        autoComplete="current-password"
                        value={del.password}
                        onChange={(e) => setDel({ ...del, password: e.target.value })}
                      />
                    </Field>
                    <Field label='Type "DELETE" to confirm'>
                      <input
                        className="input"
                        value={del.confirm}
                        onChange={(e) => setDel({ ...del, confirm: e.target.value })}
                      />
                    </Field>
                    <button
                      className="btn-danger"
                      disabled={
                        deleteAccount.isPending || del.confirm !== 'DELETE' || !del.password
                      }
                    >
                      {deleteAccount.isPending ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}{' '}
                      Delete
                    </button>
                    <div className="sm:col-span-3">
                      <ErrorBox error={deleteAccount.error} />
                    </div>
                  </form>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
