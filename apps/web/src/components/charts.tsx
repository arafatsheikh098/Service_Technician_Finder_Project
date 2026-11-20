import { useState } from 'react';
import clsx from 'clsx';
import { motion } from 'motion/react';

/**
 * Single-series column chart: one hue, rounded data-ends anchored to the
 * baseline, 2px gaps, a per-bar hover tooltip, and a table view so the data
 * is never colour- or hover-only.
 */
export function ColumnChart({
  data,
  format = (v) => String(v),
  height = 160,
  label,
}: {
  data: { label: string; value: number; detail?: string }[];
  format?: (v: number) => string;
  height?: number;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const empty = data.every((d) => d.value === 0);
  return (
    <div>
      <div className="relative">
        {/* recessive gridlines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-t border-dashed border-slate-100" />
          ))}
        </div>
        <div
          className="relative flex items-end gap-0.5 border-b border-slate-200"
          style={{ height }}
          role="img"
          aria-label={label}
        >
          {data.map((d, i) => (
            <div
              key={d.label}
              className="flex h-full flex-1 items-end px-[3px]"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <motion.div
                className={clsx(
                  'w-full rounded-t-[4px] transition-colors',
                  hover === i ? 'bg-brand-700' : 'bg-brand-500',
                )}
                style={{ minHeight: d.value ? 3 : 0 }}
                initial={{ height: 0 }}
                whileInView={{ height: `${(d.value / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ))}
          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              <div className="font-semibold text-slate-300">{data[hover]!.label}</div>
              <div className="font-bold">{format(data[hover]!.value)}</div>
              {data[hover]!.detail && <div className="text-slate-400">{data[hover]!.detail}</div>}
            </div>
          )}
          {empty && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              No completed jobs yet
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex">
        {data.map((d) => (
          <div
            key={d.label}
            className="flex-1 text-center text-[11px] font-semibold text-slate-500"
          >
            {d.label}
          </div>
        ))}
      </div>
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer font-semibold hover:text-slate-700">
          Show as table
        </summary>
        <table className="mt-2 w-full">
          <tbody className="divide-y divide-slate-100">
            {data.map((d) => (
              <tr key={d.label}>
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right">{d.detail}</td>
                <td className="py-1 text-right font-semibold tabular-nums text-slate-700">
                  {format(d.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
