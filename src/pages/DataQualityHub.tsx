import { ChangeEvent, useEffect, useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface DataQualityHubProps {
  onDatasetUpdated: () => void;
}

export function DataQualityHub({ onDatasetUpdated }: DataQualityHubProps) {
  const [data, setData] = useState<any>(null);
  const [seed, setSeed] = useState('42');
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = () => {
    fetch('/api/data-quality')
      .then((r) => r.json())
      .then((res) => setData(res));
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleRegenerate = async () => {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await fetch('/api/dataset/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: Number(seed) || 42 }),
      });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'Refresh failed');
      setMessage(`Dataset regenerated (seed=${json.seed}), cleaned, and reloaded into SQLite.`);
      loadReport();
      onDatasetUpdated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCsvUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    setError(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error('CSV must include a header row and at least one data row.');
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = vals[i] ?? '';
        });
        return obj;
      });
      const resp = await fetch('/api/dataset/upload-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'Upload failed');
      setMessage(`Imported ${json.inserted} validated transactions (${json.rejected} rejected by referential checks).`);
      loadReport();
      onDatasetUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls: Regenerate Seed or Upload CSV */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Data Engineering Pipeline & Quality Audit</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated ETL validation between raw synthetic ingestion and clean SQLite warehouse tables
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">Seed:</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="w-20 h-9 px-2.5 text-xs font-mono-num bg-slate-50 border border-slate-200 rounded-lg"
            />
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={refreshing}
              className="h-9 px-3.5 text-xs font-medium text-white bg-[#0F2942] hover:bg-[#193B5C] rounded-lg inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Rebuilding...' : 'Regenerate & Clean Dataset'}
            </button>
          </div>

          <label className="h-9 px-3.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
            <Upload className="w-3.5 h-3.5" />
            Upload Sales CSV
            <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          </label>
        </div>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
          {error}
        </div>
      )}

      {data?.qualityReport && (
        <>
          {/* Live SQLite Warehouse Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(data.liveCounts || {}).map(([table, cnt]) => (
              <div key={table} className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-[11px] text-slate-500 truncate">{table}</div>
                <div className="text-lg font-semibold text-slate-900 font-mono-num mt-1">
                  {formatNumber(Number(cnt))}
                </div>
              </div>
            ))}
          </div>

          {/* Data Quality Checks Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Validation & Anomaly Remediation Log</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Raw anomalies detected & repaired by <code className="font-mono">src/data_cleaning.py</code>
                </p>
              </div>
              <div className="text-xs font-mono-num text-slate-700">
                Total Remediated: <strong>{data.qualityReport.total_anomalies_remediated}</strong> · Clean Integrity Score: <strong>{data.qualityReport.quality_score_pct}%</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    <th className="py-2 pr-3 font-medium">Validation Rule</th>
                    <th className="py-2 pr-3 font-medium">Target Table</th>
                    <th className="py-2 px-3 font-medium text-right">Issues Detected</th>
                    <th className="py-2 pr-3 font-medium">Pipeline Resolution</th>
                    <th className="py-2 pl-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.qualityReport.checks.map((chk: any) => (
                    <tr key={chk.check} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{chk.check}</td>
                      <td className="py-2.5 pr-3 font-mono-num text-slate-600">{chk.table}</td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-amber-700">{chk.issues_found}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{chk.resolution}</td>
                      <td className="py-2.5 pl-2 font-medium text-emerald-700">{chk.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Portfolio Project Structure */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Portfolio Repository Modules (coastalkart-analytics/)</h3>
            <p className="text-xs text-slate-500 mb-3">
              Complete Python, SQLite, Streamlit, SQL & unittest codebase ready for GitHub showcase.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {(data.projectStructure || []).map((item: string) => (
                <div key={item} className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-mono text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
