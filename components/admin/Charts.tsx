"use client";

import { useState } from "react";

/**
 * Lightweight SVG/HTML charts (no chart library).
 * Colors: categorical slots 1/2 of the validated default palette; offer charts use
 * each offer's own wheel color so an offer keeps the same color everywhere.
 */
export const SERIES = ["#2a78d6", "#eb6834"];

interface Series {
  key: string;
  label: string;
  color: string;
}

export function GroupedBarChart<T extends Record<string, string | number>>({
  data,
  xKey,
  series,
  formatX = (v) => String(v),
  height = 200,
}: {
  data: T[];
  xKey: keyof T;
  series: Series[];
  formatX?: (v: string | number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];

  return (
    <div className="w-full">
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative flex" style={{ height }}>
        {/* y axis */}
        <div className="relative w-8 shrink-0 text-[10px] text-slate-400">
          {ticks.map((t) => (
            <span key={t} className="absolute right-1 leading-none" style={{ bottom: `calc(${(t / top) * 100}% - 5px)` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px] border-b border-slate-300">
            {data.map((d, i) => (
              <div
                key={i}
                className={`relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm ${hover === i ? "bg-slate-50" : ""}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              >
                {series.map((s) => {
                  const v = Number(d[s.key]) || 0;
                  return (
                    <div
                      key={s.key}
                      className="w-full max-w-[14px] rounded-t-[4px]"
                      style={{ height: `${(v / top) * 100}%`, minHeight: v > 0 ? 2 : 0, background: s.color }}
                    />
                  );
                })}
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
                    <div className="font-semibold">{formatX(d[xKey])}</div>
                    {series.map((s) => (
                      <div key={s.key} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                        {s.label}: <b>{d[s.key]}</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-8 mt-1 flex gap-[2px] text-[10px] text-slate-400">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center">
            {i % Math.ceil(data.length / 7) === 0 ? formatX(d[xKey]) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBarChart({
  data,
  emptyLabel = "No data yet",
  valueSuffix = "",
}: {
  data: { label: string; value: number; color?: string; sub?: string }[];
  emptyLabel?: string;
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="py-6 text-center text-sm text-slate-400">{emptyLabel}</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={i} title={`${d.label}: ${d.value}${valueSuffix}`}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate text-slate-700">{d.label}</span>
            <span className="shrink-0 font-semibold text-slate-900">
              {d.value}
              {valueSuffix}
              {d.sub && <span className="ml-1 font-normal text-slate-400">{d.sub}</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 4 : 0, background: d.color ?? SERIES[0] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function niceTicks(max: number): number[] {
  const step = max <= 5 ? 1 : max <= 10 ? 2 : Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : 1);
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let t = 0; t <= top; t += step) out.push(t);
  return out;
}
