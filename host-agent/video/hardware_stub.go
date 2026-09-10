//go:build !linux && !windows

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
		Vendor:    "Generic",
		Device:    "Software",
		VP8Encode: false,
		Reason:    "Non-Linux/Windows target OS; using libvpx software VP8",
	}
}
