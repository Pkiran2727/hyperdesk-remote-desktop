import React, { useState } from 'react';
import { Play, ArrowRight, ShieldCheck, Zap, Monitor, History, AlertCircle } from 'lucide-react';
import RemoteCanvas from './RemoteCanvas';
import SessionRecorder from './SessionRecorder';
import ClipboardSync from './ClipboardSync';
import MetricsOverlay from './MetricsOverlay';

export default function ViewerView({
  onConnect,
  onDisconnect,
  isConnected,
  connectionState,
  remoteStream,
  onSendInput,
  onSendClipboard,
  clipboardLogs,
  metrics,
  errorMessage
}) {
  const [targetHostId, setTargetHostId] = useState('');
  const [targetPasscode, setTargetPasscode] = useState('');
  const [recentSessions, setRecentSessions] = useState([
    { id: '492819301', name: 'Office Workstation (Win 11)', lastUsed: '10 mins ago' },
    { id: '108492049', name: 'Ubuntu Server (Linux)', lastUsed: 'Yesterday' }
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetHostId || !targetPasscode) return;
    const cleanId = targetHostId.replace(/\s+/g, '');
    onConnect(cleanId, targetPasscode);
  };

  const handleQuickConnect = (session) => {
    setTargetHostId(session.id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ACTIVE REMOTE STREAM VIEWPORT */}
      {isConnected && remoteStream ? (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl flex flex-col">
          {/* Top Control Bar overlay over video */}
          <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-hyper-accent" />
                  Remote Session: <span className="font-mono text-hyper-accent">{targetHostId}</span>
                </h3>
              </div>
            </div>

            {/* Middle Toolbar: Recorder & Clipboard Controls */}
            <div className="flex items-center gap-3">
              <SessionRecorder mediaStream={remoteStream} />
              <ClipboardSync onSendClipboard={onSendClipboard} clipboardLogs={clipboardLogs} />
            </div>

            {/* Disconnect Button */}
            <button
              onClick={onDisconnect}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-400 font-bold rounded-xl text-xs transition-colors"
            >
              Disconnect Session
            </button>
          </div>

          {/* Canvas Viewport */}
          <div className="relative bg-black flex items-center justify-center min-h-[600px]">
            <MetricsOverlay metrics={metrics} />
            <RemoteCanvas stream={remoteStream} onSendInput={onSendInput} />
          </div>
        </div>
      ) : (
        /* CONNECT FORM UI */
        <div className="space-y-6">
          {/* Top Connect Hero Card */}
          <div className="glass-panel-glow p-8 rounded-2xl">
            <div className="max-w-xl space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hyper-accent/10 border border-hyper-accent/30 text-hyper-accent text-xs font-mono font-semibold mb-3">
                  <Zap className="w-3.5 h-3.5" />
                  REMOTE DESKTOP CLIENT
                </div>
                <h2 className="text-3xl font-extrabold text-white tracking-tight">
                  Connect to Remote Host
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Enter the 9-digit HyperDesk ID of the computer you want to control.
                </p>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Remote Host ID</label>
                  <input
                    type="text"
                    value={targetHostId}
                    onChange={(e) => setTargetHostId(e.target.value)}
                    placeholder="e.g. 492 819 301"
                    className="w-full bg-hyper-900 border border-slate-700 focus:border-hyper-accent rounded-xl px-4 py-3.5 text-xl font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-hyper-accent/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Security Passcode</label>
                  <input
                    type="password"
                    value={targetPasscode}
                    onChange={(e) => setTargetPasscode(e.target.value)}
                    placeholder="Enter passcode"
                    className="w-full bg-hyper-900 border border-slate-700 focus:border-hyper-accent rounded-xl px-4 py-3.5 text-lg font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-hyper-accent/20 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={connectionState === 'connecting'}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-hyper-accent to-cyan-500 hover:from-cyan-400 hover:to-hyper-accent text-hyper-900 font-extrabold rounded-xl shadow-xl shadow-hyper-accent/20 hover:scale-[1.01] transition-all text-base disabled:opacity-50"
                >
                  {connectionState === 'connecting' ? (
                    <span>Establishing P2P Tunnel...</span>
                  ) : (
                    <>
                      <span>Connect Now</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Recent Sessions List */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 font-mono">
              <History className="w-4 h-4 text-hyper-accent" />
              RECENT SESSIONS & RECENT HOSTS
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentSessions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleQuickConnect(item)}
                  className="p-4 rounded-xl bg-hyper-900 border border-slate-800 hover:border-hyper-accent/40 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 group-hover:bg-hyper-accent/10 group-hover:text-hyper-accent flex items-center justify-center text-slate-400 transition-colors">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm group-hover:text-hyper-accent transition-colors">{item.name}</p>
                      <p className="font-mono text-xs text-slate-400">ID: {item.id}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{item.lastUsed}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
