import { Download, FileSpreadsheet, FileText, RotateCcw, Search } from 'lucide-react';
import { FilterMetadata, GlobalFilters } from '../types/bi';

interface FilterBarProps {
  filters: GlobalFilters;
  meta: FilterMetadata | null;
  onChange: (next: GlobalFilters) => void;
  onReset: () => void;
  onExportCSV?: () => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  showPaymentFilter?: boolean;
  showCategoryFilter?: boolean;
  showDateFilter?: boolean;
  searchPlaceholder?: string;
}

export function FilterBar({
  filters,
  meta,
  onChange,
  onReset,
  onExportCSV,
  onExportExcel,
  onExportPDF,
  showPaymentFilter = true,
  showCategoryFilter = true,
  showDateFilter = true,
  searchPlaceholder = 'Search product, order ID, customer...',
}: FilterBarProps) {
  const update = (key: keyof GlobalFilters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 mb-5">
      <div className="flex flex-wrap items-end gap-3">
        {showDateFilter && (
          <>
            <div className="flex flex-col gap-1 min-w-[132px]">
              <label className="text-[11px] font-medium text-slate-500">From Date</label>
              <input
                type="date"
                value={filters.startDate}
                min={meta?.minDate}
                max={filters.endDate || meta?.maxDate}
                onChange={(e) => update('startDate', e.target.value)}
                className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono-num focus:outline-none focus:border-blue-700"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[132px]">
              <label className="text-[11px] font-medium text-slate-500">To Date</label>
              <input
                type="date"
                value={filters.endDate}
                min={filters.startDate || meta?.minDate}
                max={meta?.maxDate}
                onChange={(e) => update('endDate', e.target.value)}
                className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono-num focus:outline-none focus:border-blue-700"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[11px] font-medium text-slate-500">City</label>
          <select
            value={filters.city}
            onChange={(e) => update('city', e.target.value)}
            className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-700"
          >
            <option value="All">All Cities</option>
            {meta?.cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[170px]">
          <label className="text-[11px] font-medium text-slate-500">Branch</label>
          <select
            value={filters.branchId}
            onChange={(e) => update('branchId', e.target.value)}
            className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-700"
          >
            <option value="All">All Branches</option>
            {meta?.branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.city} — {b.branch_id}
              </option>
            ))}
          </select>
        </div>

        {showCategoryFilter && (
          <div className="flex flex-col gap-1 min-w-[165px]">
            <label className="text-[11px] font-medium text-slate-500">Product Category</label>
            <select
              value={filters.category}
              onChange={(e) => update('category', e.target.value)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-700"
            >
              <option value="All">All Categories</option>
              {meta?.categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}

        {showPaymentFilter && (
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[11px] font-medium text-slate-500">Payment Method</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => update('paymentMethod', e.target.value)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-700"
            >
              <option value="All">All Methods</option>
              {meta?.paymentMethods.map((pm) => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[11px] font-medium text-slate-500">Search</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => update('search', e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="h-9 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </button>

          {onExportCSV && (
            <button
              type="button"
              onClick={onExportCSV}
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          )}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="h-9 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
          )}
          {onExportPDF && (
            <button
              type="button"
              onClick={onExportPDF}
              className="h-9 px-3 text-xs font-medium text-white bg-[#0F2942] hover:bg-[#193B5C] rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
