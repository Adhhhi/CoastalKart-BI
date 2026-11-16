import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FilterBar } from '../components/FilterBar';
import { FilterMetadata, GlobalFilters } from '../types/bi';
import { exportToCSV, exportToExcel, exportToPDF, formatINR, formatNumber } from '../utils/formatters';

interface SalesAnalyticsProps {
  filters: GlobalFilters;
  meta: FilterMetadata | null;
  onFilterChange: (next: GlobalFilters) => void;
  onResetFilters: () => void;
}

export function SalesAnalytics({ filters, meta, onFilterChange, onResetFilters }: SalesAnalyticsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<'daily' | 'monthly'>('monthly');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const qs = new URLSearchParams({ ...filters });
    fetch(`/api/sales?${qs.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters]);

  const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
    if (!data?.ledger) return;
    if (type === 'csv') exportToCSV('coastalkart_sales_ledger', data.ledger);
    if (type === 'excel') exportToExcel('coastalkart_sales_analytics', 'Transactions', data.ledger);
    if (type === 'pdf') {
      exportToPDF(
        'coastalkart_sales_report',
        'Sales & Branch Ranking Report',
        `City: ${filters.city} | Category: ${filters.category} | Payment: ${filters.paymentMethod}`,
        data.branchRanking
      );
    }
  };

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
      />

      {loading && !data ? (
        <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : data ? (
        <div className="space-y-5">
          {/* Granularity Toggle + Trend Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {granularity === 'daily' ? 'Daily Sales Trajectory' : 'Monthly Sales & MoM Growth (%)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Interactive revenue analysis across filtered branches, categories, and payment channels
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setGranularity('monthly')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    granularity === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly Growth
                </button>
                <button
                  type="button"
                  onClick={() => setGranularity('daily')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    granularity === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Daily Sales
                </button>
              </div>
            </div>

            {data.dailyTrend.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No sales data found for current filters.</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {granularity === 'daily' ? (
                    <AreaChart data={data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="date_display" tick={{ fontSize: 10, fill: '#64748B' }} minTickGap={24} />
                      <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#64748B' }} width={54} />
                      <Tooltip formatter={(v: any) => [formatINR(Number(v)), 'Daily Revenue']} />
                      <Area type="monotone" dataKey="revenue" stroke="#0F2942" fill="#0F2942" fillOpacity={0.12} strokeWidth={1.8} />
                    </AreaChart>
                  ) : (
                    <ComposedChart data={data.monthlyGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis yAxisId="left" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748B' }} width={54} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#0D9488' }} width={44} />
                      <Tooltip
                        formatter={(v: any, name: any) =>
                          name === 'MoM Growth %' ? [`${v ?? 0}%`, name] : [formatINR(Number(v)), name]
                        }
                      />
                      <Bar yAxisId="left" dataKey="revenue" name="Monthly Revenue" fill="#0F2942" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="growth_pct" name="MoM Growth %" stroke="#0D9488" strokeWidth={2.2} dot={{ r: 3 }} />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Discount Impact & Payment Method Mix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Discount Band Analysis</h2>
                <p className="text-xs text-slate-500 mt-0.5">How discounting impacts revenue volume vs realized margin %</p>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.discountAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="discount_band" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis yAxisId="rev" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748B' }} width={52} />
                    <YAxis yAxisId="mrg" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#D97706' }} width={42} />
                    <Tooltip />
                    <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="mrg" type="monotone" dataKey="margin_pct" name="Margin %" stroke="#D97706" strokeWidth={2.4} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Payment Channel Revenue Mix</h2>
                <p className="text-xs text-slate-500 mt-0.5">UPI, Cards, Net Banking, and Cash on Delivery distribution</p>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.paymentMix} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis type="category" dataKey="payment_method" tick={{ fontSize: 11, fill: '#334155' }} width={115} />
                    <Tooltip formatter={(v: any) => [formatINR(Number(v)), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#0D9488" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Branch Performance Ranking */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">Branch Performance Ranking</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ranked by net completed revenue using SQL window RANK()</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="py-2.5 pr-3 font-medium">Rank</th>
                    <th className="py-2.5 pr-3 font-medium">Branch</th>
                    <th className="py-2.5 pr-3 font-medium">City · Region</th>
                    <th className="py-2.5 px-3 font-medium text-right">Orders</th>
                    <th className="py-2.5 px-3 font-medium text-right">Units</th>
                    <th className="py-2.5 px-3 font-medium text-right">AOV</th>
                    <th className="py-2.5 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2.5 px-3 font-medium text-right">Net Profit</th>
                    <th className="py-2.5 pl-3 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.branchRanking.map((b: any) => (
                    <tr key={b.branch_id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono-num font-semibold text-slate-800">#{b.rank}</td>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{b.branch_name}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{b.city} · {b.region}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num">{formatNumber(b.orders)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num">{formatNumber(b.units_sold)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num">{formatINR(b.aov)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-medium text-slate-900">{formatINR(b.revenue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700">{formatINR(b.profit)}</td>
                      <td className="py-2.5 pl-3 text-right font-mono-num">{b.margin_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction Ledger */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Transaction Ledger</h2>
                <p className="text-xs text-slate-500 mt-0.5">Latest 250 matching invoices (DD-MM-YYYY · INR ₹ · GST included)</p>
              </div>
              <span className="text-xs font-mono-num text-slate-500">{data.ledger.length} rows shown</span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="py-2 pr-3 font-medium">Invoice</th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">City</th>
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 px-2 font-medium text-right">Qty</th>
                    <th className="py-2 px-2 font-medium text-right">Disc</th>
                    <th className="py-2 px-2 font-medium text-right">Revenue</th>
                    <th className="py-2 px-2 font-medium">Payment</th>
                    <th className="py-2 pl-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.ledger.map((row: any) => (
                    <tr key={row.invoice_id} className="hover:bg-slate-50">
                      <td className="py-2 pr-3 font-mono-num text-slate-700 whitespace-nowrap">{row.invoice_id}</td>
                      <td className="py-2 pr-3 font-mono-num text-slate-600 whitespace-nowrap">{row.order_date}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.city}</td>
                      <td className="py-2 pr-3 text-slate-800">{row.customer_name}</td>
                      <td className="py-2 pr-3 text-slate-900 max-w-[220px] truncate">{row.product_name}</td>
                      <td className="py-2 px-2 text-right font-mono-num">{row.quantity}</td>
                      <td className="py-2 px-2 text-right font-mono-num text-slate-500">{row.discount_pct}%</td>
                      <td className="py-2 px-2 text-right font-mono-num font-medium text-slate-900">{formatINR(row.revenue)}</td>
                      <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{row.payment_method}</td>
                      <td className={`py-2 pl-2 font-medium whitespace-nowrap ${
                        row.order_status === 'Completed'
                          ? 'text-emerald-700'
                          : row.order_status === 'Returned'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}>
                        {row.order_status}
                      </td>
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
