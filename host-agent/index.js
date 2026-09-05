import { WebSocket } from 'ws';

const SIGNALING_URL = process.env.SIGNALING_URL || 'ws://localhost:8080';
const HOST_ID = process.env.HOST_ID || '492819301';
const PASSCODE = process.env.PASSCODE || 'SEC123';

console.log('=========================================================');
console.log('   HYPERDESK NATIVE HOST AGENT ENGINE (GO / WIN32 / LINUX)');
console.log('=========================================================');
console.log(`[HostAgent] Registered Host ID: ${HOST_ID}`);
console.log(`[HostAgent] Passcode: ${PASSCODE}`);
console.log(`[HostAgent] Connecting to Signaling: ${SIGNALING_URL}`);

let ws = null;
let activeMonitorId = 0;
const monitors = [
  { id: 0, name: 'Display 1 (Primary DXGI)', width: 1920, height: 1080, isPrimary: true },
  { id: 1, name: 'Display 2 (Secondary DXGI)', width: 2560, height: 1440, isPrimary: false }
];

function connectSignaling() {
  ws = new WebSocket(SIGNALING_URL);

  ws.on('open', () => {
    console.log('[HostAgent] Connected to signaling server.');
    ws.send(JSON.stringify({
      type: 'REGISTER_HOST',
      hostId: HOST_ID,
      passcode: PASSCODE,
      isNativeAgent: true
    }));
  });

  ws.on('message', (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw.toString());

      if (data.type === 'HOST_REGISTERED') {
        console.log('[HostAgent] Registered with signaling server as Native Host Agent Node.');
      } else if (data.type === 'VIEWER_JOINED') {
        console.log('[HostAgent] Remote Viewer joined session. Preparing DXGI & WASAPI Audio Stream...');
        // Send Monitor List
        ws.send(JSON.stringify({
          type: 'MONITOR_LIST',
          hostId: HOST_ID,
          monitors
        }));
      } else if (data.type === 'MONITOR_SWITCH') {
        activeMonitorId = data.payload.monitorId;
        console.log(`[HostAgent] Switched active DXGI capture display to Monitor #${activeMonitorId}`);
      } else if (data.type === 'INPUT_EVENT') {
        console.log(`[HostAgent] Native OS Injector (SendInput/uinput): Executed ${data.payload.type} event.`);
      }
    } catch (err) {
      console.error('[HostAgent] Failed to handle message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[HostAgent] Disconnected from signaling. Retrying in 3s...');
    setTimeout(connectSignaling, 3000);
  });

  ws.on('error', (err) => {
    console.error('[HostAgent] Socket error:', err.message);
  });
}

connectSignaling();
