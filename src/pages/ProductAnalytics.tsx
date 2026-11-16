import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { RotateCcw, Search } from 'lucide-react';
import { FilterMetadata } from '../types/bi';
import { exportToCSV, exportToExcel, formatINR, formatNumber } from '../utils/formatters';

interface ProductAnalyticsProps {
  meta: FilterMetadata | null;
}

export function ProductAnalytics({ meta }: ProductAnalyticsProps) {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'top' | 'profitable' | 'low_margin'>('low_margin');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const qs = new URLSearchParams({ category, search });
    fetch(`/api/products?${qs.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [category, search]);

  const activeRows = !data
    ? []
    : tab === 'top'
    ? data.topSelling
    : tab === 'profitable'
    ? data.mostProfitable
    : data.lowMarginAlerts;

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[175px]">
          <label className="text-[11px] font-medium text-slate-500">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg">
            <option value="All">All Categories</option>
            {meta?.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <label className="text-[11px] font-medium text-slate-500">Search Product / Subcategory</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter SKUs by name or ID..."
              className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button type="button" onClick={() => { setCategory('All'); setSearch(''); }} className="h-9 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          {data?.allProducts && (
            <>
              <button type="button" onClick={() => exportToCSV('coastalkart_product_profitability', data.allProducts)} className="h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0">
                Export CSV
              </button>
              <button type="button" onClick={() => exportToExcel('coastalkart_products', 'Products', data.allProducts)} className="h-9 px-3 text-xs font-medium text-white bg-[#0F2942] hover:bg-[#193B5C] rounded-lg whitespace-nowrap shrink-0">
                Export Excel
              </button>
            </>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : data ? (
        <div className="space-y-5">
          {/* Category Comparison + Monthly Units Sold Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Category Revenue vs Net Profit</h2>
                <p className="text-xs text-slate-500 mt-0.5">Comparing top-line volume against realized margin by category</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categoryStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#64748B' }} width={54} />
                    <Tooltip formatter={(v: any, name: any) => [formatINR(Number(v)), name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#0F2942" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Net Profit" fill="#0D9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Monthly Units Sold by Category</h2>
                <p className="text-xs text-slate-500 mt-0.5">Demand seasonality across Grocery, Household, Electronics & Fashion</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyQtyByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} width={44} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="grocery_units" name="Grocery" stroke="#0F2942" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="household_units" name="Household" stroke="#0D9488" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="electronics_units" name="Electronics" stroke="#1D4ED8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="fashion_units" name="Fashion" stroke="#D97706" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Revenue vs Margin Matrix Scatter */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-900">SKU Profitability Matrix (Revenue vs Realized Margin %)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Bottom-right quadrant highlights high-revenue SKUs suffering margin erosion below 11%</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" dataKey="revenue" name="Revenue" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="realized_margin_pct" name="Margin %" unit="%" tick={{ fontSize: 11 }} />
                  <ZAxis type="number" dataKey="units_sold" range={[40, 260]} name="Units Sold" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(val: any, name: any) =>
                      name === 'Revenue' ? formatINR(Number(val)) : name === 'Margin %' ? `${val}%` : val
                    }
                  />
                  <Scatter name="Products" data={data.allProducts} fill="#1D4ED8" fillOpacity={0.65} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabbed Product Ranking Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Product Performance Ranking</h2>
                <p className="text-xs text-slate-500 mt-0.5">Switch between high-volume/low-margin alerts, profit leaders, and top sellers</p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTab('low_margin')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    tab === 'low_margin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  High-Sales / Low-Margin
                </button>
                <button
                  type="button"
                  onClick={() => setTab('profitable')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    tab === 'profitable' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Most Profitable
                </button>
                <button
                  type="button"
                  onClick={() => setTab('top')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    tab === 'top' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Top-Selling Units
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 pr-3 font-medium">Category · Subcategory</th>
                    <th className="py-2 pr-3 font-medium">Supplier</th>
                    <th className="py-2 px-2 font-medium text-right">Units</th>
                    <th className="py-2 px-2 font-medium text-right">Avg Disc</th>
                    <th className="py-2 px-2 font-medium text-right">Revenue</th>
                    <th className="py-2 px-2 font-medium text-right">Profit</th>
                    <th className="py-2 pl-2 font-medium text-right">Realized Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeRows.map((p: any) => (
                    <tr key={p.product_id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-medium text-slate-900">
                        {p.product_name} <span className="text-slate-400 font-mono-num">· {p.product_id}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">{p.category} · {p.subcategory}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{p.supplier_name}</td>
                      <td className="py-2.5 px-2 text-right font-mono-num">{formatNumber(p.units_sold)}</td>
                      <td className="py-2.5 px-2 text-right font-mono-num text-slate-500">{p.avg_discount_pct}%</td>
                      <td className="py-2.5 px-2 text-right font-mono-num font-medium text-slate-900">{formatINR(p.revenue)}</td>
                      <td className="py-2.5 px-2 text-right font-mono-num text-emerald-700">{formatINR(p.profit)}</td>
                      <td className={`py-2.5 pl-2 text-right font-mono-num font-semibold ${p.realized_margin_pct < 11.5 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {p.realized_margin_pct}%
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
