import React, { useState } from 'react';
import { Activity, Eye, EyeOff, Gauge, Radio, ShieldCheck } from 'lucide-react';

export default function MetricsOverlay({ metrics }) {
  const [isVisible, setIsVisible] = useState(true);

  if (!metrics) return null;

  const { rtt = 0, fps = 60, bitrate = 0, connectionState = 'connected' } = metrics;

  // Latency Color Thresholds: <40ms (emerald), <90ms (amber), >=90ms (rose)
  const latencyColor = rtt < 40 ? 'text-emerald-400' : rtt < 90 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="absolute top-4 right-4 z-30">
      {!isVisible ? (
        <button
          onClick={() => setIsVisible(true)}
          className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700/80 transition-colors shadow-lg backdrop-blur-md"
          title="Show Performance HUD"
        >
          <Eye className="w-4 h-4" />
        </button>
      ) : (
        <div className="glass-panel p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 w-64 space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Gauge className="w-4 h-4 text-hyper-accent" />
              <span>HYPER-METRICS HUD</span>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* RTT / Latency */}
            <div className="bg-hyper-900/90 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Round Trip Time</span>
              <span className={`text-base font-extrabold ${latencyColor}`}>
                {rtt} ms
              </span>
            </div>

            {/* FPS */}
            <div className="bg-hyper-900/90 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Frame Rate</span>
              <span className="text-base font-extrabold text-hyper-accent">
                {fps} FPS
              </span>
            </div>

            {/* Bitrate */}
            <div className="bg-hyper-900/90 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Video Bitrate</span>
              <span className="text-sm font-bold text-slate-200">
                {bitrate > 1000 ? `${(bitrate / 1000).toFixed(1)} Mbps` : `${bitrate} Kbps`}
              </span>
            </div>

            {/* Transport Mode */}
            <div className="bg-hyper-900/90 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Transport</span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> P2P UDP
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
