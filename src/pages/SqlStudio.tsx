import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { SqlCatalogItem } from '../types/bi';
import { exportToCSV } from '../utils/formatters';

export function SqlStudio() {
  const [catalog, setCatalog] = useState<SqlCatalogItem[]>([]);
  const [selected, setSelected] = useState<SqlCatalogItem | null>(null);
  const [sqlText, setSqlText] = useState('');
  const [result, setResult] = useState<{ columns: string[]; rows: Record<string, any>[]; rowCount: number; durationMs: number; truncated?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [domainFilter, setDomainFilter] = useState('All');

  useEffect(() => {
    fetch('/api/sql-catalog')
      .then((r) => r.json())
      .then((res) => {
        const list: SqlCatalogItem[] = res.queries || [];
        setCatalog(list);
        if (list.length > 0) {
          setSelected(list[0]);
          setSqlText(list[0].sql);
        }
      });
  }, []);

  const executeSql = async (queryToRun: string) => {
    setRunning(true);
    setError(null);
    try {
      const resp = await fetch('/api/sql/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: queryToRun }),
      });
      const json = await resp.json();
      if (!resp.ok || json.error) {
        setError(json.error || 'Query execution failed.');
        setResult(null);
      } else {
        setResult(json);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (selected) {
      setSqlText(selected.sql);
      executeSql(selected.sql);
    }
  }, [selected?.id]);

  const domains = ['All', 'Sales & Margins', 'Customer & RFM', 'Inventory & Suppliers', 'Delivery & Logistics'];
  const visibleQueries = domainFilter === 'All' ? catalog : catalog.filter((q) => q.domain === domainFilter);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left Query Catalog */}
      <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-4 flex flex-col max-h-[820px]">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Business SQL Query Library ({catalog.length})</h2>
          <p className="text-xs text-slate-500 mt-0.5">CTEs, Window Functions (RANK, DENSE_RANK, LAG, NTILE), Subqueries</p>
        </div>

        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg mb-3"
        >
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <div className="overflow-y-auto divide-y divide-slate-100 pr-1">
          {visibleQueries.map((q) => {
            const isActive = selected?.id === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelected(q)}
                className={`w-full text-left py-2.5 px-3 rounded-lg transition-colors ${
                  isActive ? 'bg-[#0F2942] text-white' : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className={`text-[11px] font-mono-num ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>
                  {q.id} · {q.file}
                </div>
                <div className="text-xs font-medium mt-0.5 leading-snug">{q.title}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Workbench */}
      <div className="xl:col-span-8 space-y-4">
        {selected && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {selected.id}: {selected.title}
              </h2>
              <span className="text-xs text-slate-500">{selected.domain}</span>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <div className="font-semibold text-slate-800">Business Question</div>
                <p className="text-slate-600 mt-1 leading-relaxed">{selected.question}</p>
              </div>
              <div>
                <div className="font-semibold text-slate-800">Result Explanation</div>
                <p className="text-slate-600 mt-1 leading-relaxed">{selected.explanation}</p>
              </div>
              <div>
                <div className="font-semibold text-[#0F2942]">Business Recommendation</div>
                <p className="text-slate-700 mt-1 leading-relaxed">{selected.recommendation}</p>
              </div>
            </div>
          </div>
        )}

        {/* SQL Editor */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700">Live SQLite Query Workbench (Read-Only SELECT / WITH)</span>
            <div className="flex items-center gap-2">
              {result && result.rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportToCSV(`coastalkart_${selected?.id || 'query'}`, result.rows)}
                  className="h-8 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0"
                >
                  Export Result CSV
                </button>
              )}
              <button
                type="button"
                onClick={() => executeSql(sqlText)}
                disabled={running}
                className="h-8 px-3.5 text-xs font-medium text-white bg-[#0F2942] hover:bg-[#193B5C] rounded-lg inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                {running ? 'Running...' : 'Run Query'}
              </button>
            </div>
          </div>

          <textarea
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
            rows={9}
            spellCheck={false}
            className="w-full p-3 text-xs font-mono bg-slate-950 text-slate-100 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed"
          />

          {error && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              {error}
            </div>
          )}
        </div>

        {/* Query Results Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-900">Query Output</span>
            {result && (
              <span className="text-xs font-mono-num text-slate-500">
                {result.rowCount} rows{result.truncated ? ' (capped at 200)' : ''} · {result.durationMs} ms
              </span>
            )}
          </div>

          {result && result.rows.length > 0 ? (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-slate-500 text-left">
                    {result.columns.map((col) => (
                      <th key={col} className="py-2 pr-4 font-medium whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {result.columns.map((col) => (
                        <td key={col} className="py-2 pr-4 font-mono-num text-slate-800 whitespace-nowrap">
                          {row[col] === null ? 'NULL' : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              {running ? 'Executing SQL against SQLite...' : 'No rows returned.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
