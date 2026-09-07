package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hyperdesk/host-agent/audio"
	"github.com/hyperdesk/host-agent/capture"
	"github.com/hyperdesk/host-agent/input"
	"github.com/hyperdesk/host-agent/multimonitor"
	"github.com/hyperdesk/host-agent/video"
	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
)

// SignalingMessage defines the exact wire contract for HyperDesk Signaling Server
type SignalingMessage struct {
	Type          string                     `json:"type"`
	HostID        string                     `json:"hostId,omitempty"`
	Passcode      string                     `json:"passcode,omitempty"`
	Payload       json.RawMessage            `json:"payload,omitempty"`
	Monitors      []multimonitor.MonitorInfo `json:"monitors,omitempty"`
	IsNativeAgent bool                       `json:"isNativeAgent,omitempty"`
}

type NativeHostDaemon struct {
	HostID       string
	Passcode     string
	SignalingURL string
	FPS          int

	capturer     *capture.DesktopCapturer
	vp8Encoder   *video.VP8Encoder
	audioGrabber *audio.AudioGrabber
	monManager   *multimonitor.MonitorManager
	injector     *input.NativeInputInjector

	peerConn     *webrtc.PeerConnection
	videoTrack   *webrtc.TrackLocalStaticSample
	audioTrack   *webrtc.TrackLocalStaticSample
	inputChannel *webrtc.DataChannel

	wsConn       *websocket.Conn
	mu           sync.Mutex
}

func NewNativeHostDaemon(hostID, passcode, signalingURL string, fps int) *NativeHostDaemon {
	capturer := capture.NewDesktopCapturer(fps)
	_ = capturer.InitializeDXGI()

	return &NativeHostDaemon{
		HostID:       hostID,
		Passcode:     passcode,
		SignalingURL: signalingURL,
		FPS:          fps,
		capturer:     capturer,
		vp8Encoder:   video.NewVP8Encoder(1920, 1080, fps),
		audioGrabber: audio.NewAudioGrabber(),
		monManager:   multimonitor.NewMonitorManager(),
		injector:     input.NewNativeInputInjector(),
	}
}

func (d *NativeHostDaemon) Start(ctx context.Context) error {
	_ = d.audioGrabber.StartCapture()

	fmt.Println("=========================================================")
	fmt.Println("   HYPERDESK NATIVE GO HOST AGENT SERVICE v1.0")
	fmt.Println("=========================================================")
	fmt.Printf("[Config] Host ID: %s | Passcode: %s\n", d.HostID, d.Passcode)
	fmt.Printf("[Config] Signaling Server: %s\n", d.SignalingURL)

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			err := d.connectAndRun(ctx)
			if err != nil {
				log.Printf("[Signaling] Connection error: %v. Retrying in 3s...", err)
				time.Sleep(3 * time.Second)
			}
		}
	}
}

func (d *NativeHostDaemon) connectAndRun(ctx context.Context) error {
	conn, _, err := websocket.DefaultDialer.Dial(d.SignalingURL, nil)
	if err != nil {
		return err
	}

	d.mu.Lock()
	d.wsConn = conn
	d.mu.Unlock()

	defer func() {
		d.mu.Lock()
		if d.wsConn != nil {
			d.wsConn.Close()
			d.wsConn = nil
		}
		d.mu.Unlock()
	}()

	log.Printf("[Signaling] Connected to WebSocket signaling server: %s", d.SignalingURL)

	// Register host with signaling server
	regMsg := SignalingMessage{
		Type:          "REGISTER_HOST",
		HostID:        d.HostID,
		Passcode:      d.Passcode,
		IsNativeAgent: true,
	}

	d.mu.Lock()
	err = conn.WriteJSON(regMsg)
	d.mu.Unlock()
	if err != nil {
		return err
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			var msg SignalingMessage
			if err := conn.ReadJSON(&msg); err != nil {
				return err
			}
			d.handleSignalingMessage(ctx, msg)
		}
	}
}

func (d *NativeHostDaemon) handleSignalingMessage(ctx context.Context, msg SignalingMessage) {
	d.mu.Lock()
	defer d.mu.Unlock()

	switch msg.Type {
	case "HOST_REGISTERED":
		log.Printf("[HostAgent] Successfully registered with signaling server as Native Host Agent Node.")

	case "VIEWER_JOINED":
		log.Printf("[HostAgent] Viewer joined session. Initializing Pion WebRTC PeerConnection...")
		monitors := d.monManager.EnumerateMonitors()
		if d.wsConn != nil {
			_ = d.wsConn.WriteJSON(SignalingMessage{
				Type:     "MONITOR_LIST",
				HostID:   d.HostID,
				Monitors: monitors,
			})
		}
		go d.initPeerConnectionAndOffer(ctx)

	case "SDP_ANSWER":
		if d.peerConn != nil && msg.Payload != nil {
			var answer webrtc.SessionDescription
			if err := json.Unmarshal(msg.Payload, &answer); err == nil {
				_ = d.peerConn.SetRemoteDescription(answer)
				log.Printf("[WebRTC] Successfully set remote SDP answer.")
			}
		}

	case "ICE_CANDIDATE":
		if d.peerConn != nil && msg.Payload != nil {
			var candidate webrtc.ICECandidateInit
			if err := json.Unmarshal(msg.Payload, &candidate); err == nil {
				_ = d.peerConn.AddIceCandidate(candidate)
			}
		}

	case "INPUT_EVENT":
		if msg.Payload != nil {
			_ = d.injector.InjectEvent(msg.Payload)
		}
	}
}

func (d *NativeHostDaemon) initPeerConnectionAndOffer(ctx context.Context) {
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{"stun:stun.l.google.com:19302"}},
		},
	}

	pc, err := webrtc.NewPeerConnection(config)
	if err != nil {
		log.Printf("[WebRTC] Failed to create PeerConnection: %v", err)
		return
	}

	d.mu.Lock()
	d.peerConn = pc
	d.mu.Unlock()

	// Add Native VP8 Video Track
	videoTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8},
		"video",
		"hyperdesk-desktop-video",
	)
	if err == nil {
		_, _ = pc.AddTrack(videoTrack)
		d.mu.Lock()
		d.videoTrack = videoTrack
		d.mu.Unlock()
	}

	// Add Native Opus Audio Track
	audioTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus},
		"audio",
		"hyperdesk-system-audio",
	)
	if err == nil {
		_, _ = pc.AddTrack(audioTrack)
		d.mu.Lock()
		d.audioTrack = audioTrack
		d.mu.Unlock()
	}

	// Host creates Data Channels
	inputDc, err := pc.CreateDataChannel("input-events", nil)
	if err == nil {
		d.mu.Lock()
		d.inputChannel = inputDc
		d.mu.Unlock()

		inputDc.OnMessage(func(msg webrtc.DataChannelMessage) {
			_ = d.injector.InjectEvent(msg.Data)
		})
	}

	_, _ = pc.CreateDataChannel("clipboard-sync", nil)
	_, _ = pc.CreateDataChannel("metrics-channel", nil)

	// ICE Candidate handler
	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c != nil {
			candJSON, _ := json.Marshal(c.ToJSON())
			d.mu.Lock()
			if d.wsConn != nil {
				_ = d.wsConn.WriteJSON(SignalingMessage{
					Type:    "ICE_CANDIDATE",
					HostID:  d.HostID,
					Payload: candJSON,
				})
			}
			d.mu.Unlock()
		}
	})

	// Start video and audio frame loops
	go d.streamVideoFrames(ctx)
	go d.streamAudioFrames(ctx)

	// Create Offer
	offer, err := pc.CreateOffer(nil)
	if err != nil {
		log.Printf("[WebRTC] Failed to create SDP offer: %v", err)
		return
	}
	_ = pc.SetLocalDescription(offer)

	offerJSON, _ := json.Marshal(offer)

	d.mu.Lock()
	if d.wsConn != nil {
		_ = d.wsConn.WriteJSON(SignalingMessage{
			Type:    "SDP_OFFER",
			HostID:  d.HostID,
			Payload: offerJSON,
		})
	}
	d.mu.Unlock()

	log.Printf("[WebRTC] Sent native SDP offer to viewer.")
}

func (d *NativeHostDaemon) streamVideoFrames(ctx context.Context) {
	frameDuration := time.Second / time.Duration(d.FPS)
	ticker := time.NewTicker(frameDuration)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.mu.Lock()
			vt := d.videoTrack
			d.mu.Unlock()

			if vt == nil {
				continue
			}
			frame, err := d.capturer.CaptureFrame()
			if err != nil || frame == nil {
				continue
			}
			encoded, err := d.vp8Encoder.Encode(frame)
			if err != nil || len(encoded) == 0 {
				continue
			}

			_ = vt.WriteSample(media.Sample{
				Data:     encoded,
				Duration: frameDuration,
			})
		}
	}
}

func (d *NativeHostDaemon) streamAudioFrames(ctx context.Context) {
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.mu.Lock()
			at := d.audioTrack
			d.mu.Unlock()

			if at == nil {
				continue
			}
			opusFrame, err := d.audioGrabber.ReadOpusFrame()
			if err != nil || len(opusFrame) == 0 {
				continue
			}

			_ = at.WriteSample(media.Sample{
				Data:     opusFrame,
				Duration: 20 * time.Millisecond,
			})
		}
	}
}

func (d *NativeHostDaemon) Close() {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.capturer != nil {
		_ = d.capturer.Close()
	}
	if d.vp8Encoder != nil {
		_ = d.vp8Encoder.Close()
	}
	if d.audioGrabber != nil {
		d.audioGrabber.StopCapture()
	}
	if d.peerConn != nil {
		_ = d.peerConn.Close()
	}
}

func main() {
	hostID := flag.String("host-id", "492819301", "9-digit HyperDesk Session ID")
	passcode := flag.String("passcode", "SEC123", "Security Passcode")
	signalingURL := flag.String("signaling", "ws://localhost:8080", "WebSocket Signaling Server URL")
	fps := flag.Int("fps", 60, "Target frame rate")
	flag.Parse()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	daemon := NewNativeHostDaemon(*hostID, *passcode, *signalingURL, *fps)
	defer daemon.Close()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("[HostAgent] Graceful shutdown signal received.")
		cancel()
	}()

	if err := daemon.Start(ctx); err != nil {
		log.Printf("[HostAgent] Daemon error: %v", err)
	}
}


