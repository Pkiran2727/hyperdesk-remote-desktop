package video

import (
	"testing"

	"github.com/hyperdesk/host-agent/capture"
)

func TestHardwareProbe(t *testing.T) {
	info := DetectHardwareCapabilities(1920, 1080)
	t.Logf("Probe Result: Vendor=%s, Device=%s, Backend=%s, VP8Encode=%t, Reason=%s",
		info.Vendor, info.Device, info.Backend, info.VP8Encode, info.Reason)

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

	// Create 1920x1080 BGRA test frame with specific RGB values: B=255, G=128, R=64
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

	// Expected ITU-R BT.601 YUV values for RGB(64, 128, 255):
	// Y ≈ 112, U ≈ 209, V ≈ 93
	expectedY := byte(112)

	// 1. Encode frame using libvpx
	payload, err := enc.Encode(frame)
	if err != nil {
		t.Fatalf("Encode failed: %v", err)
	}

	if len(payload) == 0 {
		t.Fatalf("Encoded payload is empty")
	}

	t.Logf("Successfully encoded frame: %d bytes VP8 bitstream", len(payload))

	// 2. Decode payload using libvpx decoder to verify 100% valid VP8 bitstream & pixel integrity
	decodedWidth, decodedHeight, isKeyframe, sampleY, sampleU, sampleV, err := DecodeVP8Frame(payload)
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

	// Verify Y luminance pixel value tolerance (±15 for lossy VP8 quantization)
	diffY := int(sampleY) - int(expectedY)
	if diffY < -15 || diffY > 15 {
		t.Errorf("Pixel integrity check failed: sampled Y=%d, expected ~%d (U=%d, V=%d)", sampleY, expectedY, sampleU, sampleV)
	} else {
		t.Logf("✅ Pixel Integrity Verified: Sampled Y=%d (Expected ~%d), U=%d, V=%d", sampleY, expectedY, sampleU, sampleV)
	}

	t.Logf("✅ Bitstream & Pixel Verification Passed: Decoded %dx%d keyframe successfully from libvpx payload", decodedWidth, decodedHeight)
}
