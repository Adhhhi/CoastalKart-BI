import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { ArrowUpDown, Download, RotateCcw, Search } from 'lucide-react';
import { KpiCard } from '../components/KpiCard';
import { FilterMetadata } from '../types/bi';
import { exportToCSV, exportToExcel, formatINR, formatNumber } from '../utils/formatters';

interface InventoryAnalyticsProps {
  meta: FilterMetadata | null;
}

const STATUS_TABS = ['All', 'Out of Stock', 'Low Stock', 'Overstocked', 'Optimal'] as const;

export function InventoryAnalytics({ meta }: InventoryAnalyticsProps) {
  const [city, setCity] = useState('All');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [supSortKey, setSupSortKey] = useState<'total_revenue' | 'lead_time' | 'supplier_rating' | 'stock_alert_slots'>('total_revenue');
  const [supSortAsc, setSupSortAsc] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const qs = new URLSearchParams({ city, category, status, search });
    fetch(`/api/inventory?${qs.toString()}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [city, category, status, search]);

  const reset = () => {
    setCity('All');
    setCategory('All');
    setStatus('All');
    setSearch('');
  };

  const sortedSuppliers = useMemo(() => {
    if (!data?.supplierScorecard) return [];
    return [...data.supplierScorecard].sort((a, b) => {
      const diff = Number(a[supSortKey]) - Number(b[supSortKey]);
      return supSortAsc ? diff : -diff;
    });
  }, [data?.supplierScorecard, supSortKey, supSortAsc]);

  const toggleSort = (key: typeof supSortKey) => {
    if (supSortKey === key) {
      setSupSortAsc((v) => !v);
    } else {
      setSupSortKey(key);
      setSupSortAsc(key === 'lead_time');
    }
  };

  return (
    <div>
      {/* Inventory Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[135px]">
          <label className="text-[11px] font-medium text-slate-500">Branch City</label>
          <select value={city} onChange={(e) => setCity(e.target.value)} className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg">
            <option value="All">All Cities</option>
            {meta?.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[165px]">
          <label className="text-[11px] font-medium text-slate-500">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg">
            <option value="All">All Categories</option>
            {meta?.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[11px] font-medium text-slate-500">Search SKU / Supplier</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU ID, product, supplier..."
              className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button type="button" onClick={reset} className="h-9 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          {data?.reorderQueue && (
            <>
              <button type="button" onClick={() => exportToCSV('coastalkart_inventory_alerts', data.reorderQueue)} className="h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button type="button" onClick={() => exportToExcel('coastalkart_inventory', 'Inventory', data.reorderQueue)} className="h-9 px-3 text-xs font-medium text-white bg-[#0F2942] hover:bg-[#193B5C] rounded-lg whitespace-nowrap shrink-0">
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard
              label="Total Stock Value"
              value={formatINR(data.kpis.totalStockValue, true)}
              subtext="At landed cost price"
              tooltip="Sum of (stock_quantity × cost_price) across filtered SKU-branch positions."
            />
            <KpiCard
              label="Inventory Turnover"
              value={`${data.kpis.turnoverRatio}x`}
              subtext="Annual COGS / Stock Value"
              tooltip="Total annual Cost of Goods Sold divided by current inventory holding cost."
              trend="up"
            />
            <KpiCard
              label="Out of Stock Slots"
              value={formatNumber(data.kpis.outOfStockCount)}
              subtext="Immediate lost-sales risk"
              tooltip="Number of SKU-branch combinations with 0 units on hand."
              trend="down"
            />
            <KpiCard
              label="Low Stock Alerts"
              value={formatNumber(data.kpis.lowStockCount)}
              subtext="At or below reorder point"
              tooltip="Number of SKU-branch slots where stock_quantity <= reorder_level."
              trend="down"
            />
            <KpiCard
              label="Overstocked Slots"
              value={formatNumber(data.kpis.overstockedCount)}
              subtext=">5x reorder threshold"
              tooltip="Excess stock tying up working capital; candidates for inter-branch transfer."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Branch-Wise Stock Health Distribution</h2>
                <p className="text-xs text-slate-500 mt-0.5">SKU counts by inventory status across all 6 locations</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.branchStock}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} width={44} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="optimal" name="Optimal" fill="#0D9488" />
                    <Bar dataKey="low_stock" name="Low Stock" fill="#D97706" />
                    <Bar dataKey="out_of_stock" name="Out of Stock" fill="#DC2626" />
                    <Bar dataKey="overstocked" name="Overstocked" fill="#1D4ED8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Supplier Lead Time vs Rating */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Supplier Reliability Matrix (Lead Time vs Rating)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Bubble size represents annual fulfilled revenue across 30 active suppliers</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" dataKey="lead_time" name="Lead Time" unit="d" domain={[1, 11]} tick={{ fontSize: 11 }} />
                    <YAxis type="number" dataKey="supplier_rating" name="Rating" domain={[3.2, 5]} tick={{ fontSize: 11 }} width={36} />
                    <ZAxis type="number" dataKey="total_revenue" range={[50, 320]} name="Revenue" />
                    <Tooltip
                      formatter={(val: any, name: any) =>
                        name === 'Revenue' ? formatINR(Number(val)) : name === 'Lead Time' ? `${val} days` : val
                      }
                    />
                    <Scatter name="Suppliers" data={data.supplierScorecard || []} fill="#0F2942" fillOpacity={0.75} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Reorder Recommendations Table with 1-Click Status Tabs */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Replenishment & Reorder Recommendations</h2>
                <p className="text-xs text-slate-500 mt-0.5">Filter by stock health status to triage urgent purchase orders</p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                {STATUS_TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setStatus(t)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      status === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="py-2 pr-3 font-medium">City</th>
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 px-2 font-medium text-right">Stock</th>
                    <th className="py-2 px-2 font-medium text-right">Reorder Lvl</th>
                    <th className="py-2 px-2 font-medium text-right">Annual Sold</th>
                    <th className="py-2 pr-3 font-medium">Supplier · Lead</th>
                    <th className="py-2 px-2 font-medium text-right">Rec. PO Qty</th>
                    <th className="py-2 pl-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.reorderQueue.map((row: any) => (
                    <tr key={`${row.city}-${row.product_id}`} className="hover:bg-slate-50">
                      <td className="py-2 pr-3 font-medium text-slate-800">{row.city}</td>
                      <td className="py-2 pr-3 text-slate-900">
                        {row.product_name} <span className="text-slate-400 font-mono-num">· {row.product_id}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{row.category}</td>
                      <td className="py-2 px-2 text-right font-mono-num font-medium">{row.stock_quantity}</td>
                      <td className="py-2 px-2 text-right font-mono-num text-slate-500">{row.reorder_level}</td>
                      <td className="py-2 px-2 text-right font-mono-num">{formatNumber(row.annual_units_sold)}</td>
                      <td className="py-2 pr-3 text-slate-600">{row.supplier_name} · {row.lead_time}d</td>
                      <td className="py-2 px-2 text-right font-mono-num font-semibold text-[#0F2942]">{row.recommended_reorder_qty}</td>
                      <td className={`py-2 pl-2 font-medium whitespace-nowrap ${
                        row.stock_status === 'Out of Stock'
                          ? 'text-rose-700'
                          : row.stock_status === 'Low Stock'
                          ? 'text-amber-700'
                          : row.stock_status === 'Overstocked'
                          ? 'text-blue-700'
                          : 'text-emerald-700'
                      }`}>
                        {row.stock_status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sortable Supplier Performance Scorecard */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Supplier Performance Leaderboard (30 Vendors)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Click column headers to sort by Lead Time, Rating, Stock Alerts, or Revenue</p>
              </div>
              <button
                type="button"
                onClick={() => exportToCSV('coastalkart_supplier_scorecard', sortedSuppliers)}
                className="h-8 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0"
              >
                Export Suppliers CSV
              </button>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="py-2 pr-3 font-medium">Supplier</th>
                    <th className="py-2 pr-3 font-medium">Location · Category</th>
                    <th className="py-2 px-2 font-medium text-right">SKUs</th>
                    <th className="py-2 px-2 font-medium text-right">
                      <button type="button" onClick={() => toggleSort('lead_time')} className="inline-flex items-center gap-1 hover:text-slate-900">
                        Lead Time <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      <button type="button" onClick={() => toggleSort('supplier_rating')} className="inline-flex items-center gap-1 hover:text-slate-900">
                        Rating <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      <button type="button" onClick={() => toggleSort('stock_alert_slots')} className="inline-flex items-center gap-1 hover:text-slate-900">
                        Alert Slots <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2 pl-2 font-medium text-right">
                      <button type="button" onClick={() => toggleSort('total_revenue')} className="inline-flex items-center gap-1 hover:text-slate-900">
                        Revenue <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSuppliers.map((s: any) => (
                    <tr key={s.supplier_id} className="hover:bg-slate-50">
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {s.supplier_name} <span className="text-slate-400 font-mono-num">· {s.supplier_id}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{s.supplier_location} · {s.product_category}</td>
                      <td className="py-2 px-2 text-right font-mono-num">{s.active_skus}</td>
                      <td className={`py-2 px-2 text-right font-mono-num ${s.lead_time >= 8 ? 'text-amber-700 font-medium' : 'text-slate-700'}`}>
                        {s.lead_time} d
                      </td>
                      <td className={`py-2 px-2 text-right font-mono-num font-medium ${s.supplier_rating >= 4.4 ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {s.supplier_rating} / 5
                      </td>
                      <td className="py-2 px-2 text-right font-mono-num text-rose-700">{s.stock_alert_slots}</td>
                      <td className="py-2 pl-2 text-right font-mono-num font-semibold text-slate-900">{formatINR(s.total_revenue)}</td>
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
