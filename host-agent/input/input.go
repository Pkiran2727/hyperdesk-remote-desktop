package input

import (
	"encoding/json"
	"fmt"
	"runtime"
)

type InputEventPayload struct {
	Category  string  `json:"category"`  // "MOUSE", "KEYBOARD", "SHORTCUT"
	Type      string  `json:"type"`      // "mousemove", "click", "keydown", "keyup"
	Button    int     `json:"button"`    // 0: left, 1: middle, 2: right
	XPct      float64 `json:"xPct"`      // 0.0 to 100.0
	YPct      float64 `json:"yPct"`      // 0.0 to 100.0
	DeltaY    float64 `json:"deltaY"`    // Wheel delta
	Key       string  `json:"key"`       // Key character
	Code      string  `json:"code"`      // Key code
	Name      string  `json:"name"`      // Macro shortcut name
	Timestamp int64   `json:"timestamp"`
}

type NativeInputInjector struct {
	OS string
}

func NewNativeInputInjector() *NativeInputInjector {
	return &NativeInputInjector{
		OS: runtime.GOOS,
	}
}

func (injector *NativeInputInjector) InjectEvent(data []byte) error {
	var payload InputEventPayload
	err := json.Unmarshal(data, &payload)
	if err != nil {
		return fmt.Errorf("failed to parse input payload: %w", err)
	}

	if injector.OS == "windows" {
		return injector.injectWin32(payload)
	}
	return injector.injectLinux(payload)
}

func (injector *NativeInputInjector) injectWin32(p InputEventPayload) error {
	switch p.Category {
	case "MOUSE":
		if p.Type == "mousemove" {
			// Win32 API: SetCursorPos(x, y)
			// Normalized percentage conversion to virtual screen bounds
			_ = p.XPct
			_ = p.YPct
		} else if p.Type == "mousedown" || p.Type == "mouseup" {
			// Win32 API: SendInput() MOUSEEVENTF_LEFTDOWN / MOUSEEVENTF_LEFTUP
			_ = p.Button
		}
	case "KEYBOARD":
		// Win32 API: SendInput() KEYEVENTF_KEYDOWN / KEYEVENTF_KEYUP
		_ = p.Key
		_ = p.Code
	case "SHORTCUT":
		if p.Name == "CTRL_ALT_DEL" {
			// Send Win32 CAD Macro
		}
	}
	return nil
}

func (injector *NativeInputInjector) injectLinux(p InputEventPayload) error {
	switch p.Category {
	case "MOUSE":
		// Linux /dev/uinput or XTestFakeMotionEvent
		_ = p.XPct
		_ = p.YPct
	case "KEYBOARD":
		// Linux /dev/uinput or XTestFakeKeyEvent
		_ = p.Key
	}
	return nil
}
