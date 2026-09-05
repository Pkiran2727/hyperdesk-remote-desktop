import React, { useState } from 'react';
import { HardDrive, Upload, Download, CheckCircle2, FileText, AlertCircle } from 'lucide-react';

export default function FileTransferModal({ isOpen, onClose, onSendFile, activeTransfers = [] }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleStartTransfer = () => {
    if (!selectedFile) return;
    onSendFile(selectedFile);
    setSelectedFile(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel-glow w-full max-w-lg p-6 rounded-2xl space-y-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-hyper-accent" />
            Bi-Directional File Transfer (64KB Chunking)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-mono text-sm">✕</button>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 transition-colors ${
            dragActive
              ? 'border-hyper-accent bg-hyper-accent/10'
              : 'border-slate-700 bg-hyper-900/60 hover:border-slate-600'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-hyper-accent">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">Drag and drop any file here to send to remote host</p>
            <p className="text-xs text-slate-400 mt-1">Chunked over WebRTC DataChannel with SHA-256 integrity verification</p>
          </div>

          <label className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold rounded-xl border border-slate-700 transition-colors">
            Browse File
            <input type="file" onChange={handleFileSelect} className="hidden" />
          </label>

          {selectedFile && (
            <div className="w-full mt-3 p-3 rounded-xl bg-hyper-accent/10 border border-hyper-accent/30 flex items-center justify-between font-mono text-xs">
              <span className="text-white truncate max-w-[240px]">{selectedFile.name}</span>
              <span className="text-hyper-accent">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          )}
        </div>

        {selectedFile && (
          <button
            onClick={handleStartTransfer}
            className="w-full py-3 bg-hyper-accent hover:bg-cyan-400 text-hyper-900 font-extrabold rounded-xl transition-colors shadow-lg shadow-hyper-accent/20 flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Send File to Remote Machine</span>
          </button>
        )}

        {/* Active & Completed Transfers Queue */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Transfer Queue & History</h4>

          <div className="max-h-40 overflow-y-auto space-y-2 scrollbar-thin">
            {activeTransfers.length === 0 ? (
              <p className="text-xs text-slate-600 italic font-mono">No active or past file transfers.</p>
            ) : (
              activeTransfers.map((item, idx) => (
                <div key={idx} className="bg-hyper-900 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span className="font-bold truncate max-w-[200px]">{item.name}</span>
                    <span className="text-hyper-accent">{item.progressPct?.toFixed(0)}% ({item.speedMbps || '0'} MB/s)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-hyper-accent to-emerald-400 transition-all duration-200"
                      style={{ width: `${item.progressPct}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
