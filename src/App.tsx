import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  Lightbulb,
  Menu,
  PackageCheck,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { SimulatedMonitorBar } from './components/SimulatedMonitorBar';
import { BusinessInsights } from './pages/BusinessInsights';
import { CustomerAnalytics } from './pages/CustomerAnalytics';
import { ExecutiveOverview } from './pages/ExecutiveOverview';
import { InventoryAnalytics } from './pages/InventoryAnalytics';
import { LogisticsAnalytics } from './pages/LogisticsAnalytics';
import { ProductAnalytics } from './pages/ProductAnalytics';
import { SalesAnalytics } from './pages/SalesAnalytics';
import { FilterMetadata, GlobalFilters, PageId } from './types/bi';
import { exportMultiSheetExcel } from './utils/formatters';

const NAV_ITEMS: { id: PageId; label: string; icon: any }[] = [
  { id: 'executive', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'sales', label: 'Sales Analytics', icon: BarChart3 },
  { id: 'customers', label: 'Customer RFM & Cohorts', icon: Users },
  { id: 'inventory', label: 'Inventory & Suppliers', icon: Boxes },
  { id: 'logistics', label: 'Delivery & Logistics', icon: Truck },
  { id: 'products', label: 'Product & Margins', icon: PackageCheck },
  { id: 'insights', label: 'Insights & Forecast', icon: Lightbulb },
];

const DEFAULT_FILTERS: GlobalFilters = {
  startDate: '2025-11-01',
  endDate: '2026-10-31',
  city: 'All',
  branchId: 'All',
  category: 'All',
  paymentMethod: 'All',
  search: '',
};

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('executive');
  const [meta, setMeta] = useState<FilterMetadata | null>(null);
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_FILTERS);
  const [simActive, setSimActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportingExec, setExportingExec] = useState(false);
  const [refreshTick, _setRefreshTick] = useState(0);

  const loadFilters = () => {
    fetch('/api/filters')
      .then((r) => r.json())
      .then((res: FilterMetadata) => {
        setMeta(res);
        setFilters((prev) => ({
          ...prev,
          startDate: res.minDate || prev.startDate,
          endDate: res.maxDate || prev.endDate,
        }));
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadFilters();
  }, [refreshTick]);

  const handleResetFilters = () => {
    setFilters({
      ...DEFAULT_FILTERS,
      startDate: meta?.minDate || DEFAULT_FILTERS.startDate,
      endDate: meta?.maxDate || DEFAULT_FILTERS.endDate,
    });
  };

  const handleDownloadExecutiveWorkbook = async () => {
    setExportingExec(true);
    try {
      const [ov, cust, inv, log] = await Promise.all([
        fetch('/api/overview').then((r) => r.json()),
        fetch('/api/customers').then((r) => r.json()),
        fetch('/api/inventory').then((r) => r.json()),
        fetch('/api/logistics').then((r) => r.json()),
      ]);
      exportMultiSheetExcel('CoastalKart_Executive_Report', [
        { name: 'Executive_KPIs', rows: [ov.kpis] },
        { name: 'Branch_Performance', rows: ov.branchPerformance || [] },
        { name: 'RFM_Cohorts', rows: cust.rfmSummary || [] },
        { name: 'Reorder_Alerts', rows: inv.reorderQueue || [] },
        { name: 'Delivery_SLA', rows: log.partnerPerformance || [] },
      ]);
    } finally {
      setExportingExec(false);
    }
  };

  const currentNav = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0F2942] text-slate-100">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-base font-bold tracking-tight text-white font-display">CoastalKart BI</div>
        <div className="text-[11px] text-slate-300 mt-0.5">Mangaluru Retail Analytics</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2.5 mb-2 text-[11px] font-medium text-slate-400">BI Dashboards</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActivePage(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white text-[#0F2942]'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-3.5 border-t border-white/10 text-[11px] text-slate-300 leading-relaxed">
        Simulated Business Case Study · Mangaluru, Karnataka · INR (₹)
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200">
        <div className="sticky top-0 h-screen">{renderSidebarContent()}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full shadow-xl">{renderSidebarContent()}</div>
          <div className="flex-1 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Contextual Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="font-medium text-slate-700 hidden sm:inline">CoastalKart Retail & E-commerce</span>
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="text-sm font-semibold text-slate-900 truncate">{currentNav.label}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadExecutiveWorkbook}
              disabled={exportingExec}
              className="hidden md:inline-flex h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F2942]" />
              {exportingExec ? 'Preparing...' : 'Executive Workbook (.xlsx)'}
            </button>

            <button
              type="button"
              onClick={() => setSimActive((s) => !s)}
              className={`h-8 px-3 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                simActive
                  ? 'bg-[#0F2942] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {simActive ? 'Stop Simulated Monitor' : 'Simulated Live Monitor'}
            </button>

            <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-slate-200 text-xs text-slate-600 whitespace-nowrap">
              <Building2 className="w-3.5 h-3.5 text-[#0F2942]" />
              <span>Management View · Mangaluru HQ</span>
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          <SimulatedMonitorBar active={simActive} onClose={() => setSimActive(false)} />

          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {activePage === 'executive' && (
              <ExecutiveOverview
                filters={filters}
                meta={meta}
                onFilterChange={setFilters}
                onResetFilters={handleResetFilters}
                refreshTick={refreshTick}
              />
            )}
            {activePage === 'sales' && (
              <SalesAnalytics
                filters={filters}
                meta={meta}
                onFilterChange={setFilters}
                onResetFilters={handleResetFilters}
              />
            )}
            {activePage === 'customers' && (
              <CustomerAnalytics
                filters={filters}
                meta={meta}
                onFilterChange={setFilters}
                onResetFilters={handleResetFilters}
              />
            )}
            {activePage === 'inventory' && <InventoryAnalytics meta={meta} />}
            {activePage === 'logistics' && <LogisticsAnalytics meta={meta} />}
            {activePage === 'products' && <ProductAnalytics meta={meta} />}
            {activePage === 'insights' && <BusinessInsights />}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
