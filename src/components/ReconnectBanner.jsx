import React from 'react';
import { RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';

export default function ReconnectBanner({ isReconnecting, retryCount, nextRetrySec }) {
  if (!isReconnecting) return null;

  return (
    <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-300 px-6 py-2.5 flex items-center justify-between shadow-lg backdrop-blur-md animate-pulse">
      <div className="flex items-center gap-3">
        <WifiOff className="w-5 h-5 text-amber-400" />
        <div>
          <p className="text-xs font-bold font-mono">
            CONNECTION LOST — ATTEMPTING AUTO-RECONNECT (Attempt #{retryCount})
          </p>
          <p className="text-[11px] text-amber-400/80 font-mono">
            Exponential backoff active. Retrying in {nextRetrySec} seconds...
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 font-mono text-xs bg-amber-500/30 px-3 py-1 rounded-lg border border-amber-500/40">
        <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
        <span>RECONNECTING...</span>
      </div>
    </div>
  );
}
