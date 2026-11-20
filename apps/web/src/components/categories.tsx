import {
  AirVent,
  Bug,
  Camera,
  Droplets,
  Hammer,
  Laptop,
  Paintbrush,
  Plug,
  Refrigerator,
  SprayCan,
  Wrench,
} from 'lucide-react';

/** Icon and a distinct tint per service, so categories are recognisable at a glance. */
export const CATEGORY_STYLE: Record<string, { icon: typeof Plug; tint: string; ring: string }> = {
  electrician: {
    icon: Plug,
    tint: 'bg-amber-100 text-amber-700',
    ring: 'group-hover:ring-amber-200',
  },
  plumber: { icon: Droplets, tint: 'bg-sky-100 text-sky-700', ring: 'group-hover:ring-sky-200' },
  'ac-repair': {
    icon: AirVent,
    tint: 'bg-cyan-100 text-cyan-700',
    ring: 'group-hover:ring-cyan-200',
  },
  'appliance-repair': {
    icon: Refrigerator,
    tint: 'bg-indigo-100 text-indigo-700',
    ring: 'group-hover:ring-indigo-200',
  },
  carpenter: {
    icon: Hammer,
    tint: 'bg-orange-100 text-orange-700',
    ring: 'group-hover:ring-orange-200',
  },
  painter: {
    icon: Paintbrush,
    tint: 'bg-pink-100 text-pink-700',
    ring: 'group-hover:ring-pink-200',
  },
  cleaning: {
    icon: SprayCan,
    tint: 'bg-emerald-100 text-emerald-700',
    ring: 'group-hover:ring-emerald-200',
  },
  'pest-control': {
    icon: Bug,
    tint: 'bg-lime-100 text-lime-700',
    ring: 'group-hover:ring-lime-200',
  },
  'computer-repair': {
    icon: Laptop,
    tint: 'bg-violet-100 text-violet-700',
    ring: 'group-hover:ring-violet-200',
  },
  'cctv-installation': {
    icon: Camera,
    tint: 'bg-slate-200 text-slate-700',
    ring: 'group-hover:ring-slate-300',
  },
};
const FALLBACK = {
  icon: Wrench,
  tint: 'bg-brand-100 text-brand-700',
  ring: 'group-hover:ring-brand-200',
};
export const categoryStyle = (slug: string) => CATEGORY_STYLE[slug] ?? FALLBACK;

export function CategoryIcon({ slug, size = 'md' }: { slug: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = categoryStyle(slug);
  const box = { sm: 'h-8 w-8 rounded-lg', md: 'h-11 w-11 rounded-xl', lg: 'h-14 w-14 rounded-2xl' }[
    size
  ];
  const icon = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' }[size];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box} ${s.tint}`}>
      <s.icon className={icon} />
    </span>
  );
}
