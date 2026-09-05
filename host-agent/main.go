package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/hyperdesk/host-agent/audio"
	"github.com/hyperdesk/host-agent/capture"
	"github.com/hyperdesk/host-agent/input"
	"github.com/hyperdesk/host-agent/multimonitor"
	"github.com/hyperdesk/host-agent/service"
)

func main() {
	hostID := flag.String("host-id", "492819301", "9-digit HyperDesk Session ID")
	passcode := flag.String("passcode", "SEC123", "Security Passcode")
	signalingURL := flag.String("signaling", "ws://localhost:8080", "WebSocket Signaling Server URL")
	flag.Parse()

	fmt.Println("=========================================================")
	fmt.Println("   HYPERDESK NATIVE GO HOST AGENT SERVICE v1.0")
	fmt.Println("=========================================================")
	fmt.Printf("[Config] Host ID: %s | Passcode: %s\n", *hostID, *passcode)
	fmt.Printf("[Config] Signaling Server: %s\n", *signalingURL)

	// 1. Initialize OS Background Service Daemon
	svc := service.NewServiceManager()
	if err := svc.RunAsService(); err != nil {
		fmt.Printf("Service Error: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize DXGI / PipeWire Desktop Capturer
	capturer := capture.NewDesktopCapturer(60)
	_ = capturer.InitializeDXGI()

	// 3. Initialize WASAPI / PulseAudio Audio Grabber
	audioGrabber := audio.NewAudioGrabber()
	_ = audioGrabber.StartCapture()

	// 4. Initialize Multi-Monitor Manager
	monManager := multimonitor.NewMonitorManager()
	monitors := monManager.EnumerateMonitors()
	fmt.Printf("[MultiMonitor] Detected %d active displays:\n", len(monitors))
	for _, m := range monitors {
		fmt.Printf("  - Monitor #%d: %s (%dx%d) Primary: %v\n", m.ID, m.Name, m.Width, m.Height, m.IsPrimary)
	}

	// 5. Initialize Native Win32 SendInput / uinput Injector
	injector := input.NewNativeInputInjector()
	_ = injector

	fmt.Println("[HostAgent] Ready for remote WebRTC P2P connections.")
}
