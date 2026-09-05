import React, { useState } from 'react';
import { Settings, Sliders, Server, Zap, Save } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, config, onSaveConfig }) {
  const [serverUrl, setServerUrl] = useState(config.serverUrl || 'ws://localhost:8080');
  const [targetFps, setTargetFps] = useState(config.targetFps || 60);
  const [qualityMode, setQualityMode] = useState(config.qualityMode || 'low-latency');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      serverUrl,
      targetFps: Number(targetFps),
      qualityMode
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel-glow w-full max-w-md p-6 rounded-2xl space-y-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-hyper-accent" />
            HyperDesk Engine Settings
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-mono text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* Signaling Server URL */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-hyper-accent" />
              Signaling Server URL
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full bg-hyper-900 border border-slate-700 focus:border-hyper-accent rounded-xl px-4 py-2.5 font-mono text-sm text-white focus:outline-none"
            />
          </div>

          {/* Target Frame Rate */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-hyper-brand" />
              Target Frame Rate Cap
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetFps(30)}
                className={`py-2.5 rounded-xl font-mono text-sm font-bold border transition-colors ${
                  targetFps === 30
                    ? 'bg-hyper-brand/20 border-hyper-brand text-hyper-brand'
                    : 'bg-hyper-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                30 FPS (Standard)
              </button>
              <button
                type="button"
                onClick={() => setTargetFps(60)}
                className={`py-2.5 rounded-xl font-mono text-sm font-bold border transition-colors ${
                  targetFps === 60
                    ? 'bg-hyper-accent/20 border-hyper-accent text-hyper-accent'
                    : 'bg-hyper-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                60 FPS (Ultra Smooth)
              </button>
            </div>
          </div>

          {/* Quality Preset */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Stream Optimization Profile
            </label>
            <select
              value={qualityMode}
              onChange={(e) => setQualityMode(e.target.value)}
              className="w-full bg-hyper-900 border border-slate-700 focus:border-hyper-accent rounded-xl px-4 py-2.5 font-mono text-sm text-white focus:outline-none"
            >
              <option value="low-latency">Sub-30ms Ultra Low Latency (Recommended)</option>
              <option value="high-quality">High Definition Crisp Text (Workstation Mode)</option>
              <option value="balanced">Balanced Adaptive Profile</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-hyper-accent hover:bg-cyan-400 text-hyper-900 font-extrabold rounded-xl text-sm transition-colors shadow-lg shadow-hyper-accent/20"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
