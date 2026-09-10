package video

import (
	"testing"

	"github.com/hyperdesk/host-agent/capture"
)

func TestHardwareProbe(t *testing.T) {
	info := DetectHardwareCapabilities(1920, 1080)
	t.Logf("Probe Result: Backend=%s, Device=%s, VP8Encode=%t, Reason=%s",
		info.Backend, info.Device, info.VP8Encode, info.Reason)

	if info.Backend != "SOFTWARE (libvpx)" && info.Backend != "VAAPI" {
		t.Fatalf("Unexpected backend: %s", info.Backend)
	}

	// On Intel UHD 730, VP8 HW encode is unavailable, so backend must be SOFTWARE (libvpx)
	if !info.VP8Encode && info.Backend != "SOFTWARE (libvpx)" {
		t.Fatalf("Expected SOFTWARE (libvpx) backend when VP8 HW encode is false, got: %s", info.Backend)
	}
}

func TestLibvpxEncoderAndDecoderVerification(t *testing.T) {
	width := 1920
	height := 1080
	fps := 30

	enc, err := NewSoftwareVP8Encoder(width, height, fps)
	if err != nil {
		t.Fatalf("Failed to create SoftwareVP8Encoder: %v", err)
	}
	defer enc.Close()

	// Create 1920x1080 BGRA test frame with blue color pattern
	bgraData := make([]byte, width*height*4)
	for i := 0; i < len(bgraData); i += 4 {
		bgraData[i] = 255   // Blue
		bgraData[i+1] = 128 // Green
		bgraData[i+2] = 64  // Red
		bgraData[i+3] = 255 // Alpha
	}

	frame := &capture.ScreenFrame{
		Width:  width,
		Height: height,
		Data:   bgraData,
	}

	// 1. Encode frame using libvpx
	payload, err := enc.Encode(frame)
	if err != nil {
		t.Fatalf("Encode failed: %v", err)
	}

	if len(payload) == 0 {
		t.Fatalf("Encoded payload is empty")
	}

	t.Logf("Successfully encoded frame: %d bytes VP8 bitstream", len(payload))

	// 2. Decode payload using libvpx decoder to verify 100% valid VP8 bitstream
	decodedWidth, decodedHeight, isKeyframe, err := DecodeVP8Frame(payload)
	if err != nil {
		t.Fatalf("VP8 Bitstream Decode failed (Corrupt or Invalid VP8): %v", err)
	}

	if decodedWidth != width {
		t.Errorf("Decoded width mismatch: got %d, expected %d", decodedWidth, width)
	}

	if decodedHeight != height {
		t.Errorf("Decoded height mismatch: got %d, expected %d", decodedHeight, height)
	}

	if !isKeyframe {
		t.Errorf("Expected first encoded frame to be a Keyframe, but got Interframe")
	}

	t.Logf("✅ Bitstream Verification Passed: Decoded %dx%d keyframe successfully from libvpx payload", decodedWidth, decodedHeight)
}
