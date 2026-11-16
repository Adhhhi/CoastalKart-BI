import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RotateCcw } from 'lucide-react';
import { KpiCard } from '../components/KpiCard';
import { FilterMetadata } from '../types/bi';
import { exportToCSV, exportToPDF, formatINR, formatNumber } from '../utils/formatters';

interface LogisticsAnalyticsProps {
  meta: FilterMetadata | null;
}

const PARTNERS = ['CoastalExpress', 'BlueDart Regional', 'Delhivery South', 'Shadowfax Hyperlocal', 'Ecom Express'];

export function LogisticsAnalytics({ meta }: LogisticsAnalyticsProps) {
  const [city, setCity] = useState('All');
  const [partner, setPartner] = useState('All');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const qs = new URLSearchParams({ city, partner });
    fetch(`/api/logistics?${qs.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [city, partner]);

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-[11px] font-medium text-slate-500">Destination City</label>
          <select value={city} onChange={(e) => setCity(e.target.value)} className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg">
            <option value="All">All Cities</option>
            {meta?.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-[11px] font-medium text-slate-500">Delivery Partner</label>
          <select value={partner} onChange={(e) => setPartner(e.target.value)} className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg">
            <option value="All">All Partners</option>
            {PARTNERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            type="button"
            onClick={() => { setCity('All'); setPartner('All'); }}
            className="h-9 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          {data?.partnerPerformance && (
            <>
              <button
                type="button"
                onClick={() => exportToCSV('coastalkart_logistics_partners', data.partnerPerformance)}
                className="h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToPDF(
                    'coastalkart_logistics_sla',
                    'Delivery & Logistics SLA Report',
                    `City: ${city} | Partner: ${partner}`,
                    data.cityPerformance
                  )
                }
                className="h-9 px-3 text-xs font-medium text-white bg-[#0F2942] hover:bg-[#193B5C] rounded-lg whitespace-nowrap shrink-0"
              >
                PDF Report
              </button>
            </>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard
              label="On-Time Delivery Rate"
              value={`${data.kpis.on_time_rate_pct}%`}
              subtext={`${formatNumber(data.kpis.on_time_count)} of ${formatNumber(data.kpis.total_deliveries)}`}
              tooltip="Percentage of tracked shipments delivered on or before expected_delivery_date."
              trend={data.kpis.on_time_rate_pct >= 80 ? 'up' : 'down'}
            />
            <KpiCard
              label="Avg Delivery Time"
              value={`${data.kpis.avg_delivery_days} days`}
              subtext="Dispatch to doorstep"
              tooltip="Mean calendar days between dispatch_date and actual delivery_date."
            />
            <KpiCard
              label="Delayed Orders"
              value={formatNumber(data.kpis.delayed_count)}
              subtext="Missed SLA commitment"
              tooltip="Shipments delivered strictly after expected_delivery_date."
              trend="down"
            />
            <KpiCard
              label="Total Logistics Spend"
              value={formatINR(data.kpis.total_delivery_cost, true)}
              subtext={`Avg ${formatINR(data.kpis.avg_delivery_cost)} / order`}
              tooltip="Cumulative delivery partner charges across filtered shipments."
            />
            <KpiCard
              label="Order Fulfillment Rate"
              value={`${data.kpis.fulfillmentRatePct}%`}
              subtext="Completed vs Cancelled/Ret."
              tooltip="Share of all orders reaching Completed status across all branches."
              trend="up"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Delivery Partner SLA Compliance (%)</h2>
                <p className="text-xs text-slate-500 mt-0.5">On-time rate comparison across 5 3PL logistics carriers</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.partnerPerformance} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis type="category" dataKey="delivery_partner" tick={{ fontSize: 11, fill: '#334155' }} width={135} />
                    <Tooltip formatter={(v: any) => [`${v}%`, 'On-Time Rate']} />
                    <Bar dataKey="on_time_pct" fill="#0D9488" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">City-Wise Delivery Delay Hotspots (%)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Percentage of deliveries missing SLA date by destination city</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.cityPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748B' }} width={44} />
                    <Tooltip formatter={(v: any) => [`${v}%`, 'Delay Rate']} />
                    <Bar dataKey="delay_rate_pct" fill="#DC2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Carrier Scoreboard & Cost Analysis</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-left">
                      <th className="py-2 pr-3 font-medium">Partner</th>
                      <th className="py-2 px-2 font-medium text-right">Shipments</th>
                      <th className="py-2 px-2 font-medium text-right">On-Time %</th>
                      <th className="py-2 px-2 font-medium text-right">Delayed</th>
                      <th className="py-2 px-2 font-medium text-right">Avg Transit</th>
                      <th className="py-2 pl-2 font-medium text-right">Avg Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.partnerPerformance.map((p: any) => (
                      <tr key={p.delivery_partner} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-3 font-medium text-slate-900">{p.delivery_partner}</td>
                        <td className="py-2.5 px-2 text-right font-mono-num">{formatNumber(p.shipments)}</td>
                        <td className={`py-2.5 px-2 text-right font-mono-num font-medium ${p.on_time_pct >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {p.on_time_pct}%
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-num text-rose-700">{formatNumber(p.delayed)}</td>
                        <td className="py-2.5 px-2 text-right font-mono-num">{p.avg_days} d</td>
                        <td className="py-2.5 pl-2 text-right font-mono-num">{formatINR(p.avg_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Branch Order Fulfillment Rate</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-left">
                      <th className="py-2 pr-2 font-medium">City</th>
                      <th className="py-2 px-2 font-medium text-right">Completed</th>
                      <th className="py-2 px-2 font-medium text-right">Returned</th>
                      <th className="py-2 px-2 font-medium text-right">Cancelled</th>
                      <th className="py-2 pl-2 font-medium text-right">Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.fulfillmentByBranch.map((b: any) => (
                      <tr key={b.city} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-2 font-medium text-slate-900">{b.city}</td>
                        <td className="py-2.5 px-2 text-right font-mono-num">{formatNumber(b.completed_orders)}</td>
                        <td className="py-2.5 px-2 text-right font-mono-num text-amber-700">{formatNumber(b.returned_orders)}</td>
                        <td className="py-2.5 px-2 text-right font-mono-num text-rose-700">{formatNumber(b.cancelled_orders)}</td>
                        <td className="py-2.5 pl-2 text-right font-mono-num font-semibold text-emerald-700">{b.fulfillment_rate_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
