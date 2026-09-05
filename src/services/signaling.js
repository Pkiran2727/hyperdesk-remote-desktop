export class SignalingClient {
  constructor(url = 'ws://localhost:8080') {
    this.url = url;
    this.ws = null;
    this.listeners = new Map();
    this.isConnected = false;
    this.reconnectTimer = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.emit('connected');
          console.log('[SignalingClient] Connected to server');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit(data.type, data);
          } catch (e) {
            console.error('[SignalingClient] Failed to parse message:', e);
          }
        };

        this.ws.onerror = (err) => {
          console.error('[SignalingClient] WebSocket error:', err);
          this.emit('error', err);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.emit('disconnected');
          console.log('[SignalingClient] Disconnected from server');
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    } else {
      console.warn('[SignalingClient] WebSocket is not open. State:', this.ws?.readyState);
    }
  }

  registerHost(hostId, passcode) {
    this.send('REGISTER_HOST', { hostId, passcode });
  }

  joinSession(hostId, passcode) {
    this.send('JOIN_SESSION', { hostId, passcode });
  }

  sendOffer(hostId, offer) {
    this.send('SDP_OFFER', { hostId, payload: offer });
  }

  sendAnswer(hostId, answer) {
    this.send('SDP_ANSWER', { hostId, payload: answer });
  }

  sendIceCandidate(hostId, candidate) {
    this.send('ICE_CANDIDATE', { hostId, payload: candidate });
  }

  endSession(hostId) {
    this.send('END_SESSION', { hostId });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
      this.listeners.set(event, callbacks);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
