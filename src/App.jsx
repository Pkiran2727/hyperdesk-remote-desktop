import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import HostView from './components/HostView';
import ViewerView from './components/ViewerView';
import SettingsModal from './components/SettingsModal';
import ReconnectBanner from './components/ReconnectBanner';
import { SignalingClient } from './services/signaling';
import { WebRTCManager } from './services/webrtc';

// Random 9-digit generator (AnyDesk format)
const generateHostId = () => {
  const rand = Math.floor(100000000 + Math.random() * 900000000);
  return rand.toString();
};

// Random 6-char passcode generator
const generatePasscode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default function App() {
  const [activeMode, setActiveMode] = useState('host'); // 'host' or 'viewer'
  const [hostId, setHostId] = useState(generateHostId());
  const [passcode, setPasscode] = useState(generatePasscode());
  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('idle');
  const [remoteStream, setRemoteStream] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Auto-reconnect & Metrics State
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [nextRetrySec, setNextRetrySec] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [inputLogs, setInputLogs] = useState([]);
  const [clipboardLogs, setClipboardLogs] = useState([]);

  // Config State
  const [config, setConfig] = useState({
    serverUrl: 'ws://localhost:8080',
    targetFps: 60,
    qualityMode: 'low-latency'
  });

  const signalingRef = useRef(null);
  const rtcManagerRef = useRef(null);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    // 1. Initialize Signaling Client
    const client = new SignalingClient(config.serverUrl);
    signalingRef.current = client;

    client.on('connected', () => {
      setIsSignalingConnected(true);
      setErrorMessage(null);
      // Auto register if host
      if (activeMode === 'host') {
        client.registerHost(hostId, passcode);
      }
    });

    client.on('disconnected', () => {
      setIsSignalingConnected(false);
    });

    client.on('ERROR', (data) => {
      setErrorMessage(data.message);
      setConnectionState('idle');
    });

    client.on('VIEWER_JOINED', async () => {
      console.log('[App] Viewer joined room. Initiating WebRTC Offer...');
      if (rtcManagerRef.current) {
        await rtcManagerRef.current.createAndSendOffer();
      }
    });

    client.on('SDP_OFFER', async (data) => {
      console.log('[App] Received SDP Offer. Creating Answer...');
      if (rtcManagerRef.current) {
        await rtcManagerRef.current.handleOfferAndSendAnswer(data.payload);
      }
    });

    client.on('SDP_ANSWER', async (data) => {
      console.log('[App] Received SDP Answer.');
      if (rtcManagerRef.current) {
        await rtcManagerRef.current.handleAnswer(data.payload);
      }
    });

    client.on('ICE_CANDIDATE', async (data) => {
      if (rtcManagerRef.current) {
        await rtcManagerRef.current.addIceCandidate(data.payload);
      }
    });

    client.on('SESSION_ENDED', () => {
      handleDisconnectSession();
    });

    client.connect().catch((err) => {
      console.error('[App] Failed to connect signaling:', err);
    });

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (rtcManagerRef.current) rtcManagerRef.current.destroy();
      if (signalingRef.current) signalingRef.current.disconnect();
    };
  }, [config.serverUrl, hostId, passcode, activeMode]);

  // Handle Host Start Broadcast (Native Agent Mode)
  const handleStartBroadcasting = async () => {
    try {
      setIsBroadcasting(true);
      setConnectionState('connected');

      if (signalingRef.current && isSignalingConnected) {
        signalingRef.current.registerHost(hostId, passcode);
      }
      console.log('[App] Native Host Agent active. Registered Host ID with signaling server.');
    } catch (err) {
      console.error('[App] Failed to set native host active:', err);
      setErrorMessage('Failed to start host broadcast: ' + err.message);
    }
  };

  const handleStopBroadcasting = () => {
    if (rtcManagerRef.current) {
      rtcManagerRef.current.destroy();
      rtcManagerRef.current = null;
    }
    setIsBroadcasting(false);
    setIsConnected(false);
    setConnectionState('idle');
  };

  // Handle Viewer Connect Session
  const handleConnectSession = async (targetId, targetPass) => {
    setErrorMessage(null);
    setConnectionState('connecting');

    try {
      const isHost = false;
      const rtc = new WebRTCManager(signalingRef.current, isHost);
      rtcManagerRef.current = rtc;

      rtc.onRemoteStream = (stream) => {
        setRemoteStream(stream);
        setIsConnected(true);
        setConnectionState('connected');
        setIsReconnecting(false);
      };

      rtc.onConnectionStateChange = (state) => {
        setConnectionState(state);
        if (state === 'disconnected' || state === 'failed') {
          triggerAutoReconnect();
        }
      };

      rtc.onClipboardData = (clipData) => {
        const time = new Date().toLocaleTimeString();
        setClipboardLogs((prev) => [
          { time, text: clipData.text },
          ...prev.slice(0, 19)
        ]);
      };

      rtc.onMetricsUpdate = (metricsData) => {
        setMetrics(metricsData);
      };

      await rtc.initPeerConnection(targetId);

      // Send JOIN_SESSION to Signaling Server
      if (signalingRef.current) {
        signalingRef.current.joinSession(targetId, targetPass);
      }
    } catch (err) {
      console.error('[App] Connect session failed:', err);
      setErrorMessage('Connection failed: ' + err.message);
      setConnectionState('idle');
    }
  };

  const handleDisconnectSession = () => {
    if (rtcManagerRef.current) {
      rtcManagerRef.current.destroy();
      rtcManagerRef.current = null;
    }
    setIsConnected(false);
    setRemoteStream(null);
    setConnectionState('idle');
  };

  // Exponential Backoff Auto-Reconnect Engine (1s, 2s, 4s, 8s, max 16s)
  const triggerAutoReconnect = () => {
    if (isReconnecting) return;
    setIsReconnecting(true);

    const backoffSecs = Math.min(Math.pow(2, retryCount), 16);
    setNextRetrySec(backoffSecs);

    let countdown = backoffSecs;
    const interval = setInterval(() => {
      countdown -= 1;
      setNextRetrySec(countdown);
      if (countdown <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    retryTimerRef.current = setTimeout(async () => {
      setRetryCount((prev) => prev + 1);
      console.log(`[App] Auto-reconnecting attempt #${retryCount + 1}...`);

      if (rtcManagerRef.current && rtcManagerRef.current.hostId) {
        try {
          await rtcManagerRef.current.createAndSendOffer();
        } catch (e) {
          setIsReconnecting(false);
        }
      } else {
        setIsReconnecting(false);
      }
    }, backoffSecs * 1000);
  };

  // Send Remote Input from Viewer
  const handleSendInput = (eventData) => {
    if (rtcManagerRef.current) {
      rtcManagerRef.current.sendInputEvent(eventData);
    }
  };

  // Send Clipboard Text
  const handleSendClipboard = (text) => {
    if (rtcManagerRef.current) {
      rtcManagerRef.current.sendClipboardContent(text);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-hyper-900 text-slate-100">
      {/* Top Navbar */}
      <Navbar
        isSignalingConnected={isSignalingConnected}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeMode={activeMode}
        setActiveMode={setActiveMode}
      />

      {/* Auto-Reconnect Banner Alert */}
      <ReconnectBanner
        isReconnecting={isReconnecting}
        retryCount={retryCount}
        nextRetrySec={nextRetrySec}
      />

      {/* Main View Container */}
      <main className="flex-1 p-6">
        {activeMode === 'host' ? (
          <HostView
            hostId={hostId}
            passcode={passcode}
            onGeneratePasscode={() => setPasscode(generatePasscode())}
            isBroadcasting={isBroadcasting}
            onStartBroadcasting={handleStartBroadcasting}
            onStopBroadcasting={handleStopBroadcasting}
            connectionState={connectionState}
            inputLogs={inputLogs}
          />
        ) : (
          <ViewerView
            onConnect={handleConnectSession}
            onDisconnect={handleDisconnectSession}
            isConnected={isConnected}
            connectionState={connectionState}
            remoteStream={remoteStream}
            onSendInput={handleSendInput}
            onSendClipboard={handleSendClipboard}
            clipboardLogs={clipboardLogs}
            metrics={metrics}
            errorMessage={errorMessage}
          />
        )}
      </main>

      {/* Settings Configuration Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={(newCfg) => setConfig(newCfg)}
      />
    </div>
  );
}
