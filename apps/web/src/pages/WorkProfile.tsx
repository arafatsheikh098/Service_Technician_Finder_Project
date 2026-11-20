import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BadgeCheck,
  Briefcase,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  MapPin,
  Save,
  Star,
  UserRound,
  Wallet,
  Wrench,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocketEvent } from '../lib/socket';
import { taka } from '../lib/format';
import type { Category, TechnicianProfile } from '../lib/types';
import {
  Avatar,
  ErrorBox,
  Field,
  PageHeader,
  PageLoader,
  Section,
  Spinner,
  Stars,
  Verified,
} from '../components/ui';
import { CategoryIcon } from '../components/categories';
import { LocationPicker } from '../components/maps';

type Form = Partial<TechnicianProfile> & { categoryIds?: number[] };

export default function WorkProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const profile = useQuery({
    queryKey: ['my-tech-profile'],
    queryFn: () => api<TechnicianProfile>('/technicians/me/profile'),
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ items: Category[] }>('/categories').then((r) => r.items),
  });
  const [form, setForm] = useState<Form>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile.data)
      setForm({ ...profile.data, categoryIds: profile.data.categories.map((c) => c.id) });
  }, [profile.data]);

  useSocketEvent(
    'profile.verification',
    () => void qc.invalidateQueries({ queryKey: ['my-tech-profile'] }),
  );

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<TechnicianProfile>('/technicians/me/profile', { method: 'PATCH', body }),
    onSuccess: (p) => {
      qc.setQueryData(['my-tech-profile'], p);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });
  const toggle = useMutation({
    mutationFn: (isAvailable: boolean) =>
      api<TechnicianProfile>('/technicians/me/profile', { method: 'PATCH', body: { isAvailable } }),
    onSuccess: (p) => qc.setQueryData(['my-tech-profile'], p),
  });

  const p = profile.data;
  const dirty = useMemo(() => {
    if (!p || !form.id) return false;
    const ids = (xs: number[]) => [...xs].sort().join(',');
    return (
      (form.bio ?? '') !== (p.bio ?? '') ||
      Number(form.experienceYears) !== p.experienceYears ||
      Number(form.hourlyRateBdt) !== p.hourlyRateBdt ||
      Number(form.serviceRadiusKm) !== Number(p.serviceRadiusKm) ||
      (form.areaLabel ?? '') !== (p.areaLabel ?? '') ||
      form.lat !== p.lat ||
      form.lng !== p.lng ||
      ids(form.categoryIds ?? []) !== ids(p.categories.map((c) => c.id))
    );
  }, [form, p]);

  if (profile.isLoading || !form.id || !p) return <PageLoader />;
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors() : {};
  const selected = categories.data?.filter((c) => form.categoryIds?.includes(c.id)) ?? [];

  const checklist: [string, boolean][] = [
    ['Profile photo added', Boolean(user?.avatarUrl)],
    ['At least 2 services', (form.categoryIds?.length ?? 0) >= 2],
    ['Bio of 80+ characters', (form.bio?.length ?? 0) >= 80],
    ['Area name set', Boolean(form.areaLabel)],
    ['Verified by TechFinder', p.isVerified],
  ];
  const strength = Math.round((checklist.filter(([, ok]) => ok).length / checklist.length) * 100);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({
      bio: form.bio || null,
      experienceYears: Number(form.experienceYears),
      hourlyRateBdt: Number(form.hourlyRateBdt),
      serviceRadiusKm: Number(form.serviceRadiusKm),
      areaLabel: form.areaLabel || null,
      lat: form.lat,
      lng: form.lng,
      categoryIds: form.categoryIds,
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Technician"
        title="Work profile"
        subtitle="What customers see, where you work, and whether you're taking jobs."
      >
        <Link to={`/technicians/${p.id}`} className="btn-secondary">
          <Eye className="h-4 w-4" /> View public profile
        </Link>
      </PageHeader>

      {!p.isVerified && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <b>Waiting for verification.</b> You'll appear in search as soon as an admin approves
            your profile. This page updates automatically.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <form onSubmit={submit} className="space-y-6">
          <Section
            icon={Wrench}
            title="Services"
            description="Pick everything you can do well. Customers filter by these."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.data?.map((c) => {
                const on = form.categoryIds?.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        categoryIds: on
                          ? form.categoryIds!.filter((x) => x !== c.id)
                          : [...(form.categoryIds ?? []), c.id],
                      })
                    }
                    className={clsx(
                      'relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-semibold transition',
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
            {fieldErrors.categoryIds && (
              <p className="mt-2 text-xs font-medium text-rose-600">Choose at least one service</p>
            )}
          </Section>

          <Section
            icon={Wallet}
            title="Pricing & experience"
            description="Your hourly rate is shown on every search result."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Hourly rate" error={fieldErrors.hourlyRateBdt}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    className="input pl-8 text-base font-bold"
                    type="number"
                    min={100}
                    step={50}
                    value={form.hourlyRateBdt ?? 0}
                    onChange={(e) => setForm({ ...form, hourlyRateBdt: +e.target.value })}
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    / hour
                  </span>
                </div>
              </Field>
              <Field label="Years of experience" error={fieldErrors.experienceYears}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary h-11 w-11 px-0 text-lg"
                    onClick={() =>
                      setForm({
                        ...form,
                        experienceYears: Math.max(0, Number(form.experienceYears) - 1),
                      })
                    }
                  >
                    −
                  </button>
                  <input
                    className="input text-center text-base font-bold"
                    type="number"
                    min={0}
                    max={60}
                    value={form.experienceYears ?? 0}
                    onChange={(e) => setForm({ ...form, experienceYears: +e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-secondary h-11 w-11 px-0 text-lg"
                    onClick={() =>
                      setForm({
                        ...form,
                        experienceYears: Math.min(60, Number(form.experienceYears) + 1),
                      })
                    }
                  >
                    +
                  </button>
                </div>
              </Field>
            </div>
          </Section>

          <Section
            icon={UserRound}
            title="About you"
            description="A short, friendly intro builds trust before the first booking."
          >
            <textarea
              className="input min-h-28 leading-relaxed"
              maxLength={1000}
              placeholder="e.g. 8 years fixing wiring, fans and breakers across Agrabad. I explain the problem before I start and clean up after."
              value={form.bio ?? ''}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
            <div className="mt-1.5 flex justify-between text-xs text-slate-500">
              <span>Tip: mention your specialities and how you work.</span>
              <span
                className={clsx((form.bio?.length ?? 0) >= 80 && 'font-semibold text-brand-600')}
              >
                {form.bio?.length ?? 0}/1000
              </span>
            </div>
          </Section>

          <Section
            icon={MapPin}
            title="Service area"
            description="You'll only get requests from customers inside this circle."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.2fr]">
              <Field label="Area name" hint="Shown to customers, e.g. “Agrabad, Chattogram”">
                <input
                  className="input"
                  value={form.areaLabel ?? ''}
                  onChange={(e) => setForm({ ...form, areaLabel: e.target.value })}
                />
              </Field>
              <div>
                <span className="label">
                  Travel up to <b className="text-brand-700">{form.serviceRadiusKm} km</b>
                </span>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={Number(form.serviceRadiusKm ?? 10)}
                  onChange={(e) => setForm({ ...form, serviceRadiusKm: +e.target.value })}
                  className="mt-3 w-full accent-brand-600"
                />
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>1 km</span>
                  <span>50 km</span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <LocationPicker
                value={{ lat: form.lat!, lng: form.lng! }}
                onChange={(l) => setForm({ ...form, ...l })}
                radiusKm={Number(form.serviceRadiusKm)}
                height={300}
              />
              <p className="mt-2 text-xs text-slate-500">
                Tap the map or drag the pin to set your base location.
              </p>
            </div>
          </Section>

          <ErrorBox error={save.error} />

          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 pl-5 shadow-[var(--shadow-lift)] backdrop-blur">
            <span className="text-sm font-semibold">
              {saved ? (
                <span className="flex items-center gap-1.5 text-brand-700">
                  <CheckCircle2 className="h-4 w-4" /> Changes saved
                </span>
              ) : dirty ? (
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> You have unsaved changes
                </span>
              ) : (
                <span className="text-slate-500">All changes saved</span>
              )}
            </span>
            <div className="flex gap-2">
              {dirty && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setForm({ ...p, categoryIds: p.categories.map((c) => c.id) })}
                >
                  Discard
                </button>
              )}
              <button className="btn-primary" disabled={save.isPending || !dirty}>
                {save.isPending ? (
                  <Spinner className="h-4 w-4 text-white" />
                ) : (
                  <Save className="h-4 w-4" />
                )}{' '}
                Save changes
              </button>
            </div>
          </div>
        </form>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Live preview
              </span>
              <span className="text-xs text-slate-400">as customers see you</span>
            </div>
            <div className="h-14 bg-gradient-to-br from-brand-500 via-brand-600 to-ink-800" />
            <div className="-mt-8 px-5 pb-5">
              <Avatar name={p.fullName} url={user?.avatarUrl} size="lg" ring />
              <div className="mt-3 flex items-center gap-1 text-lg font-bold">
                {p.fullName} {p.isVerified && <Verified className="h-[18px] w-[18px]" />}
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3 w-3" /> {form.areaLabel || 'Your area'} · within{' '}
                {form.serviceRadiusKm} km
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Stars value={p.ratingAvg} count={p.ratingCount} />
                <span className="font-extrabold">
                  {taka(Number(form.hourlyRateBdt) || 0)}
                  <span className="text-xs font-medium text-slate-500">/hr</span>
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {selected.slice(0, 4).map((c) => (
                  <span key={c.id} className="chip">
                    {c.name}
                  </span>
                ))}
              </div>
              {form.bio && <p className="mt-3 line-clamp-3 text-sm text-slate-600">{form.bio}</p>}
              <div className="mt-3 flex gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> {form.experienceYears} yrs
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" /> {p.jobsCompleted} jobs
                </span>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <span className="font-bold">Profile strength</span>
              <span className="text-sm font-extrabold text-brand-700">{strength}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
                style={{ width: `${strength}%` }}
              />
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {checklist.map(([label, ok]) => (
                <li
                  key={label}
                  className={clsx(
                    'flex items-center gap-2',
                    ok ? 'text-slate-700' : 'text-slate-400',
                  )}
                >
                  {ok ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-600" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}{' '}
                  {label}
                </li>
              ))}
            </ul>
            {!user?.avatarUrl && (
              <Link
                to="/account"
                className="mt-3 inline-block text-sm font-semibold text-brand-700"
              >
                Add a photo →
              </Link>
            )}
          </div>

          <div className="card flex items-center gap-3 p-5">
            <span
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                p.isAvailable ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
              )}
            >
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-bold">
                {p.isAvailable ? 'Taking new jobs' : 'Paused'}
              </div>
              <div className="text-xs text-slate-500">
                {p.isAvailable ? 'Visible in search' : 'Hidden from search'}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={p.isAvailable}
              onClick={() => toggle.mutate(!p.isAvailable)}
              className={clsx(
                'relative h-7 w-12 rounded-full transition',
                p.isAvailable ? 'bg-brand-600' : 'bg-slate-300',
              )}
            >
              <span
                className={clsx(
                  'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
                  p.isAvailable ? 'left-6' : 'left-1',
                )}
              />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
