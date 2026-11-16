import { useEffect, useState } from 'react';
import { Radio, X } from 'lucide-react';
import { formatINR } from '../utils/formatters';

interface SimulatedMonitorBarProps {
  active: boolean;
  onClose: () => void;
}

interface SimEvent {
  eventId: string;
  timestamp: string;
  city: string;
  productName: string;
  quantity: number;
  revenue: number;
  paymentMethod: string;
}

export function SimulatedMonitorBar({ active, onClose }: SimulatedMonitorBarProps) {
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!active) return;
    const fetchTick = () => {
      if (paused) return;
      fetch('/api/simulated-stream')
        .then((r) => r.json())
        .then((res) => {
          if (Array.isArray(res.events)) {
            setEvents((prev) => [...res.events, ...prev].slice(0, 8));
          }
        })
        .catch(() => {});
    };
    fetchTick();
    const timer = setInterval(fetchTick, 4000);
    return () => clearInterval(timer);
  }, [active, paused]);

  if (!active) return null;

  return (
    <div className="mb-5 bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#0F2942]" />
          <span className="text-xs font-semibold text-slate-900">
            Simulated Real-Time Sales Monitoring Mode
          </span>
          <span className="text-xs text-slate-500">
            · Controlled 4s refresh sampled from historical transactions (Simulated Case Study)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="h-7 px-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0"
          >
            {paused ? 'Resume Stream' : 'Pause Stream'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close simulated monitor"
            className="h-7 w-7 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 text-left border-b border-slate-100">
              <th className="py-1.5 pr-3 font-medium">Simulated Time</th>
              <th className="py-1.5 pr-3 font-medium">Branch City</th>
              <th className="py-1.5 pr-3 font-medium">Product</th>
              <th className="py-1.5 px-2 font-medium text-right">Qty</th>
              <th className="py-1.5 px-2 font-medium text-right">Order Value</th>
              <th className="py-1.5 pl-2 font-medium">Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((ev) => (
              <tr key={ev.eventId}>
                <td className="py-1.5 pr-3 font-mono-num text-slate-500">{ev.timestamp}</td>
                <td className="py-1.5 pr-3 font-medium text-slate-800">{ev.city}</td>
                <td className="py-1.5 pr-3 text-slate-900">{ev.productName}</td>
                <td className="py-1.5 px-2 text-right font-mono-num">{ev.quantity}</td>
                <td className="py-1.5 px-2 text-right font-mono-num font-medium text-emerald-700">{formatINR(ev.revenue)}</td>
                <td className="py-1.5 pl-2 text-slate-600">{ev.paymentMethod}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
