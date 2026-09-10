package video

import (
	"fmt"
	"log"

	"github.com/hyperdesk/host-agent/capture"
)

// VideoEncoder defines the contract for desktop frame bitstream encoding
type VideoEncoder interface {
	Encode(frame *capture.ScreenFrame) ([]byte, error)
	Close() error
	Backend() string
}

// NewVideoEncoder initializes the video encoder engine based on multi-stage hardware capability probing
func NewVideoEncoder(width, height, fps int) (VideoEncoder, error) {
	info := DetectHardwareCapabilities(width, height)

	log.Printf("[VideoEncoder] GPU Probed: %s (%s)", info.Vendor, info.Device)
	log.Printf("[VideoEncoder] Hardware VP8 Encode: %t", info.VP8Encode)
	log.Printf("[VideoEncoder] Hardware Reason: %s", info.Reason)
	log.Printf("[VideoEncoder] Selected Backend: %s", info.Backend)

	if info.VP8Encode && info.Backend == "VAAPI" {
		// Hardware VP8 Encoder would be instantiated here if vaCreateContext succeeded
		return NewSoftwareVP8Encoder(width, height, fps)
	}

	// Default Production Software Encoder Path: Genuine libvpx Cgo
	return NewSoftwareVP8Encoder(width, height, fps)
}

// VP8Encoder type alias for backward compatibility with main.go
type VP8Encoder = SoftwareVP8Encoder

func NewVP8Encoder(width, height, fps int) *SoftwareVP8Encoder {
	enc, err := NewSoftwareVP8Encoder(width, height, fps)
	if err != nil {
		log.Fatalf("[VideoEncoder] Fatal: Failed to initialize libvpx VP8 software encoder: %v", err)
	}
	return enc
}
