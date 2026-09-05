import React, { useState } from 'react';
import { Monitor, Check, ChevronDown } from 'lucide-react';

export default function MonitorSelector({ monitors = [], activeMonitorId = 0, onSelectMonitor }) {
  const [isOpen, setIsOpen] = useState(false);

  const defaultMonitors = monitors.length > 0 ? monitors : [
    { id: 0, name: 'Display 1 (Primary 1920x1080)', isPrimary: true },
    { id: 1, name: 'Display 2 (Secondary 2560x1440)', isPrimary: false }
  ];

  const currentMonitor = defaultMonitors.find(m => m.id === activeMonitorId) || defaultMonitors[0];

  const handleSelect = (id) => {
    onSelectMonitor(id);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs font-semibold rounded-xl transition-colors"
        title="Select Display Monitor"
      >
        <Monitor className="w-3.5 h-3.5 text-hyper-accent" />
        <span>{currentMonitor.name}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 glass-panel p-2 rounded-xl shadow-2xl z-50 border border-slate-700 space-y-1 font-mono text-xs">
          <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
            Available Display Outputs
          </div>

          {defaultMonitors.map((mon) => (
            <button
              key={mon.id}
              onClick={() => handleSelect(mon.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                activeMonitorId === mon.id
                  ? 'bg-hyper-accent/20 text-hyper-accent font-bold border border-hyper-accent/30'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5" />
                <span>{mon.name}</span>
              </div>
              {activeMonitorId === mon.id && <Check className="w-3.5 h-3.5 text-hyper-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
