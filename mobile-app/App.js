import React, { useState } from 'react';
import { TouchGestureTranslator } from './src/components/TouchCanvas';

export default function MobileApp() {
  const [hostId, setHostId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [virtualKeyText, setVirtualKeyText] = useState('');

  const translator = new TouchGestureTranslator(1920, 1080);

  const handleConnect = () => {
    if (hostId && passcode) {
      setIsConnected(true);
    }
  };

  return {
    appName: 'HyperDesk Mobile Client (iOS / Android)',
    version: '1.0.0',
    isConnected,
    hostId,
    virtualKeyText
  };
}
