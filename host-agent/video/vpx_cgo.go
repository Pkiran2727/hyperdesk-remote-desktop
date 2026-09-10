package video

/*
#cgo LDFLAGS: -lvpx
#include <stdlib.h>
#include <vpx/vpx_encoder.h>
#include <vpx/vp8cx.h>
#include <vpx/vpx_decoder.h>
#include <vpx/vp8dx.h>
*/
import "C"
import (
	"fmt"
	"sync"
	"unsafe"

	"github.com/hyperdesk/host-agent/capture"
)

// SoftwareVP8Encoder implements genuine libvpx VP8 software encoding
type SoftwareVP8Encoder struct {
	Width       int
	Height      int
	TargetFPS   int
	FrameNumber uint64

	codec C.vpx_codec_ctx_t
	raw   C.vpx_image_t
	mu    sync.Mutex
	closed bool
}

func NewSoftwareVP8Encoder(width, height, fps int) (*SoftwareVP8Encoder, error) {
	enc := &SoftwareVP8Encoder{
		Width:     width,
		Height:    height,
		TargetFPS: fps,
	}

	var cfg C.vpx_codec_enc_cfg_t
	if res := C.vpx_codec_enc_config_default(C.vpx_codec_vp8_cx(), &cfg, 0); res != C.VPX_CODEC_OK {
		return nil, fmt.Errorf("failed to get default libvpx encoder config: %d", res)
	}

	cfg.g_w = C.uint(width)
	cfg.g_h = C.uint(height)
	cfg.g_timebase.num = 1
	cfg.g_timebase.den = C.int(fps)
	cfg.rc_target_bitrate = C.uint(2500) // 2.5 Mbps
	cfg.g_pass = C.VPX_RC_ONE_PASS

	if res := C.vpx_codec_enc_init_ver(&enc.codec, C.vpx_codec_vp8_cx(), &cfg, 0, C.VPX_ENCODER_ABI_VERSION); res != C.VPX_CODEC_OK {
		return nil, fmt.Errorf("failed to initialize libvpx encoder: %d", res)
	}

	if img := C.vpx_img_alloc(&enc.raw, C.VPX_IMG_FMT_I420, C.uint(width), C.uint(height), 1); img == nil {
		C.vpx_codec_destroy(&enc.codec)
		return nil, fmt.Errorf("failed to allocate libvpx image buffer")
	}

	return enc, nil
}

func (e *SoftwareVP8Encoder) Encode(frame *capture.ScreenFrame) ([]byte, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.closed {
		return nil, fmt.Errorf("SoftwareVP8Encoder is closed")
	}

	if frame == nil || len(frame.Data) == 0 {
		return nil, fmt.Errorf("empty screen frame")
	}

	if frame.Width != e.Width || frame.Height != e.Height {
		return nil, fmt.Errorf("frame dimension mismatch: got %dx%d, expected %dx%d", frame.Width, frame.Height, e.Width, e.Height)
	}

	e.FrameNumber++
	isKeyframe := (e.FrameNumber%60 == 1)

	// Convert BGRA to I420 in e.raw
	convertBGRAToI420Plane(frame.Data, frame.Width, frame.Height, &e.raw)

	var flags C.vpx_enc_frame_flags_t
	if isKeyframe {
		flags |= C.VPX_EFLAG_FORCE_KF
	}

	res := C.vpx_codec_encode(&e.codec, &e.raw, C.vpx_codec_pts_t(e.FrameNumber), 1, flags, C.VPX_DL_REALTIME)
	if res != C.VPX_CODEC_OK {
		return nil, fmt.Errorf("libvpx encode failed: %d", res)
	}

	var iter C.vpx_codec_iter_t
	var pkt *C.vpx_codec_cx_pkt_t
	var encodedPayload []byte

	for {
		pkt = C.vpx_codec_get_cx_data(&e.codec, &iter)
		if pkt == nil {
			break
		}

		if pkt.kind == C.VPX_CODEC_CX_FRAME_PKT {
			bufPtr := unsafe.Pointer(pkt.data.frame.buf)
			bufSize := int(pkt.data.frame.sz)
			slice := unsafe.Slice((*byte)(bufPtr), bufSize)

			encodedPayload = append(encodedPayload, slice...)
		}
	}

	if len(encodedPayload) == 0 {
		return nil, fmt.Errorf("libvpx produced 0 encoded bytes")
	}

	return encodedPayload, nil
}

func (e *SoftwareVP8Encoder) Backend() string {
	return "SOFTWARE (libvpx)"
}

func (e *SoftwareVP8Encoder) Close() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.closed {
		return nil
	}
	e.closed = true

	C.vpx_img_free(&e.raw)
	C.vpx_codec_destroy(&e.codec)
	return nil
}

func convertBGRAToI420Plane(bgra []byte, width, height int, img *C.vpx_image_t) {
	yPlane := unsafe.Slice((*byte)(unsafe.Pointer(img.planes[C.VPX_PLANE_Y])), int(img.stride[C.VPX_PLANE_Y])*height)
	uPlane := unsafe.Slice((*byte)(unsafe.Pointer(img.planes[C.VPX_PLANE_U])), int(img.stride[C.VPX_PLANE_U])*(height/2))
	vPlane := unsafe.Slice((*byte)(unsafe.Pointer(img.planes[C.VPX_PLANE_V])), int(img.stride[C.VPX_PLANE_V])*(height/2))

	yStride := int(img.stride[C.VPX_PLANE_Y])
	uStride := int(img.stride[C.VPX_PLANE_U])
	vStride := int(img.stride[C.VPX_PLANE_V])

	for j := 0; j < height; j++ {
		for i := 0; i < width; i++ {
			bgraIdx := (j*width + i) * 4
			if bgraIdx+2 >= len(bgra) {
				break
			}
			b := int32(bgra[bgraIdx])
			g := int32(bgra[bgraIdx+1])
			r := int32(bgra[bgraIdx+2])

			yVal := ((66*r + 129*g + 25*b + 128) >> 8) + 16
			if yVal < 0 {
				yVal = 0
			} else if yVal > 255 {
				yVal = 255
			}
			yPlane[j*yStride+i] = byte(yVal)

			if j%2 == 0 && i%2 == 0 {
				uVal := ((-38*r - 74*g + 112*b + 128) >> 8) + 128
				vVal := ((112*r - 94*g - 18*b + 128) >> 8) + 128
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

				uPlane[(j/2)*uStride+(i/2)] = byte(uVal)
				vPlane[(j/2)*vStride+(i/2)] = byte(vVal)
			}
		}
	}
}

// DecodeVP8Frame decodes a VP8 elementary payload back into a raw vpx_image for test verification
func DecodeVP8Frame(payload []byte) (int, int, bool, byte, byte, byte, error) {
	if len(payload) == 0 {
		return 0, 0, false, 0, 0, 0, fmt.Errorf("empty payload")
	}

	var codec C.vpx_codec_ctx_t
	if res := C.vpx_codec_dec_init_ver(&codec, C.vpx_codec_vp8_dx(), nil, 0, C.VPX_DECODER_ABI_VERSION); res != C.VPX_CODEC_OK {
		return 0, 0, false, 0, 0, 0, fmt.Errorf("failed to init libvpx decoder: %d", res)
	}
	defer C.vpx_codec_destroy(&codec)

	payloadPtr := (*C.uint8_t)(unsafe.Pointer(&payload[0]))
	payloadLen := C.uint(len(payload))

	if res := C.vpx_codec_decode(&codec, payloadPtr, payloadLen, nil, 0); res != C.VPX_CODEC_OK {
		return 0, 0, false, 0, 0, 0, fmt.Errorf("libvpx decode failed: %d", res)
	}

	var iter C.vpx_codec_iter_t
	img := C.vpx_codec_get_frame(&codec, &iter)
	if img == nil {
		return 0, 0, false, 0, 0, 0, fmt.Errorf("libvpx decoder produced no image")
	}

	width := int(img.d_w)
	height := int(img.d_h)

	// Sample center pixel (Y, U, V)
	yPlane := unsafe.Slice((*byte)(unsafe.Pointer(img.planes[C.VPX_PLANE_Y])), int(img.stride[C.VPX_PLANE_Y])*height)
	uPlane := unsafe.Slice((*byte)(unsafe.Pointer(img.planes[C.VPX_PLANE_U])), int(img.stride[C.VPX_PLANE_U])*(height/2))
	vPlane := unsafe.Slice((*byte)(unsafe.Pointer(img.planes[C.VPX_PLANE_V])), int(img.stride[C.VPX_PLANE_V])*(height/2))

	centerIdxY := (height / 2) * int(img.stride[C.VPX_PLANE_Y]) + (width / 2)
	centerIdxU := (height / 4) * int(img.stride[C.VPX_PLANE_U]) + (width / 4)
	centerIdxV := (height / 4) * int(img.stride[C.VPX_PLANE_V]) + (width / 4)

	sampleY := yPlane[centerIdxY]
	sampleU := uPlane[centerIdxU]
	sampleV := vPlane[centerIdxV]

	// Check keyframe bit from payload header (RFC 6386 section 9.1: frame type bit 0 = 0 for keyframe)
	isKeyframe := (payload[0] & 0x01) == 0

	return width, height, isKeyframe, sampleY, sampleU, sampleV, nil
}
