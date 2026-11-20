import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Check, CheckCircle2, Navigation, Send, Star, Wrench, X } from 'lucide-react';
import { EASE } from './motion';

/** Loop a counter 0..n-1 every `ms`. */
function useTicker(n: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms]);
  return i;
}

/* -------- 1. Chat: messages appear one by one, with a typing indicator -------- */
const CHAT = [
  { me: false, text: 'Assalamu alaikum! I’m on my way 🛵' },
  { me: true, text: 'Great, gate code is 2468' },
  { me: false, text: 'Got it. 5 minutes away' },
  { me: true, text: 'Thank you! 🙏' },
];
export function ChatDemo() {
  const step = useTicker(CHAT.length + 3, 1300);
  const shown = Math.max(1, Math.min(step, CHAT.length));
  const typing = step < CHAT.length && step > 0;
  const eta = Math.max(1, 9 - step);
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Arrival card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 text-sm font-bold text-white">
            RH
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-ink-950" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white">Rahim H. · Electrician</div>
            <div className="text-xs text-slate-400">On the way to House 7, Agrabad</div>
          </div>
          <motion.span
            key={eta}
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-lg bg-amber-300 px-2 py-1 text-xs font-extrabold text-ink-950"
          >
            {eta} min
          </motion.span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-amber-300"
            animate={{ width: `${((9 - eta) / 8) * 100}%` }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        </div>
      </div>
      {/* Conversation */}
      <div className="flex flex-1 flex-col justify-end gap-2 rounded-2xl bg-black/20 p-4">
        <AnimatePresence initial={false}>
          {CHAT.slice(0, shown).map((m, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className={clsx(
                'max-w-[85%] rounded-2xl px-3 py-2 text-[13px]',
                m.me
                  ? 'self-end rounded-br-md bg-gradient-to-br from-brand-400 to-brand-600 text-white'
                  : 'self-start rounded-bl-md bg-white/10 text-slate-100',
              )}
            >
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && (
          <motion.div
            layout
            className={clsx(
              'flex gap-1 rounded-2xl px-3 py-2.5',
              CHAT[shown]?.me ? 'self-end bg-brand-600/60' : 'self-start bg-white/10',
            )}
          >
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="typing-dot h-1.5 w-1.5 rounded-full bg-white"
                style={{ animationDelay: `${d * 0.15}s` }}
              />
            ))}
          </motion.div>
        )}
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-500 ring-1 ring-white/10">
          Type a message… <Send className="ml-auto h-3.5 w-3.5 text-brand-300" />
        </div>
      </div>
    </div>
  );
}

/* -------- 2. Radar: technicians "found" around you -------- */
const DOTS = [
  { x: 28, y: 32 },
  { x: 70, y: 24 },
  { x: 78, y: 62 },
  { x: 36, y: 74 },
  { x: 58, y: 44 },
  { x: 18, y: 56 },
];
export function RadarDemo() {
  const found = useTicker(DOTS.length + 2, 700);
  return (
    <div className="relative mx-auto aspect-square h-full max-h-56">
      {[1, 0.72, 0.44].map((s) => (
        <div
          key={s}
          className="absolute inset-0 m-auto rounded-full border border-brand-300/20"
          style={{ width: `${s * 100}%`, height: `${s * 100}%` }}
        />
      ))}
      <div className="radar-sweep absolute inset-0 rounded-full" />
      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 ring-4 ring-amber-300/30" />
      {DOTS.map((d, i) => (
        <motion.span
          key={i}
          className="absolute h-2.5 w-2.5 rounded-full bg-brand-300 shadow-[0_0_12px_rgb(52_195_166)]"
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
          animate={{ scale: i < found ? 1 : 0, opacity: i < found ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        />
      ))}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur">
        {Math.min(found, DOTS.length)} pros nearby
      </div>
    </div>
  );
}

/* -------- 3. The booking race: 10 requests, exactly 1 confirmed -------- */
export function SlotRaceDemo() {
  const phase = useTicker(4, 1400); // 0 idle, 1 fly, 2 resolve, 3 hold
  const winner = 6;
  return (
    <div className="flex h-full flex-col items-center justify-between gap-4">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, i) => {
          const resolved = phase >= 2;
          const won = i === winner;
          return (
            <motion.div
              key={i}
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold',
                resolved
                  ? won
                    ? 'bg-brand-400 text-ink-950'
                    : 'bg-rose-500/20 text-rose-300'
                  : 'bg-white/10 text-slate-300',
              )}
              animate={{ y: phase === 1 ? [0, -6, 0] : 0, scale: resolved && won ? 1.15 : 1 }}
              transition={{ duration: 0.5, delay: phase === 1 ? i * 0.04 : 0 }}
            >
              {resolved ? (
                won ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )
              ) : (
                i + 1
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="w-full rounded-xl border border-dashed border-white/15 p-3 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Sat · 10:00–12:00
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase >= 2 ? 'won' : 'open'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={clsx(
              'mt-0.5 text-sm font-extrabold',
              phase >= 2 ? 'text-brand-300' : 'text-slate-200',
            )}
          >
            {phase >= 2
              ? '1 confirmed · 9 told "slot taken"'
              : phase === 1
                ? '10 people book at once…'
                : 'Slot open'}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* -------- 4. Booking status advancing -------- */
const STEPS = [
  { label: 'Requested', icon: Send },
  { label: 'Accepted', icon: CheckCircle2 },
  { label: 'On the way', icon: Navigation },
  { label: 'Working', icon: Wrench },
  { label: 'Done', icon: Star },
];
export function StatusDemo() {
  const at = useTicker(STEPS.length + 1, 1100);
  const current = Math.min(at, STEPS.length - 1);
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="relative h-1.5 rounded-full bg-white/10">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-400 to-amber-300"
          animate={{ width: `${(current / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </div>
      <div className="flex justify-between">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.label}
            className="flex flex-col items-center gap-1.5"
            animate={{ opacity: i <= current ? 1 : 0.35 }}
          >
            <motion.span
              className={clsx(
                'flex h-9 w-9 items-center justify-center rounded-xl',
                i <= current ? 'bg-brand-400 text-ink-950' : 'bg-white/10 text-slate-400',
              )}
              animate={{ scale: i === current ? [1, 1.18, 1] : 1 }}
              transition={{ duration: 0.5 }}
            >
              <s.icon className="h-4 w-4" />
            </motion.span>
            <span className="text-[10px] font-semibold text-slate-300">{s.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* -------- 5. Fair ratings: many reviews beat one perfect review -------- */
export function RatingDemo() {
  const on = useTicker(2, 2600) === 1;
  const rows = [
    { name: 'Rahim U.', stars: '5.0', reviews: 1, score: 0.62 },
    { name: 'Nusrat M.', stars: '4.8', reviews: 200, score: 0.94 },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-bold text-white">{r.name}</span>
            <span className="text-slate-400">
              ★ {r.stars} · {r.reviews} review{r.reviews > 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <motion.div
              className={clsx(
                'h-2 rounded-full',
                r.reviews > 1 ? 'bg-gradient-to-r from-brand-400 to-brand-300' : 'bg-slate-500',
              )}
              animate={{ width: on ? `${r.score * 100}%` : '8%' }}
              transition={{ duration: 0.9, ease: EASE }}
            />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-400">
        Adjusted rating: lots of reviews count for more than one lucky 5★.
      </p>
    </div>
  );
}
