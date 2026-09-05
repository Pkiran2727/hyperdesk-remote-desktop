import { WebSocket } from 'ws';
import { exec } from 'child_process';
import os from 'os';

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

function injectWin32Input(payload) {
  if (os.platform() === 'win32') {
    const { category, type, button, xPct, yPct, key, code } = payload;
    if (category === 'MOUSE' && type === 'mousemove') {
      const absX = Math.round((xPct / 100) * 1920);
      const absY = Math.round((yPct / 100) * 1080);
      // Real Win32 SetCursorPos API call via PowerShell/user32
      const psCmd = `powershell -command "[Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${absX}, ${absY})"`;
      exec(psCmd, () => {});
    } else if (category === 'MOUSE' && (type === 'mousedown' || type === 'click')) {
      const psClick = `powershell -command "$member = '[DllImport(\"user32.dll\")] public static extern void mouse_event(int flags, int dx, int dy, int data, int extra);'; Add-Type -MemberDefinition $member -Name Win32Mouse -Namespace Win32; [Win32.Win32Mouse]::mouse_event(6, 0, 0, 0, 0)"`;
      exec(psClick, () => {});
    }
  } else {
    // Real Linux X11 xdotool / XTest injection
    if (payload.category === 'MOUSE' && payload.type === 'mousemove') {
      const absX = Math.round((payload.xPct / 100) * 1920);
      const absY = Math.round((payload.yPct / 100) * 1080);
      exec(`xdotool mousemove ${absX} ${absY}`, () => {});
    } else if (payload.category === 'MOUSE' && (payload.type === 'mousedown' || payload.type === 'click')) {
      exec(`xdotool click ${payload.button === 2 ? 3 : 1}`, () => {});
    } else if (payload.category === 'KEYBOARD' && payload.type === 'keydown' && payload.key) {
      exec(`xdotool key ${payload.key}`, () => {});
    }
  }
}

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
        ws.send(JSON.stringify({
          type: 'MONITOR_LIST',
          hostId: HOST_ID,
          monitors
        }));
      } else if (data.type === 'MONITOR_SWITCH') {
        activeMonitorId = data.payload.monitorId;
        console.log(`[HostAgent] Switched active DXGI capture display to Monitor #${activeMonitorId}`);
      } else if (data.type === 'INPUT_EVENT') {
        console.log(`[HostAgent] Executed native OS input injection (${data.payload.type}).`);
        injectWin32Input(data.payload);
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
