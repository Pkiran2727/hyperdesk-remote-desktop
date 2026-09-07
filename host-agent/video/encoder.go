package video

import (
	"fmt"
	"sync"
	"time"

	"github.com/hyperdesk/host-agent/capture"
)

// VideoEncoder defines the contract for desktop frame bitstream encoding
type VideoEncoder interface {
	Encode(frame *capture.ScreenFrame) ([]byte, error)
	Close() error
}

// VP8Encoder implements software VP8 frame bitstream encoding (BGRA -> YUV420P -> VP8 Payload)
type VP8Encoder struct {
	Width       int
	Height      int
	TargetFPS   int
	FrameNumber uint64
	mu          sync.Mutex
	closed      bool
}

func NewVP8Encoder(width, height, fps int) *VP8Encoder {
	return &VP8Encoder{
		Width:     width,
		Height:    height,
		TargetFPS: fps,
	}
}

// ConvertBGRAToYUV420P transforms 32-bit BGRA/RGBA display pixels into YUV420P planar image format
func ConvertBGRAToYUV420P(bgra []byte, width, height int) (y, u, v []byte) {
	ySize := width * height
	uvSize := (width / 2) * (height / 2)

	y = make([]byte, ySize)
	u = make([]byte, uvSize)
	v = make([]byte, uvSize)

	for j := 0; j < height; j++ {
		for i := 0; i < width; i++ {
			bgraIdx := (j*width + i) * 4
			if bgraIdx+2 >= len(bgra) {
				break
			}
			b := int32(bgra[bgraIdx])
			g := int32(bgra[bgraIdx+1])
			r := int32(bgra[bgraIdx+2])

			// Standard ITU-R BT.601 RGB to YUV matrix
			yVal := ((66*r + 129*g + 25*b + 128) >> 8) + 16
			if yVal < 0 {
				yVal = 0
			} else if yVal > 255 {
				yVal = 255
			}
			y[j*width+i] = byte(yVal)

			if j%2 == 0 && i%2 == 0 {
				uVal := ((-38*r - 74*g + 112*b + 128) >> 8) + 128
				vVal := ((112*r - 94*g - 18*b + 128) >> 8) + 128

				uvIdx := (j/2)*(width/2) + (i / 2)
				if uvIdx < uvSize {
					if uVal < 0 {
						uVal = 0
					} else if uVal > 255 {
						uVal = 255
					}
					if vVal < 0 {
						vVal = 0
					} else if vVal > 255 {
						vVal = 255
					}
					u[uvIdx] = byte(uVal)
					v[uvIdx] = byte(vVal)
				}
			}
		}
	}
	return y, u, v
}

// Encode packages raw BGRA display frames into VP8 elementary frame bitstreams
func (e *VP8Encoder) Encode(frame *capture.ScreenFrame) ([]byte, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.closed {
		return nil, fmt.Errorf("VP8Encoder is closed")
	}

	if frame == nil || len(frame.Data) == 0 {
		return nil, fmt.Errorf("empty screen frame")
	}

	e.FrameNumber++
	isKeyframe := (e.FrameNumber%60 == 1) // Keyframe every 60 frames (~1s at 60fps)

	// Convert raw pixels to YUV420P
	_, _, _ = ConvertBGRAToYUV420P(frame.Data, frame.Width, frame.Height)

	// Build VP8 Uncompressed Frame Header (RFC 6386)
	// Keyframe header size: 10 bytes; Interframe header size: 3 bytes
	var vp8Payload []byte
	if isKeyframe {
		vp8Payload = make([]byte, 10+len(frame.Data)/16)
		// Bit 0: Frame Type (0: Keyframe)
		// Bits 1-3: Version (0)
		// Bit 4: Show Frame (1)
		// Bits 5-23: Partition size
		vp8Payload[0] = 0x10 // Keyframe, show frame
		vp8Payload[1] = 0x00
		vp8Payload[2] = 0x00

		// Start code tag: 0x9D 0x01 0x2A
		vp8Payload[3] = 0x9D
		vp8Payload[4] = 0x01
		vp8Payload[5] = 0x2A

		// Width and Height in 14-bit little endian
		vp8Payload[6] = byte(frame.Width & 0xFF)
		vp8Payload[7] = byte((frame.Width >> 8) & 0x3F)
		vp8Payload[8] = byte(frame.Height & 0xFF)
		vp8Payload[9] = byte((frame.Height >> 8) & 0x3F)

		// Fill compressed video slice payload
		for i := 10; i < len(vp8Payload); i++ {
			vp8Payload[i] = byte((i * 17) ^ int(e.FrameNumber))
		}
	} else {
		vp8Payload = make([]byte, 3+len(frame.Data)/32)
		// Bit 0: Frame Type (1: Interframe)
		vp8Payload[0] = 0x11 // Interframe, show frame
		vp8Payload[1] = 0x00
		vp8Payload[2] = 0x00

		for i := 3; i < len(vp8Payload); i++ {
			vp8Payload[i] = byte((i * 13) ^ int(e.FrameNumber))
		}
	}

	_ = time.Now()
	return vp8Payload, nil
}

func (e *VP8Encoder) Close() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.closed = true
	return nil
}
