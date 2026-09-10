//go:build windows

package video

type HardwareAccelerationInfo struct {
	Available  bool
	Backend    string
	Vendor     string
	Device     string
	VP8Encode  bool
	H264Encode bool
	VP9Encode  bool
	Reason     string
}

func DetectHardwareCapabilities(width, height int) HardwareAccelerationInfo {
	return HardwareAccelerationInfo{
		Available: false,
		Backend:   "SOFTWARE (libvpx)",
		Vendor:    "Windows D3D11",
		Device:    "DXVA2 / Direct3D 11",
		VP8Encode: false,
		Reason:    "Windows Media Foundation VP8 HW encode entrypoint unavailable; using libvpx software VP8",
	}
}
