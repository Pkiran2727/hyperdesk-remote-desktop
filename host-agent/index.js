import { spawn } from 'child_process';
import path from 'path';
import fileURLToPath from 'url';

const SIGNALING_URL = process.env.SIGNALING_URL || 'ws://localhost:8080';
const HOST_ID = process.env.HOST_ID || '492819301';
const PASSCODE = process.env.PASSCODE || 'SEC123';

console.log('=========================================================');
console.log('   HYPERDESK NATIVE GO HOST AGENT LAUNCHER CLI v1.0');
console.log('=========================================================');
console.log(`[HostLauncher] Configured Host ID: ${HOST_ID}`);
console.log(`[HostLauncher] Configured Passcode: ${PASSCODE}`);
console.log(`[HostLauncher] Signaling Server: ${SIGNALING_URL}`);

let nativeProcess = null;

function launchNativeHostAgent() {
  console.log('[HostLauncher] Launching autonomous Native Go Host Agent Service...');

  const args = [
    'run',
    'main.go',
    `-host-id=${HOST_ID}`,
    `-passcode=${PASSCODE}`,
    `-signaling=${SIGNALING_URL}`
  ];

  const agentDir = path.dirname(fileURLToPath(import.meta.url));

  nativeProcess = spawn('go', args, {
    cwd: agentDir,
    stdio: 'inherit',
    env: { ...process.env }
  });

  nativeProcess.on('exit', (code, signal) => {
    console.log(`[HostLauncher] Native Host Agent exited with code ${code} signal ${signal}.`);
  });

  nativeProcess.on('error', (err) => {
    console.error(`[HostLauncher] Failed to launch Go Native Host Agent: ${err.message}`);
  });
}

launchNativeHostAgent();

