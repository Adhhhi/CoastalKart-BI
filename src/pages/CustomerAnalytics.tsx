import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FilterBar } from '../components/FilterBar';
import { KpiCard } from '../components/KpiCard';
import { FilterMetadata, GlobalFilters } from '../types/bi';
import { exportToCSV, exportToExcel, exportToPDF, formatINR, formatNumber } from '../utils/formatters';

interface CustomerAnalyticsProps {
  filters: GlobalFilters;
  meta: FilterMetadata | null;
  onFilterChange: (next: GlobalFilters) => void;
  onResetFilters: () => void;
}

const RFM_DEFINITIONS = [
  { seg: 'Champions', rule: 'R >= 4, F >= 4, M >= 4', action: 'Reward with early festive access & loyalty tier perks.' },
  { seg: 'Loyal Customers', rule: 'R >= 3, F >= 3, M >= 3', action: 'Upsell Prime membership and annual pantry bundles.' },
  { seg: 'Potential Loyalists', rule: 'Recent or mid-frequency buyers', action: 'Nurture with 2nd/3rd order category cross-sell vouchers.' },
  { seg: 'New / Promising', rule: 'R >= 4, F <= 2', action: 'Trigger 7-day onboarding UPI cashback to drive repeat order.' },
  { seg: 'At Risk', rule: 'R <= 2, F >= 3', action: 'Immediate win-back outreach; historical high-frequency buyers slipping away.' },
  { seg: 'Hibernating', rule: 'R <= 2, F <= 2', action: 'Low-cost automated seasonal reactivation campaign.' },
];

function getCohortCellColor(pct: number, offset: number): string {
  if (offset === 0) return 'bg-[#0F2942] text-white font-semibold';
  if (pct >= 28) return 'bg-blue-700 text-white';
  if (pct >= 20) return 'bg-blue-500 text-white';
  if (pct >= 14) return 'bg-blue-200 text-slate-900';
  if (pct >= 8) return 'bg-blue-100 text-slate-800';
  return 'bg-slate-100 text-slate-700';
}

export function CustomerAnalytics({ filters, meta, onFilterChange, onResetFilters }: CustomerAnalyticsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRfmSeg, setSelectedRfmSeg] = useState<string>('All');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const qs = new URLSearchParams({ ...filters });
    fetch(`/api/customers?${qs.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters]);

  const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
    if (!data?.topCustomers) return;
    if (type === 'csv') exportToCSV('coastalkart_rfm_top_customers', data.topCustomers);
    if (type === 'excel') exportToExcel('coastalkart_customer_rfm', 'RFM Top Customers', data.topCustomers);
    if (type === 'pdf') {
      exportToPDF(
        'coastalkart_customer_rfm_report',
        'Customer RFM & Retention Report',
        `Repeat Rate: ${data.summary.repeatPurchaseRatePct}% | Avg CLV: ${formatINR(data.summary.estimatedAvgClv)}`,
        data.rfmSummary
      );
    }
  };

  const visibleTopCustomers = !data?.topCustomers
    ? []
    : selectedRfmSeg === 'All'
    ? data.topCustomers
    : data.topCustomers.filter((c: any) => c.rfm_segment === selectedRfmSeg);

  return (
    <div>
      <FilterBar
        filters={filters}
        meta={meta}
        onChange={onFilterChange}
        onReset={onResetFilters}
        onExportCSV={() => handleExport('csv')}
        onExportExcel={() => handleExport('excel')}
        onExportPDF={() => handleExport('pdf')}
        searchPlaceholder="Search customer name..."
      />

      {loading && !data ? (
        <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Active Customers"
              value={formatNumber(data.summary.activeCustomers)}
              subtext={`${formatNumber(data.summary.repeatCustomers)} repeat buyers`}
              tooltip="Distinct customers with at least 1 Completed order matching active filters."
            />
            <KpiCard
              label="Repeat Purchase Rate"
              value={`${data.summary.repeatPurchaseRatePct}%`}
              subtext="2+ distinct orders"
              tooltip="Percentage of active customers who placed 2 or more Completed orders."
              trend="up"
            />
            <KpiCard
              label="Repeat Revenue Share"
              value={`${data.summary.repeatRevenueSharePct}%`}
              subtext="Revenue from retained base"
              tooltip="Share of total completed revenue contributed by repeat customers (2+ orders)."
              trend="up"
            />
            <KpiCard
              label="Estimated Avg CLV"
              value={formatINR(data.summary.estimatedAvgClv)}
              subtext="12-month realized value"
              tooltip="Average cumulative completed revenue per active customer over the 12-month window."
            />
          </div>

          {/* RFM Segment Revenue + New vs Returning Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">RFM Segment Revenue & Customer Count</h2>
                <p className="text-xs text-slate-500 mt-0.5">Quintile scoring (1–5) on Recency, Frequency, and Monetary spend</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.rfmSummary}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="segment" tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748B' }} width={54} />
                    <Tooltip formatter={(v: any, name: any) => [name === 'Revenue' ? formatINR(Number(v)) : formatNumber(Number(v)), name]} />
                    <Bar dataKey="revenue" name="Revenue" fill="#0F2942" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">New vs Returning Buyers by Month</h2>
                <p className="text-xs text-slate-500 mt-0.5">First-time buyers vs retained repeat customers per month</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.newVsReturning}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} width={44} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="returning_customers" name="Returning" stackId="a" fill="#0D9488" />
                    <Bar dataKey="new_customers" name="New Buyers" stackId="a" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Monthly Customer Retention Cohort Matrix */}
          {data.cohortMatrix && data.cohortMatrix.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Monthly Customer Retention Cohort Matrix (%)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Percentage of each acquisition month cohort returning to purchase in subsequent months (M0 = acquisition month)
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-mono-num">{data.cohortMatrix.length} monthly cohorts</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-left">
                      <th className="py-2 pr-3 font-medium whitespace-nowrap">Cohort</th>
                      <th className="py-2 px-2 font-medium text-right whitespace-nowrap">Buyers</th>
                      {Array.from({ length: 12 }, (_, m) => (
                        <th key={m} className="py-2 px-1.5 font-medium text-center font-mono-num">M{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.cohortMatrix.map((row: any) => (
                      <tr key={row.cohortMonth}>
                        <td className="py-1.5 pr-3 font-mono-num font-medium text-slate-900 whitespace-nowrap">{row.cohortMonth}</td>
                        <td className="py-1.5 px-2 text-right font-mono-num text-slate-600">{formatNumber(row.cohortSize)}</td>
                        {row.months.map((cell: { pct: number; count: number } | null, idx: number) => (
                          <td key={idx} className="p-1 text-center">
                            {cell ? (
                              <div
                                title={`${row.cohortMonth} · Month +${idx}: ${cell.count} retained customers (${cell.pct}%)`}
                                className={`py-1 px-1.5 rounded text-[11px] font-mono-num ${getCohortCellColor(cell.pct, idx)}`}
                              >
                                {cell.pct}%
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[11px]">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Purchase Frequency & Customer Segment Mix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Customer Purchase Frequency Distribution</h2>
                <p className="text-xs text-slate-500 mt-0.5">Count of customers by total completed orders</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.frequencyDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} width={45} />
                    <Tooltip />
                    <Bar dataKey="customers" name="Customers" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-900">RFM Segment Playbook & Metrics</h2>
                <p className="text-xs text-slate-500 mt-0.5">Click any segment row to filter the Top Customers leaderboard below</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-left">
                      <th className="py-2 pr-2 font-medium">Segment</th>
                      <th className="py-2 px-2 font-medium text-right">Buyers</th>
                      <th className="py-2 px-2 font-medium text-right">Avg Recency</th>
                      <th className="py-2 px-2 font-medium text-right">Avg Freq</th>
                      <th className="py-2 pl-2 font-medium text-right">Avg CLV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rfmSummary.map((r: any) => {
                      const isSel = selectedRfmSeg === r.segment;
                      return (
                        <tr
                          key={r.segment}
                          onClick={() => setSelectedRfmSeg((prev) => (prev === r.segment ? 'All' : r.segment))}
                          className={`cursor-pointer transition-colors ${isSel ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="py-2 pr-2 font-medium text-slate-900">{r.segment}</td>
                          <td className="py-2 px-2 text-right font-mono-num">{formatNumber(r.customers)}</td>
                          <td className="py-2 px-2 text-right font-mono-num text-slate-600">{r.avgRecency} d</td>
                          <td className="py-2 px-2 text-right font-mono-num">{r.avgFrequency}x</td>
                          <td className="py-2 pl-2 text-right font-mono-num font-medium text-slate-900">{formatINR(r.avgClv)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RFM Explanation Guide */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">RFM Cohort Definitions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {RFM_DEFINITIONS.map((item) => (
                <div key={item.seg} className="pt-2 border-t border-slate-200">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">{item.seg}</span>
                    <span className="text-[11px] font-mono-num text-slate-500">{item.rule}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top 50 Customers by Revenue */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Top Customers by Lifetime Revenue {selectedRfmSeg !== 'All' ? `· ${selectedRfmSeg}` : ''}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Individual RFM scores (R-F-M) and segment assignment</p>
              </div>
              {selectedRfmSeg !== 'All' && (
                <button
                  type="button"
                  onClick={() => setSelectedRfmSeg('All')}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Show All Segments
                </button>
              )}
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">City</th>
                    <th className="py-2 pr-3 font-medium">Account Type</th>
                    <th className="py-2 pr-3 font-medium">RFM Segment</th>
                    <th className="py-2 px-2 font-medium text-right">RFM</th>
                    <th className="py-2 px-2 font-medium text-right">Recency</th>
                    <th className="py-2 px-2 font-medium text-right">Orders</th>
                    <th className="py-2 pl-2 font-medium text-right">Total Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleTopCustomers.map((c: any) => (
                    <tr key={c.customer_id} className="hover:bg-slate-50">
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {c.customer_name} <span className="text-slate-400 font-mono-num font-normal">· {c.customer_id}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{c.city}</td>
                      <td className="py-2 pr-3 text-slate-600">{c.customer_segment}</td>
                      <td className="py-2 pr-3 font-medium text-[#0F2942]">{c.rfm_segment}</td>
                      <td className="py-2 px-2 text-right font-mono-num text-slate-700">{c.rfm_code}</td>
                      <td className="py-2 px-2 text-right font-mono-num text-slate-500">{c.recency_days}d</td>
                      <td className="py-2 px-2 text-right font-mono-num">{c.frequency}</td>
                      <td className="py-2 pl-2 text-right font-mono-num font-medium text-slate-900">{formatINR(c.monetary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
