import { useEffect, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { exportToPDF, formatINR } from '../utils/formatters';

export function BusinessInsights() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/insights')
      .then((r) => r.json())
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Automated Management Insights & Revenue Forecast</h2>
          <p className="text-xs text-slate-500 mt-1">
            All observations below are dynamically computed from live SQLite tables—never hardcoded.
          </p>
        </div>
        {data && (
          <button
            type="button"
            onClick={() =>
              exportToPDF(
                'coastalkart_executive_insights',
                'Executive Insights & Recommendations',
                `Model: ${data.forecast.modelName} | R² = ${data.forecast.r2Score}`,
                data.insights.map((i: any) => ({
                  domain: i.domain,
                  finding: i.title,
                  metric: i.metric,
                  recommendation: i.recommendation,
                }))
              )
            }
            className="h-9 px-4 text-xs font-medium text-white bg-[#0F2942] hover:bg-[#193B5C] rounded-lg whitespace-nowrap shrink-0"
          >
            Download Executive PDF
          </button>
        )}
      </div>

      {/* Dynamic Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data?.insights.map((ins: any) => {
          const Icon = ins.status === 'nominal' ? CheckCircle2 : ins.status === 'warning' ? TrendingUp : AlertTriangle;
          const iconColor =
            ins.status === 'nominal' ? 'text-emerald-700' : ins.status === 'warning' ? 'text-amber-700' : 'text-rose-700';

          return (
            <div key={ins.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                    {ins.domain}
                  </span>
                  <span className="font-mono-num font-semibold text-slate-900">{ins.metric}</span>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 mt-2.5 leading-snug">{ins.title}</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{ins.observation}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-[#0F2942]">Recommended Action</div>
                <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{ins.recommendation}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly Sales Forecasting */}
      {data?.forecast && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">4-Month Revenue Forecast vs Actuals (INR)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.forecast.modelName} · Dotted curve indicates forecasted projection & shaded band shows 90% uncertainty interval
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono-num text-slate-600">
              <span>Trend Slope: +{formatINR(data.forecast.monthlySlopeInr)}/mo</span>
              <span>·</span>
              <span>Model R²: {data.forecast.r2Score}</span>
              <span>·</span>
              <span>RMSE: {formatINR(data.forecast.rmseInr)}</span>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.forecast.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748B' }} width={56} />
                <Tooltip
                  formatter={(val: any, name: any) =>
                    val == null ? ['—', name] : [formatINR(Number(val)), name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="upperBound" name="Upper 90% Bound" stroke="none" fill="#93C5FD" fillOpacity={0.25} />
                <Area type="monotone" dataKey="lowerBound" name="Lower 90% Bound" stroke="none" fill="#FFFFFF" fillOpacity={1} />
                <Line type="monotone" dataKey="actualRevenue" name="Actual Revenue" stroke="#0F2942" strokeWidth={2.5} dot={{ r: 3.5 }} />
                <Line type="monotone" dataKey="movingAvg3m" name="3M Moving Average" stroke="#0D9488" strokeWidth={1.8} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="forecastRevenue" name="Forecast Revenue (Projected)" stroke="#1D4ED8" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4, fill: '#1D4ED8' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
