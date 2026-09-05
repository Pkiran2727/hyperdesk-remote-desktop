import React, { useState, useRef, useEffect } from 'react';
import { Video, Square, Download, Circle } from 'lucide-react';

export default function SessionRecorder({ mediaStream }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    if (!mediaStream) return;

    try {
      chunksRef.current = [];
      const options = { mimeType: 'video/webm;codecs=vp8,opus' };

      // Fallback mimeTypes if VP8 is unsupported in current browser environment
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(mediaStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recorder.start(1000); // Save chunk every 1 second
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('[SessionRecorder] Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const downloadRecording = () => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HyperDesk_Session_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 p-1.5 rounded-xl">
      {!isRecording ? (
        <button
          onClick={startRecording}
          disabled={!mediaStream}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-mono text-xs font-bold rounded-lg transition-colors disabled:opacity-40"
          title="Start Session Recording"
        >
          <Circle className="w-3.5 h-3.5 fill-current animate-pulse text-rose-500" />
          <span>REC</span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/20 text-rose-400 font-mono text-xs font-bold rounded-lg border border-rose-500/40">
            <Circle className="w-3 h-3 fill-current animate-ping text-rose-500" />
            <span>{formatTime(recordingTime)}</span>
          </div>

          <button
            onClick={stopRecording}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
            title="Stop Recording"
          >
            <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
          </button>
        </div>
      )}

      {recordedBlob && !isRecording && (
        <button
          onClick={downloadRecording}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-mono text-xs font-bold rounded-lg transition-colors animate-bounce"
          title="Download Recorded WebM Video"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save HD Video</span>
        </button>
      )}
    </div>
  );
}
