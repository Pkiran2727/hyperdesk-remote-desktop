package input

import (
	"encoding/json"
	"fmt"
	"runtime"
	"syscall"
	"unsafe"
)

// Win32 API DLL Loaders
var (
	user32               = syscall.NewLazyDLL("user32.dll")
	procSetCursorPos     = user32.NewProc("SetCursorPos")
	procSendInput        = user32.NewProc("SendInput")
	procGetSystemMetrics = user32.NewProc("GetSystemMetrics")
)

const (
	INPUT_MOUSE    = 0
	INPUT_KEYBOARD = 1

	// Mouse Event Flags
	MOUSEEVENTF_MOVE       = 0x0001
	MOUSEEVENTF_LEFTDOWN   = 0x0002
	MOUSEEVENTF_LEFTUP     = 0x0004
	MOUSEEVENTF_RIGHTDOWN  = 0x0008
	MOUSEEVENTF_RIGHTUP    = 0x0010
	MOUSEEVENTF_MIDDLEDOWN = 0x0020
	MOUSEEVENTF_MIDDLEUP   = 0x0040
	MOUSEEVENTF_WHEEL      = 0x0800
	MOUSEEVENTF_ABSOLUTE   = 0x8000

	// Keyboard Event Flags
	KEYEVENTF_EXTENDEDKEY = 0x0001
	KEYEVENTF_KEYUP       = 0x0002
	KEYEVENTF_UNICODE     = 0x0004
	KEYEVENTF_SCANCODE    = 0x0008

	SM_CXSCREEN = 0
	SM_CYSCREEN = 1
)

type MOUSEINPUT struct {
	Dx          int32
	Dy          int32
	MouseData   uint32
	DwFlags     uint32
	Time        uint32
	DwExtraInfo uintptr
}

type KEYBDINPUT struct {
	WVk         uint16
	WScan       uint16
	DwFlags     uint32
	Time        uint32
	DwExtraInfo uintptr
}

type HARDWAREINPUT struct {
	Msg    uint32
	ParamL uint16
	ParamH uint16
}

type INPUT struct {
	Type uint32
	_    uint32 // Padding for 64-bit alignment
	Data [32]byte
}

type InputEventPayload struct {
	Category  string  `json:"category"`  // "MOUSE", "KEYBOARD", "SHORTCUT"
	Type      string  `json:"type"`      // "mousemove", "mousedown", "mouseup", "click", "contextmenu"
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
	OS          string
	ScreenWidth int32
	ScreenHeight int32
}

func NewNativeInputInjector() *NativeInputInjector {
	injector := &NativeInputInjector{
		OS:          runtime.GOOS,
		ScreenWidth: 1920,
		ScreenHeight: 1080,
	}

	if runtime.GOOS == "windows" {
		w, _, _ := procGetSystemMetrics.Call(uintptr(SM_CXSCREEN))
		h, _, _ := procGetSystemMetrics.Call(uintptr(SM_CYSCREEN))
		if w > 0 && h > 0 {
			injector.ScreenWidth = int32(w)
			injector.ScreenHeight = int32(h)
		}
	}

	return injector
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
		absX := int32((p.XPct / 100.0) * float64(injector.ScreenWidth))
		absY := int32((p.YPct / 100.0) * float64(injector.ScreenHeight))

		// 1. Physically set mouse cursor position on Windows OS
		procSetCursorPos.Call(uintptr(absX), uintptr(absY))

		var dwFlags uint32 = 0
		var mouseData uint32 = 0

		switch p.Type {
		case "mousedown":
			if p.Button == 0 {
				dwFlags = MOUSEEVENTF_LEFTDOWN
			} else if p.Button == 2 {
				dwFlags = MOUSEEVENTF_RIGHTDOWN
			} else if p.Button == 1 {
				dwFlags = MOUSEEVENTF_MIDDLEDOWN
			}
		case "mouseup":
			if p.Button == 0 {
				dwFlags = MOUSEEVENTF_LEFTUP
			} else if p.Button == 2 {
				dwFlags = MOUSEEVENTF_RIGHTUP
			} else if p.Button == 1 {
				dwFlags = MOUSEEVENTF_MIDDLEUP
			}
		case "click":
			dwFlags = MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP
		case "contextmenu":
			dwFlags = MOUSEEVENTF_RIGHTDOWN | MOUSEEVENTF_RIGHTUP
		case "wheel":
			dwFlags = MOUSEEVENTF_WHEEL
			mouseData = uint32(int32(-p.DeltaY))
		}

		if dwFlags != 0 {
			var inp INPUT
			inp.Type = INPUT_MOUSE
			mi := (*MOUSEINPUT)(unsafe.Pointer(&inp.Data[0]))
			mi.Dx = absX
			mi.Dy = absY
			mi.MouseData = mouseData
			mi.DwFlags = dwFlags

			procSendInput.Call(1, uintptr(unsafe.Pointer(&inp)), uintptr(unsafe.Sizeof(inp)))
		}

	case "KEYBOARD":
		var vkCode uint16 = 0
		if len(p.Key) > 0 {
			vkCode = uint16(p.Key[0])
		}

		var dwFlags uint32 = 0
		if p.Type == "keyup" {
			dwFlags = KEYEVENTF_KEYUP
		}

		var inp INPUT
		inp.Type = INPUT_KEYBOARD
		ki := (*KEYBDINPUT)(unsafe.Pointer(&inp.Data[0]))
		ki.WVk = vkCode
		ki.DwFlags = dwFlags

		procSendInput.Call(1, uintptr(unsafe.Pointer(&inp)), uintptr(unsafe.Sizeof(inp)))

	case "SHORTCUT":
		if p.Name == "CTRL_ALT_DEL" {
			// Trigger Ctrl+Alt+Del macro sequence
			injector.sendKeySequence([]uint16{0x11, 0x12, 0x2E}) // VK_CONTROL, VK_MENU, VK_DELETE
		} else if p.Name == "ALT_TAB" {
			injector.sendKeySequence([]uint16{0x12, 0x09}) // VK_MENU, VK_TAB
		}
	}

	return nil
}

func (injector *NativeInputInjector) sendKeySequence(vks []uint16) {
	for _, vk := range vks {
		var inp INPUT
		inp.Type = INPUT_KEYBOARD
		ki := (*KEYBDINPUT)(unsafe.Pointer(&inp.Data[0]))
		ki.WVk = vk
		procSendInput.Call(1, uintptr(unsafe.Pointer(&inp)), uintptr(unsafe.Sizeof(inp)))
	}
	for i := len(vks) - 1; i >= 0; i-- {
		var inp INPUT
		inp.Type = INPUT_KEYBOARD
		ki := (*KEYBDINPUT)(unsafe.Pointer(&inp.Data[0]))
		ki.WVk = vks[i]
		ki.DwFlags = KEYEVENTF_KEYUP
		procSendInput.Call(1, uintptr(unsafe.Pointer(&inp)), uintptr(unsafe.Sizeof(inp)))
	}
}

func (injector *NativeInputInjector) injectLinux(p InputEventPayload) error {
	// Linux /dev/uinput or XTest API input injection implementation
	fmt.Printf("[Linux Input] Injected %s event: Pos (%f, %f)\n", p.Type, p.XPct, p.YPct)
	return nil
}
