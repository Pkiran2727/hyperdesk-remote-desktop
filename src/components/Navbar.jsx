import React from 'react';
import { Monitor, Zap, Settings, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

export default function Navbar({ isSignalingConnected, onOpenSettings, activeMode, setActiveMode }) {
  return (
    <header className="glass-panel sticky top-0 z-40 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between shadow-xl">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-hyper-brand via-purple-600 to-hyper-accent p-0.5 shadow-lg shadow-hyper-brand/20">
          <div className="w-full h-full bg-hyper-900 rounded-[10px] flex items-center justify-center">
            <Zap className="w-5 h-5 text-hyper-accent animate-pulse" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-xl tracking-wider text-white">HYPER<span className="text-hyper-brand">DESK</span></h1>
            <span className="bg-hyper-brand/20 text-hyper-brand border border-hyper-brand/30 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold">PRO 1.0</span>
          </div>
          <p className="text-xs text-slate-400 font-mono">Sub-30ms Ultra-Low Latency Engine</p>
        </div>
      </div>

      {/* Mode Switcher Pills */}
      <div className="flex items-center bg-hyper-800/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
        <button
          onClick={() => setActiveMode('host')}
          className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeMode === 'host'
              ? 'bg-hyper-brand text-white shadow-lg shadow-hyper-brand/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
          }`}
        >
          <Monitor className="w-4 h-4" />
          Share This Screen (Host)
        </button>

        <button
          onClick={() => setActiveMode('viewer')}
          className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activeMode === 'viewer'
              ? 'bg-hyper-accent text-hyper-900 shadow-lg shadow-hyper-accent/30 font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
          }`}
        >
          <Zap className="w-4 h-4" />
          Connect to Remote (Viewer)
        </button>
      </div>

      {/* Connection Status & Settings */}
      <div className="flex items-center gap-4">
        {/* Signaling Status Badge */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border ${
          isSignalingConnected
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          {isSignalingConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>SIGNALING READY</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              <span>DISCONNECTED</span>
            </>
          )}
        </div>

        {/* Security Shield Indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-800/50 border border-slate-700 px-3 py-1 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-hyper-accent" />
          <span>AES-256 / DTLS-SRTP</span>
        </div>

        {/* Settings Modal Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 transition-colors shadow-md"
          title="Engine Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
