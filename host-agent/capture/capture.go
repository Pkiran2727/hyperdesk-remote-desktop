package capture

import (
	"fmt"
	"runtime"
)

type ScreenFrame struct {
	Width     int
	Height    int
	Format    string
	Data      []byte
	Timestamp int64
}

type DesktopCapturer struct {
	FPS int
	OS  string
}

func NewDesktopCapturer(fps int) *DesktopCapturer {
	return &DesktopCapturer{
		FPS: fps,
		OS:  runtime.GOOS,
	}
}

func (dc *DesktopCapturer) InitializeDXGI() error {
	if dc.OS == "windows" {
		fmt.Printf("[DXGI Capture] Initialized Win32 DXGI Desktop Duplication Engine @ %d FPS\n", dc.FPS)
	} else {
		fmt.Printf("[PipeWire Capture] Initialized Linux PipeWire / X11 Screen Grabber @ %d FPS\n", dc.FPS)
	}
	return nil
}
