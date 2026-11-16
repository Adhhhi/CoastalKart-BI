import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FilterBar } from '../components/FilterBar';
import { KpiCard } from '../components/KpiCard';
import { FilterMetadata, GlobalFilters } from '../types/bi';
import { exportToCSV, exportToExcel, exportToPDF, formatINR, formatNumber } from '../utils/formatters';

interface ExecutiveOverviewProps {
  filters: GlobalFilters;
  meta: FilterMetadata | null;
  onFilterChange: (next: GlobalFilters) => void;
  onResetFilters: () => void;
  refreshTick: number;
}

const CHART_NAVY = '#0F2942';
const CHART_BLUE = '#1D4ED8';
const CHART_TEAL = '#0D9488';
const CHART_AMBER = '#D97706';

export function ExecutiveOverview({
  filters,
  meta,
  onFilterChange,
  onResetFilters,
  refreshTick,
}: ExecutiveOverviewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      city: filters.city,
      branchId: filters.branchId,
      category: filters.category,
      paymentMethod: filters.paymentMethod,
      search: filters.search,
    });
    fetch(`/api/overview?${qs.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setData(res);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Failed to load executive metrics');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters, refreshTick]);

  const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
    if (!data?.branchPerformance) return;
    if (type === 'csv') exportToCSV('coastalkart_executive_branches', data.branchPerformance);
    if (type === 'excel') exportToExcel('coastalkart_executive_report', 'Branch Performance', data.branchPerformance);
    if (type === 'pdf') {
      exportToPDF(
        'coastalkart_executive_summary',
        'Executive Overview',
        `Period: ${filters.startDate || 'All'} to ${filters.endDate || 'All'}`,
        data.branchPerformance,
        [
          { label: 'Revenue', value: formatINR(data.kpis.totalRevenue, true) },
          { label: 'Profit', value: formatINR(data.kpis.totalProfit, true) },
          { label: 'Orders', value: formatNumber(data.kpis.totalOrders) },
          { label: 'Margin', value: `${data.kpis.profitMarginPct}%` },
        ]
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

      {error && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* 7 Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
            <KpiCard
              label="Total Revenue"
              value={formatINR(data.kpis.totalRevenue, true)}
              subtext={formatINR(data.kpis.totalRevenue)}
              tooltip="Sum of net revenue (gross minus discount) across all Completed orders."
              trend="up"
            />
            <KpiCard
              label="Total Profit"
              value={formatINR(data.kpis.totalProfit, true)}
              subtext={formatINR(data.kpis.totalProfit)}
              tooltip="Net profit after deducting GST and cost of goods sold on Completed orders."
              trend="up"
            />
            <KpiCard
              label="Total Orders"
              value={formatNumber(data.kpis.totalOrders)}
              subtext="Distinct order IDs"
              tooltip="Total distinct customer orders placed across selected branches and dates."
            />
            <KpiCard
              label="Active Customers"
              value={formatNumber(data.kpis.activeCustomers)}
              subtext="Unique buyers"
              tooltip="Unique customers who placed at least one transaction matching current filters."
            />
            <KpiCard
              label="Avg Order Value"
              value={formatINR(data.kpis.averageOrderValue)}
              subtext="Per completed order"
              tooltip="Completed Revenue divided by Completed Distinct Orders."
            />
            <KpiCard
              label="Profit Margin"
              value={`${data.kpis.profitMarginPct}%`}
              subtext="Net after GST & COGS"
              tooltip="(Total Net Profit / Total Completed Revenue) × 100."
              trend={data.kpis.profitMarginPct >= 18 ? 'up' : 'neutral'}
            />
            <KpiCard
              label="Revenue Growth"
              value={`${data.kpis.revenueGrowthPct > 0 ? '+' : ''}${data.kpis.revenueGrowthPct}%`}
              subtext="Latest MoM change"
              tooltip="Percentage change in revenue between the final two months in the filtered range."
              trend={data.kpis.revenueGrowthPct >= 0 ? 'up' : 'down'}
            />
          </div>

          {data.monthlyTrend.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-sm font-medium text-slate-800">No transactions match the active filter combination.</p>
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-3 px-4 py-2 text-xs font-medium text-white bg-[#0F2942] rounded-lg"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Row 1: Monthly Revenue Trend & Monthly Profit Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Monthly Revenue Trend</h2>
                      <p className="text-xs text-slate-500 mt-0.5">12-month completed net sales trajectory (INR)</p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono-num">{data.monthlyTrend.length} months</span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.monthlyTrend}>
                        <defs>
                          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.22} />
                            <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748B' }} width={56} />
                        <Tooltip formatter={(val: any) => [formatINR(Number(val)), 'Revenue']} />
                        <Area type="monotone" dataKey="revenue" stroke={CHART_BLUE} strokeWidth={2.2} fill="url(#revFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Monthly Profit Trend</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Net contribution after GST & COGS (INR)</p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono-num">Avg Margin {data.kpis.profitMarginPct}%</span>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} tick={{ fontSize: 11, fill: '#64748B' }} width={58} />
                        <Tooltip formatter={(val: any) => [formatINR(Number(val)), 'Net Profit']} />
                        <Line type="monotone" dataKey="profit" stroke={CHART_TEAL} strokeWidth={2.4} dot={{ r: 3, fill: CHART_TEAL }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Row 2: Revenue by Branch & Revenue by Category */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">Revenue & Profit by Branch</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Regional hub comparison across Karnataka & Kerala</p>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.branchPerformance} barGap={6}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#475569' }} />
                        <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748B' }} width={56} />
                        <Tooltip formatter={(val: any, name: any) => [formatINR(Number(val)), name]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="revenue" name="Revenue" fill={CHART_NAVY} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="profit" name="Net Profit" fill={CHART_TEAL} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">Revenue by Product Category</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Category contribution and realized profit margin</p>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.categoryPerformance} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748B' }} />
                        <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#334155' }} width={145} />
                        <Tooltip formatter={(val: any) => [formatINR(Number(val)), 'Revenue']} />
                        <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                          {data.categoryPerformance.map((_: any, idx: number) => (
                            <Cell key={idx} fill={[CHART_NAVY, CHART_BLUE, CHART_TEAL, CHART_AMBER][idx % 4]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Row 3: Top 10 Products & Sales Performance Comparison Table */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-slate-900">Top 10 Products by Revenue</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Highest revenue SKUs with units sold and realized margin</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-left">
                          <th className="py-2.5 pr-3 font-medium">Product</th>
                          <th className="py-2.5 pr-3 font-medium">Category</th>
                          <th className="py-2.5 px-3 font-medium text-right">Units</th>
                          <th className="py-2.5 px-3 font-medium text-right">Revenue</th>
                          <th className="py-2.5 pl-3 font-medium text-right">Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.topProducts.map((p: any) => (
                          <tr key={p.product_id} className="hover:bg-slate-50/80">
                            <td className="py-2.5 pr-3 font-medium text-slate-900">{p.product_name}</td>
                            <td className="py-2.5 pr-3 text-slate-500">{p.category}</td>
                            <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">{formatNumber(p.units_sold)}</td>
                            <td className="py-2.5 px-3 text-right font-mono-num font-medium text-slate-900">{formatINR(p.revenue)}</td>
                            <td className={`py-2.5 pl-3 text-right font-mono-num font-medium ${p.margin_pct < 12 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {p.margin_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="mb-4">
                      <h2 className="text-sm font-semibold text-slate-900">Branch Performance Comparison</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Orders, net revenue, and margin % per operational hub</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 text-left">
                            <th className="py-2 pr-2 font-medium">City</th>
                            <th className="py-2 px-2 font-medium text-right">Orders</th>
                            <th className="py-2 px-2 font-medium text-right">Revenue</th>
                            <th className="py-2 pl-2 font-medium text-right">Margin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.branchPerformance.map((b: any) => {
                            const isFilteredCity = filters.city === b.city;
                            return (
                              <tr
                                key={b.branch_id}
                                onClick={() =>
                                  onFilterChange({
                                    ...filters,
                                    city: isFilteredCity ? 'All' : b.city,
                                  })
                                }
                                title="Click to filter dashboard by this city"
                                className={`cursor-pointer transition-colors ${isFilteredCity ? 'bg-blue-50' : 'hover:bg-slate-50/80'}`}
                              >
                                <td className="py-2.5 pr-2 font-medium text-slate-900">
                                  {b.city} <span className="text-slate-400 font-normal">· {b.branch_id}</span>
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono-num text-slate-700">{formatNumber(b.orders)}</td>
                                <td className="py-2.5 px-2 text-right font-mono-num font-medium text-slate-900">{formatINR(b.revenue, true)}</td>
                                <td className="py-2.5 pl-2 text-right font-mono-num text-emerald-700">{b.margin_pct}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-200">
                    <div className="text-xs font-medium text-slate-700 mb-2">Order Fulfillment Mix</div>
                    <div className="grid grid-cols-3 gap-3">
                      {data.statusBreakdown.map((s: any) => (
                        <div key={s.order_status} className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/80">
                          <div className="text-[11px] text-slate-500">{s.order_status}</div>
                          <div className="text-sm font-semibold text-slate-900 font-mono-num mt-0.5">{formatNumber(s.orders)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
