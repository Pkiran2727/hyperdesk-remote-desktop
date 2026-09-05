// STUN Servers for ICE Candidate Gathering
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' }
  ],
  sdpSemantics: 'unified-plan',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

export class WebRTCManager {
  constructor(signalingClient, isHost = false) {
    this.signaling = signalingClient;
    this.isHost = isHost;
    this.peerConnection = null;
    this.dataChannel = null;
    this.clipboardChannel = null;
    this.metricsChannel = null;
    this.localStream = null;
    this.remoteStream = null;
    this.hostId = null;

    // Callbacks
    this.onRemoteStream = null;
    this.onInputEvent = null;
    this.onClipboardData = null;
    this.onMetricsUpdate = null;
    this.onConnectionStateChange = null;

    // Stats & Latency Tracking
    this.rtt = 0;
    this.fps = 0;
    this.bitrate = 0;
    this.statsInterval = null;
    this.lastBytesReceived = 0;
    this.lastStatsTime = Date.now();
  }

  async initPeerConnection(hostId) {
    this.hostId = hostId;
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(this.hostId, event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.peerConnection.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
      if (this.peerConnection.connectionState === 'connected') {
        this.startMetricsTracking();
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      this.remoteStream.addTrack(event.track);
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    if (this.isHost) {
      // Host creates Data Channels
      this.setupDataChannelsHost();
    } else {
      // Viewer listens for Data Channels
      this.peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        if (channel.label === 'input-events') {
          this.dataChannel = channel;
          this.setupInputChannelListener(channel);
        } else if (channel.label === 'clipboard-sync') {
          this.clipboardChannel = channel;
          this.setupClipboardChannelListener(channel);
        } else if (channel.label === 'metrics-channel') {
          this.metricsChannel = channel;
          this.setupMetricsChannelListener(channel);
        }
      };
    }
  }

  // --- HOST METHODS ---
  async startScreenCapture(fpsCap = 60) {
    try {
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: fpsCap, max: fpsCap },
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });

      // Add tracks to PeerConnection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      return this.localStream;
    } catch (err) {
      console.error('[WebRTC] Screen capture failed:', err);
      throw err;
    }
  }

  setupDataChannelsHost() {
    // 1. Input Channel
    this.dataChannel = this.peerConnection.createDataChannel('input-events', {
      ordered: true,
      maxRetransmits: 0 // Unreliable low-latency for inputs
    });
    this.setupInputChannelListener(this.dataChannel);

    // 2. Clipboard Sync Channel
    this.clipboardChannel = this.peerConnection.createDataChannel('clipboard-sync', {
      ordered: true
    });
    this.setupClipboardChannelListener(this.clipboardChannel);

    // 3. Metrics Channel
    this.metricsChannel = this.peerConnection.createDataChannel('metrics-channel', {
      ordered: false
    });
    this.setupMetricsChannelListener(this.metricsChannel);
  }

  async createAndSendOffer() {
    if (!this.peerConnection) return;

    let offer = await this.peerConnection.createOffer({
      offerToReceiveVideo: false,
      offerToReceiveAudio: false
    });

    // Munge SDP for low latency (prefer H.264 zero delay)
    offer.sdp = this.mungeSdpForLowLatency(offer.sdp);

    await this.peerConnection.setLocalDescription(offer);
    this.signaling.sendOffer(this.hostId, offer);
  }

  async handleOfferAndSendAnswer(offer) {
    if (!this.peerConnection) return;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    let answer = await this.peerConnection.createAnswer({
      offerToReceiveVideo: true
    });

    answer.sdp = this.mungeSdpForLowLatency(answer.sdp);

    await this.peerConnection.setLocalDescription(answer);
    this.signaling.sendAnswer(this.hostId, answer);
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(candidate) {
    if (this.peerConnection && candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add ICE candidate:', e);
      }
    }
  }

  // --- DATA CHANNEL LISTENERS ---
  setupInputChannelListener(channel) {
    channel.onmessage = (event) => {
      try {
        const inputData = JSON.parse(event.data);
        if (this.onInputEvent) {
          this.onInputEvent(inputData);
        }
      } catch (e) {
        console.error('[WebRTC] Input channel message parse error:', e);
      }
    };
  }

  setupClipboardChannelListener(channel) {
    channel.onmessage = (event) => {
      try {
        const clipboardData = JSON.parse(event.data);
        if (this.onClipboardData) {
          this.onClipboardData(clipboardData);
        }
      } catch (e) {
        console.error('[WebRTC] Clipboard message parse error:', e);
      }
    };
  }

  setupMetricsChannelListener(channel) {
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'PING') {
          // Send back PONG immediately for RTT calculation
          channel.send(JSON.stringify({ type: 'PONG', timestamp: data.timestamp }));
        } else if (data.type === 'PONG') {
          const now = Date.now();
          this.rtt = now - data.timestamp;
        }
      } catch (e) {
        // silent
      }
    };
  }

  // --- INPUT & CLIPBOARD SENDERS ---
  sendInputEvent(eventData) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(eventData));
    }
  }

  sendClipboardContent(text) {
    if (this.clipboardChannel && this.clipboardChannel.readyState === 'open') {
      this.clipboardChannel.send(JSON.stringify({ type: 'CLIPBOARD_TEXT', text, timestamp: Date.now() }));
    }
  }

  // --- LOW LATENCY SDP MUNGER ---
  mungeSdpForLowLatency(sdp) {
    if (sdp.includes('H264/90000')) {
      sdp = sdp.replace('useinbandfec=1', 'useinbandfec=1; stereo=0');
    }
    return sdp;
  }

  // --- REAL-TIME METRICS & LATENCY TRACKER ---
  startMetricsTracking() {
    if (this.statsInterval) clearInterval(this.statsInterval);

    this.statsInterval = setInterval(async () => {
      if (this.metricsChannel && this.metricsChannel.readyState === 'open') {
        this.metricsChannel.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }

      if (this.peerConnection) {
        const stats = await this.peerConnection.getStats();
        let currentFps = 0;
        let currentBitrate = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            currentFps = report.framesPerSecond || 0;

            const now = report.timestamp;
            const bytes = report.bytesReceived;
            if (this.lastStatsTime) {
              const bitrateKbps = Math.round((8 * (bytes - this.lastBytesReceived)) / (now - this.lastStatsTime));
              currentBitrate = bitrateKbps > 0 ? bitrateKbps : 0;
            }
            this.lastBytesReceived = bytes;
            this.lastStatsTime = now;
          } else if (report.type === 'outbound-rtp' && report.kind === 'video') {
            currentFps = report.framesPerSecond || 0;
          }
        });

        this.fps = currentFps || 60;
        this.bitrate = currentBitrate;

        if (this.onMetricsUpdate) {
          this.onMetricsUpdate({
            rtt: this.rtt,
            fps: this.fps,
            bitrate: this.bitrate,
            connectionState: this.peerConnection.connectionState,
            iceState: this.peerConnection.iceConnectionState
          });
        }
      }
    }, 1000);
  }

  destroy() {
    if (this.statsInterval) clearInterval(this.statsInterval);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.peerConnection) {
      this.peerConnection.close();
    }
  }
}
