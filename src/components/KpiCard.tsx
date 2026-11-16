import { useState } from 'react';
import { Info } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  tooltip: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function KpiCard({ label, value, subtext, tooltip, trend = 'neutral' }: KpiCardProps) {
  const [showTip, setShowTip] = useState(false);

  const subColor =
    trend === 'up'
      ? 'text-emerald-700'
      : trend === 'down'
      ? 'text-rose-700'
      : 'text-slate-500';

  return (
    <div className="relative bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 leading-snug">{label}</span>
        <button
          type="button"
          aria-label={`Explain ${label}`}
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
          onClick={() => setShowTip((v) => !v)}
          className="text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded p-0.5 shrink-0"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-2.5 text-xl xl:text-2xl font-semibold text-slate-900 font-mono-num tracking-tight">
        {value}
      </div>

      {subtext && (
        <div className={`mt-1.5 text-xs font-medium tabular-nums ${subColor}`}>
          {subtext}
        </div>
      )}

      {showTip && (
        <div
          role="tooltip"
          className="absolute z-30 right-2 top-9 w-60 bg-slate-900 text-white text-xs leading-relaxed p-2.5 rounded-lg shadow-lg pointer-events-none"
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
