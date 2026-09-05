import React, { useEffect, useRef, useState } from 'react';
import { Command, ShieldAlert, Monitor, Maximize2 } from 'lucide-react';

export default function RemoteCanvas({ stream, onSendInput }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle Mouse Movements & Click Events
  const handleMouseEvent = (type, e) => {
    if (!videoRef.current || !onSendInput) return;

    const rect = videoRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    onSendInput({
      category: 'MOUSE',
      type, // 'mousemove', 'mousedown', 'mouseup', 'click', 'contextmenu'
      button: e.button, // 0: left, 1: middle, 2: right
      xPct: Math.max(0, Math.min(100, xPct)),
      yPct: Math.max(0, Math.min(100, yPct)),
      timestamp: Date.now()
    });
  };

  // Handle Wheel Scroll
  const handleWheel = (e) => {
    if (!onSendInput) return;
    onSendInput({
      category: 'MOUSE',
      type: 'wheel',
      deltaY: e.deltaY,
      timestamp: Date.now()
    });
  };

  // Handle Keyboard Events
  const handleKeyDown = (e) => {
    if (!onSendInput) return;
    onSendInput({
      category: 'KEYBOARD',
      type: 'keydown',
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      timestamp: Date.now()
    });
  };

  const handleKeyUp = (e) => {
    if (!onSendInput) return;
    onSendInput({
      category: 'KEYBOARD',
      type: 'keyup',
      key: e.key,
      code: e.code,
      timestamp: Date.now()
    });
  };

  // Trigger Native OS Shortcut Macros
  const sendShortcut = (shortcutName) => {
    if (!onSendInput) return;
    onSendInput({
      category: 'SHORTCUT',
      name: shortcutName,
      timestamp: Date.now()
    });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col items-center justify-center bg-black group overflow-hidden">
      {/* Remote Desktop Canvas Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        tabIndex={0}
        onMouseMove={(e) => handleMouseEvent('mousemove', e)}
        onMouseDown={(e) => handleMouseEvent('mousedown', e)}
        onMouseUp={(e) => handleMouseEvent('mouseup', e)}
        onContextMenu={(e) => {
          e.preventDefault();
          handleMouseEvent('contextmenu', e);
        }}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className="w-full h-full object-contain cursor-crosshair outline-none max-h-[85vh]"
      />

      {/* Floating Toolbar for Remote System Shortcuts */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1 border-r border-slate-700 pr-3">
          <Command className="w-3.5 h-3.5 text-hyper-accent" />
          Remote Macros:
        </span>

        <button
          onClick={() => sendShortcut('CTRL_ALT_DEL')}
          className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-mono text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
        >
          <ShieldAlert className="w-3 h-3" />
          Ctrl+Alt+Del
        </button>

        <button
          onClick={() => sendShortcut('ALT_TAB')}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-mono text-xs font-semibold rounded-lg transition-colors"
        >
          Alt + Tab
        </button>

        <button
          onClick={() => sendShortcut('WINDOWS_KEY')}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-mono text-xs font-semibold rounded-lg transition-colors"
        >
          Win Key
        </button>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 bg-hyper-accent/20 hover:bg-hyper-accent/30 text-hyper-accent rounded-lg border border-hyper-accent/40 transition-colors ml-2"
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
