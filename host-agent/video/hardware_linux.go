//go:build linux

package video

/*
#cgo LDFLAGS: -lva -lva-drm
#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <va/va.h>
#include <va/va_drm.h>

static int check_vaapi_vp8_encode(const char* device_path, int width, int height, char* reason_buf, int reason_buf_size) {
    int fd = open(device_path, O_RDWR);
    if (fd < 0) {
        snprintf(reason_buf, reason_buf_size, "Cannot open device %s", device_path);
        return 0;
    }

    VADisplay va_dpy = vaGetDisplayDRM(fd);
    if (!va_dpy) {
        snprintf(reason_buf, reason_buf_size, "vaGetDisplayDRM failed for %s", device_path);
        close(fd);
        return 0;
    }

    int major_ver, minor_ver;
    VAStatus status = vaInitialize(va_dpy, &major_ver, &minor_ver);
    if (status != VA_STATUS_SUCCESS) {
        snprintf(reason_buf, reason_buf_size, "vaInitialize failed: %s", vaErrorStr(status));
        close(fd);
        return 0;
    }

    int max_profiles = vaMaxNumProfiles(va_dpy);
    VAProfile *profiles = (VAProfile*)malloc(sizeof(VAProfile) * max_profiles);
    if (!profiles) {
        snprintf(reason_buf, reason_buf_size, "malloc failed for profiles");
        vaTerminate(va_dpy);
        close(fd);
        return 0;
    }

    int num_profiles = 0;
    status = vaQueryConfigProfiles(va_dpy, profiles, &num_profiles);
    if (status != VA_STATUS_SUCCESS) {
        snprintf(reason_buf, reason_buf_size, "vaQueryConfigProfiles failed: %s", vaErrorStr(status));
        free(profiles);
        vaTerminate(va_dpy);
        close(fd);
        return 0;
    }

    int has_vp8_profile = 0;
    for (int i = 0; i < num_profiles; i++) {
        if (profiles[i] == VAProfileVP8Version0_3) {
            has_vp8_profile = 1;
            break;
        }
    }
    free(profiles);

    if (!has_vp8_profile) {
        snprintf(reason_buf, reason_buf_size, "VAProfileVP8Version0_3 unsupported on %s", device_path);
        vaTerminate(va_dpy);
        close(fd);
        return 0;
    }

    int max_entrypoints = vaMaxNumEntrypoints(va_dpy);
    VAEntrypoint *entrypoints = (VAEntrypoint*)malloc(sizeof(VAEntrypoint) * max_entrypoints);
    if (!entrypoints) {
        snprintf(reason_buf, reason_buf_size, "malloc failed for entrypoints");
        vaTerminate(va_dpy);
        close(fd);
        return 0;
    }

    int num_entrypoints = 0;
    status = vaQueryConfigEntrypoints(va_dpy, VAProfileVP8Version0_3, entrypoints, &num_entrypoints);
    if (status != VA_STATUS_SUCCESS) {
        snprintf(reason_buf, reason_buf_size, "vaQueryConfigEntrypoints failed: %s", vaErrorStr(status));
        free(entrypoints);
        vaTerminate(va_dpy);
        close(fd);
        return 0;
    }

    int has_enc_slice = 0;
    for (int i = 0; i < num_entrypoints; i++) {
        if (entrypoints[i] == VAEntrypointEncSlice || entrypoints[i] == VAEntrypointEncPicture) {
            has_enc_slice = 1;
            break;
        }
    }
    free(entrypoints);

    if (!has_enc_slice) {
        snprintf(reason_buf, reason_buf_size, "VAEntrypointEncSlice unavailable for VP8 on %s", device_path);
        vaTerminate(va_dpy);
        close(fd);
        return 0;
    }

    VAConfigID config_id;
    status = vaCreateConfig(va_dpy, VAProfileVP8Version0_3, VAEntrypointEncSlice, NULL, 0, &config_id);
    if (status != VA_STATUS_SUCCESS) {
        snprintf(reason_buf, reason_buf_size, "vaCreateConfig failed: %s", vaErrorStr(status));
        vaTerminate(va_dpy);
        close(fd);
        return 0;
    }

    VAContextID context_id;
    status = vaCreateContext(va_dpy, config_id, width, height, VA_PROGRESSIVE, NULL, 0, &context_id);
    if (status != VA_STATUS_SUCCESS) {
        snprintf(reason_buf, reason_buf_size, "vaCreateContext (%dx%d) failed: %s", width, height, vaErrorStr(status));
        vaDestroyConfig(va_dpy, config_id);
        vaTerminate(va_dpy);
        close(fd);
        return 0;
    }

    vaDestroyContext(va_dpy, context_id);
    vaDestroyConfig(va_dpy, config_id);
    vaTerminate(va_dpy);
    close(fd);

    snprintf(reason_buf, reason_buf_size, "VAAPI VP8 HW Encode verified");
    return 1;
}
*/
import "C"
import (
	"os"
	"strings"
	"unsafe"
)

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

func querySysfsGPU() (string, string) {
	vendorPath := "/sys/class/drm/renderD128/device/vendor"
	devicePath := "/sys/class/drm/renderD128/device/device"

	vBytes, errV := os.ReadFile(vendorPath)
	dBytes, errD := os.ReadFile(devicePath)

	if errV != nil || errD != nil {
		return "Intel/Generic", "/dev/dri/renderD128"
	}

	vendorID := strings.TrimSpace(string(vBytes))
	deviceID := strings.TrimSpace(string(dBytes))

	vendorName := "Generic GPU"
	deviceName := "DRM Device (" + deviceID + ")"

	if vendorID == "0x8086" {
		vendorName = "Intel Corporation"
		if deviceID == "0x4692" {
			deviceName = "Intel UHD Graphics 730 (Alder Lake-S GT1)"
		} else {
			deviceName = "Intel HD/UHD Graphics (" + deviceID + ")"
		}
	} else if vendorID == "0x10de" {
		vendorName = "NVIDIA Corporation"
	} else if vendorID == "0x1002" {
		vendorName = "Advanced Micro Devices, Inc. (AMD)"
	}

	return vendorName, deviceName
}

func DetectHardwareCapabilities(width, height int) HardwareAccelerationInfo {
	vendorName, deviceName := querySysfsGPU()

	info := HardwareAccelerationInfo{
		Backend: "SOFTWARE (libvpx)",
		Vendor:  vendorName,
		Device:  deviceName,
	}

	devicePath := "/dev/dri/renderD128"
	if _, err := os.Stat(devicePath); os.IsNotExist(err) {
		devicePath = "/dev/dri/card0"
		if _, err := os.Stat(devicePath); os.IsNotExist(err) {
			info.Reason = "No DRM render node (/dev/dri/renderD128 or /dev/dri/card0) available"
			return info
		}
	}
	info.Available = true

	var reasonBuf [256]C.char
	cDevicePath := C.CString(devicePath)
	defer C.free(unsafe.Pointer(cDevicePath))

	res := C.check_vaapi_vp8_encode(cDevicePath, C.int(width), C.int(height), &reasonBuf[0], 256)
	info.Reason = C.GoString(&reasonBuf[0])

	if res == 1 {
		info.VP8Encode = true
		info.Backend = "VAAPI"
	} else {
		info.VP8Encode = false
		info.Backend = "SOFTWARE (libvpx)"
	}

	return info
}
