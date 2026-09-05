import React, { useState } from 'react';
import { Clipboard, Send, AlertTriangle, Check, History } from 'lucide-react';

const MAX_CLIPBOARD_BYTES = 1024 * 1024; // 1MB Payload Cap

export default function ClipboardSync({ onSendClipboard, clipboardLogs = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [warningMessage, setWarningMessage] = useState(null);
  const [copiedStatus, setCopiedStatus] = useState(false);

  const handleSendText = () => {
    if (!customText) return;

    // Check 1MB size threshold
    const textBytes = new Blob([customText]).size;
    if (textBytes > MAX_CLIPBOARD_BYTES) {
      setWarningMessage(`Payload exceeds 1MB limit (${(textBytes / (1024 * 1024)).toFixed(2)}MB). Payload truncated to 1MB.`);
      const truncatedText = customText.slice(0, 1024 * 1024);
      onSendClipboard(truncatedText);
    } else {
      setWarningMessage(null);
      onSendClipboard(customText);
    }

    setCustomText('');
  };

  const handleReadHostClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCustomText(text);
      }
    } catch (err) {
      console.warn('[ClipboardSync] Clipboard read blocked:', err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-mono text-xs font-semibold rounded-xl transition-colors"
        title="Bi-directional Clipboard Sync"
      >
        <Clipboard className="w-3.5 h-3.5 text-hyper-accent" />
        <span>Clipboard</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 glass-panel p-4 rounded-2xl shadow-2xl z-50 border border-slate-700 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
              <Clipboard className="w-3.5 h-3.5 text-hyper-accent" />
              CLIPBOARD SYNC (1MB MAX)
            </h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-xs font-mono"
            >
              ✕
            </button>
          </div>

          {warningMessage && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{warningMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Paste or type text to sync with remote machine..."
              rows={3}
              className="w-full bg-hyper-900 border border-slate-700 focus:border-hyper-accent rounded-xl p-2.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none scrollbar-thin resize-none"
            />

            <div className="flex items-center justify-between">
              <button
                onClick={handleReadHostClipboard}
                className="text-[11px] font-mono text-hyper-accent hover:underline"
              >
                Paste from Local Clipboard
              </button>

              <button
                onClick={handleSendText}
                disabled={!customText}
                className="flex items-center gap-1 px-3 py-1 bg-hyper-accent hover:bg-cyan-400 text-hyper-900 font-bold text-xs rounded-lg transition-colors disabled:opacity-40"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </button>
            </div>
          </div>

          {/* Sync History Log */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <History className="w-3 h-3 text-hyper-accent" />
              Sync History
            </span>
            <div className="max-h-24 overflow-y-auto space-y-1 scrollbar-thin">
              {clipboardLogs.length === 0 ? (
                <p className="text-[11px] text-slate-600 italic">No sync events yet.</p>
              ) : (
                clipboardLogs.map((item, idx) => (
                  <div key={idx} className="bg-hyper-900 p-1.5 rounded text-[11px] font-mono text-slate-300 truncate border border-slate-800/80">
                    <span className="text-hyper-accent">[{item.time}]</span> {item.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
