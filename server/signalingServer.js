import { WebSocketServer } from 'ws';
import { RateLimiter } from '../signaling-server/rateLimiter.js';
import { RedisClusterManager } from '../signaling-server/redisCluster.js';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });
const rateLimiter = new RateLimiter();
const redisCluster = new RedisClusterManager();

redisCluster.init();

// Map of active rooms: hostId -> { hostSocket, passcode, viewerSocket, createdAt }
const rooms = new Map();

console.log(`[HyperDesk Signaling HA] Server running on ws://localhost:${PORT} with DDoS RateLimiter & Redis HA`);

wss.on('connection', (ws, req) => {
  const clientIp = req?.socket?.remoteAddress || '127.0.0.1';
  let currentHostId = null;
  let clientType = null; // 'host' or 'viewer'

  ws.on('message', (messageRaw) => {
    try {
      // 1. IP Token Bucket Rate Limit Check
      if (rateLimiter.isRateLimited(clientIp)) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Rate limit exceeded. Too many requests.' }));
        return;
      }

      const message = JSON.parse(messageRaw.toString());
      const { type, hostId, passcode, payload } = message;

      switch (type) {
        case 'REGISTER_HOST': {
          if (!hostId || !passcode) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing hostId or passcode' }));
            return;
          }

          const existingRoom = rooms.get(hostId);
          const roomState = {
            hostSocket: ws,
            passcode,
            viewerSocket: existingRoom ? existingRoom.viewerSocket : null,
            createdAt: Date.now()
          };

          rooms.set(hostId, roomState);
          redisCluster.setRoomState(hostId, roomState);

          currentHostId = hostId;
          clientType = 'host';

          ws.send(JSON.stringify({
            type: 'HOST_REGISTERED',
            hostId,
            status: 'WAITING_FOR_VIEWER'
          }));
          console.log(`[Signaling] Registered host: ${hostId}`);
          break;
        }

        case 'JOIN_SESSION': {
          // 2. Brute-Force Lockout Check
          if (rateLimiter.isLockedOut(clientIp, hostId)) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Too many failed attempts. Room locked out for 15 minutes.' }));
            return;
          }

          const room = rooms.get(hostId);
          if (!room || !room.hostSocket) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Session ID not found or offline' }));
            return;
          }

          if (room.passcode !== passcode) {
            rateLimiter.recordFailedAttempt(clientIp, hostId);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid passcode' }));
            return;
          }

          // Successful authentication -> reset attempts
          rateLimiter.resetAttempts(clientIp, hostId);

          room.viewerSocket = ws;
          currentHostId = hostId;
          clientType = 'viewer';

          ws.send(JSON.stringify({ type: 'SESSION_JOINED', hostId }));
          room.hostSocket.send(JSON.stringify({ type: 'VIEWER_JOINED', hostId }));
          console.log(`[Signaling] Viewer joined room: ${hostId}`);
          break;
        }

        case 'SDP_OFFER': {
          const room = rooms.get(hostId);
          if (room && room.viewerSocket) {
            room.viewerSocket.send(JSON.stringify({ type: 'SDP_OFFER', payload }));
          }
          break;
        }

        case 'SDP_ANSWER': {
          const room = rooms.get(hostId);
          if (room && room.hostSocket) {
            room.hostSocket.send(JSON.stringify({ type: 'SDP_ANSWER', payload }));
          }
          break;
        }

        case 'ICE_CANDIDATE': {
          const room = rooms.get(hostId);
          if (!room) return;

          if (clientType === 'host' && room.viewerSocket) {
            room.viewerSocket.send(JSON.stringify({ type: 'ICE_CANDIDATE', payload, sender: 'host' }));
          } else if (clientType === 'viewer' && room.hostSocket) {
            room.hostSocket.send(JSON.stringify({ type: 'ICE_CANDIDATE', payload, sender: 'viewer' }));
          }
          break;
        }

        case 'MONITOR_LIST': {
          const room = rooms.get(hostId);
          if (room && room.viewerSocket) {
            room.viewerSocket.send(JSON.stringify({ type: 'MONITOR_LIST', monitors: message.monitors }));
          }
          break;
        }

        case 'MONITOR_SWITCH': {
          const room = rooms.get(hostId);
          if (room && room.hostSocket) {
            room.hostSocket.send(JSON.stringify({ type: 'MONITOR_SWITCH', payload }));
          }
          break;
        }

        case 'END_SESSION': {
          const room = rooms.get(hostId);
          if (room) {
            if (room.hostSocket) room.hostSocket.send(JSON.stringify({ type: 'SESSION_ENDED' }));
            if (room.viewerSocket) room.viewerSocket.send(JSON.stringify({ type: 'SESSION_ENDED' }));
            rooms.delete(hostId);
            redisCluster.deleteRoomState(hostId);
          }
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }

        default:
          console.warn('[Signaling] Unknown message type:', type);
      }
    } catch (err) {
      console.error('[Signaling] Failed to process message:', err);
    }
  });

  ws.on('close', () => {
    if (currentHostId) {
      const room = rooms.get(currentHostId);
      if (room) {
        if (clientType === 'host') {
          if (room.viewerSocket) room.viewerSocket.send(JSON.stringify({ type: 'HOST_DISCONNECTED' }));
          rooms.delete(currentHostId);
          redisCluster.deleteRoomState(currentHostId);
        } else if (clientType === 'viewer') {
          room.viewerSocket = null;
          if (room.hostSocket) room.hostSocket.send(JSON.stringify({ type: 'VIEWER_DISCONNECTED' }));
        }
      }
    }
  });
});
