import React, { useState } from 'react';
import { Copy, RefreshCw, Radio, Check, Users, Shield, Terminal, Play, Square, Activity } from 'lucide-react';

export default function HostView({
  hostId,
  passcode,
  onGeneratePasscode,
  isBroadcasting,
  onStartBroadcasting,
  onStopBroadcasting,
  connectionState,
  inputLogs = []
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);

  const formattedId = hostId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

  const copyToClipboard = (text, setCopiedState) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner Card */}
      <div className="glass-panel-glow p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-hyper-brand/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hyper-brand/10 border border-hyper-brand/30 text-hyper-brand text-xs font-mono font-semibold mb-3">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              HOST BROADCASTER NODE
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Share Your Desktop Session
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Provide your 9-digit Session ID and Security Passcode to the remote viewer to initiate an ultra-low latency peer-to-peer connection.
            </p>
          </div>

          {/* Action Button */}
          <div>
            {!isBroadcasting ? (
              <button
                onClick={onStartBroadcasting}
                className="flex items-center gap-3 px-7 py-4 bg-gradient-to-r from-hyper-brand to-pink-600 hover:from-pink-600 hover:to-hyper-brand text-white font-bold rounded-xl shadow-xl shadow-hyper-brand/30 hover:scale-105 transition-all text-base"
              >
                <Play className="w-5 h-5 fill-current" />
                Start Screen Sharing
              </button>
            ) : (
              <button
                onClick={onStopBroadcasting}
                className="flex items-center gap-3 px-7 py-4 bg-rose-600/20 border border-rose-500/40 text-rose-400 font-bold rounded-xl hover:bg-rose-600/30 transition-all text-base"
              >
                <Square className="w-5 h-5 fill-current" />
                Stop Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Credentials & Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Session Credentials Card */}
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-hyper-accent" />
              Access Credentials
            </h3>
            <span className="text-xs font-mono text-slate-400">P2P Encrypted</span>
          </div>

          {/* AnyDesk Style 9-Digit ID Box */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Your HyperDesk ID</label>
            <div className="flex items-center justify-between bg-hyper-900 border border-slate-700/80 p-4 rounded-xl shadow-inner">
              <span className="font-mono text-3xl font-extrabold tracking-widest text-hyper-accent">
                {formattedId}
              </span>
              <button
                onClick={() => copyToClipboard(hostId, setCopiedId)}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Copy Host ID"
              >
                {copiedId ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Passcode Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Temporary Passcode</label>
              <button
                onClick={onGeneratePasscode}
                className="text-xs text-hyper-accent hover:underline flex items-center gap-1 font-mono"
              >
                <RefreshCw className="w-3 h-3" /> Regenerate
              </button>
            </div>
            <div className="flex items-center justify-between bg-hyper-900 border border-slate-700/80 p-4 rounded-xl shadow-inner">
              <span className="font-mono text-2xl font-bold tracking-wider text-slate-100">
                {passcode}
              </span>
              <button
                onClick={() => copyToClipboard(passcode, setCopiedPasscode)}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Copy Passcode"
              >
                {copiedPasscode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Live Radar & Status Card */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-hyper-brand" />
              Broadcast Status
            </h3>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              {connectionState.toUpperCase()}
            </span>
          </div>

          {/* Radar Animation Box */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-hyper-900/50 rounded-xl border border-slate-800/80 text-center relative overflow-hidden">
            {isBroadcasting ? (
              <div className="relative flex items-center justify-center w-28 h-28 mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-hyper-brand/30 animate-radar"></div>
                <div className="absolute inset-3 rounded-full border border-hyper-accent/20"></div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-hyper-brand to-pink-600 flex items-center justify-center shadow-lg shadow-hyper-brand/30">
                  <Users className="w-8 h-8 text-white" />
                </div>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-4 border border-slate-700">
                <Radio className="w-10 h-10" />
              </div>
            )}

            <p className="font-bold text-white text-base">
              {isBroadcasting
                ? connectionState === 'connected'
                  ? 'Connected with Remote Viewer'
                  : 'Ready & Waiting for Remote Viewer...'
                : 'Broadcast Stopped'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs font-mono">
              {isBroadcasting
                ? 'WebRTC P2P socket open. Audio/Video stream pipeline active.'
                : 'Click "Start Screen Sharing" above to open peer connection.'}
            </p>
          </div>
        </div>
      </div>

      {/* Input Event Monitor Feed */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono">
            <Terminal className="w-4 h-4 text-hyper-accent" />
            LIVE REMOTE INPUT INJECTION LOGS (HOST OS DESERIALIZER)
          </h3>
          <span className="text-xs text-slate-500 font-mono">{inputLogs.length} Events Logged</span>
        </div>

        <div className="bg-hyper-900/90 border border-slate-800 p-4 rounded-xl h-36 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-thin">
          {inputLogs.length === 0 ? (
            <p className="text-slate-600 italic">No input events received yet. Connect a remote viewer to monitor mouse/keyboard event stream.</p>
          ) : (
            inputLogs.map((log, index) => (
              <div key={index} className="flex items-center justify-between text-slate-300 hover:bg-slate-800/40 p-1 rounded">
                <span className="text-hyper-accent">[{log.time}]</span>
                <span className="font-semibold text-emerald-400">{log.type}</span>
                <span className="text-slate-400">{log.details}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
