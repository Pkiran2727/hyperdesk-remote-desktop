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
	procMapVirtualKeyA   = user32.NewProc("MapVirtualKeyA")

	// Dynamic SAS DLL loader for Windows Secure Attention Sequence
	sasDll      *syscall.LazyDLL
	procSendSAS *syscall.LazyProc
)

func init() {
	if runtime.GOOS == "windows" {
		sasDll = syscall.NewLazyDLL("sas.dll")
		procSendSAS = sasDll.NewProc("SendSAS")
	}
}

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

// Win32 Virtual Key Codes Mapping
var vkCodeMap = map[string]uint16{
	"KeyA": 0x41, "KeyB": 0x42, "KeyC": 0x43, "KeyD": 0x44, "KeyE": 0x45,
	"KeyF": 0x46, "KeyG": 0x47, "KeyH": 0x48, "KeyI": 0x49, "KeyJ": 0x4A,
	"KeyK": 0x4B, "KeyL": 0x4C, "KeyM": 0x4D, "KeyN": 0x4E, "KeyO": 0x4F,
	"KeyP": 0x50, "KeyQ": 0x51, "KeyR": 0x52, "KeyS": 0x53, "KeyT": 0x54,
	"KeyU": 0x55, "KeyV": 0x56, "KeyW": 0x57, "KeyX": 0x58, "KeyY": 0x59, "KeyZ": 0x5A,

	"Digit0": 0x30, "Digit1": 0x31, "Digit2": 0x32, "Digit3": 0x33, "Digit4": 0x34,
	"Digit5": 0x35, "Digit6": 0x36, "Digit7": 0x37, "Digit8": 0x38, "Digit9": 0x39,

	"Numpad0": 0x60, "Numpad1": 0x61, "Numpad2": 0x62, "Numpad3": 0x63, "Numpad4": 0x64,
	"Numpad5": 0x65, "Numpad6": 0x66, "Numpad7": 0x67, "Numpad8": 0x68, "Numpad9": 0x69,
	"NumpadMultiply": 0x6A, "NumpadAdd": 0x6B, "NumpadSubtract": 0x6D, "NumpadDecimal": 0x6E, "NumpadDivide": 0x6F,

	"Enter": 0x0D, "NumpadEnter": 0x0D, "Backspace": 0x08, "Tab": 0x09, "Space": 0x20, "Escape": 0x1B,
	"ArrowLeft": 0x25, "ArrowUp": 0x26, "ArrowRight": 0x27, "ArrowDown": 0x28,
	"ShiftLeft": 0xA0, "ShiftRight": 0xA1, "ControlLeft": 0xA2, "ControlRight": 0xA3,
	"AltLeft": 0x12, "AltRight": 0x12, "MetaLeft": 0x5B, "MetaRight": 0x5C,
	"Delete": 0x2E, "Insert": 0x2D, "Home": 0x24, "End": 0x23, "PageUp": 0x21, "PageDown": 0x22,
	"CapsLock": 0x14, "NumLock": 0x90, "ScrollLock": 0x91,
	"Semicolon": 0xBA, "Equal": 0xBB, "Comma": 0xBC, "Minus": 0xBD, "Period": 0xBE, "Slash": 0xBF,
	"Backquote": 0xC0, "BracketLeft": 0xDB, "Backslash": 0xDC, "BracketRight": 0xDD, "Quote": 0xDE,

	"F1": 0x70, "F2": 0x71, "F3": 0x72, "F4": 0x73, "F5": 0x74, "F6": 0x75,
	"F7": 0x76, "F8": 0x77, "F9": 0x78, "F10": 0x79, "F11": 0x7A, "F12": 0x7B,
}

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

type INPUT struct {
	Type uint32
	_    uint32
	Data [32]byte
}

type InputEventPayload struct {
	Category  string  `json:"category"`  // "MOUSE", "KEYBOARD", "SHORTCUT"
	Type      string  `json:"type"`      // "mousemove", "mousedown", "mouseup", "click", "contextmenu", "keydown", "keyup"
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
	OS           string
	ScreenWidth  int32
	ScreenHeight int32
}

func NewNativeInputInjector() *NativeInputInjector {
	injector := &NativeInputInjector{
		OS:           runtime.GOOS,
		ScreenWidth:  1920,
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

	// Payload Validation
	if payload.XPct < 0 || payload.XPct > 100 || payload.YPct < 0 || payload.YPct > 100 {
		return fmt.Errorf("invalid coordinate bounds: xPct=%.2f yPct=%.2f", payload.XPct, payload.YPct)
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

		// Physically set mouse cursor position on Windows OS
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
		vkCode := injector.getVirtualKeyCode(p.Code, p.Key)
		if vkCode != 0 {
			scanCode, _, _ := procMapVirtualKeyA.Call(uintptr(vkCode), 0)

			var dwFlags uint32 = KEYEVENTF_SCANCODE
			if p.Type == "keyup" {
				dwFlags |= KEYEVENTF_KEYUP
			}

			var inp INPUT
			inp.Type = INPUT_KEYBOARD
			ki := (*KEYBDINPUT)(unsafe.Pointer(&inp.Data[0]))
			ki.WVk = vkCode
			ki.WScan = uint16(scanCode)
			ki.DwFlags = dwFlags

			procSendInput.Call(1, uintptr(unsafe.Pointer(&inp)), uintptr(unsafe.Sizeof(inp)))
		} else if len(p.Key) > 0 {
			// Unicode text character fallback for international layouts
			var dwFlags uint32 = KEYEVENTF_UNICODE
			if p.Type == "keyup" {
				dwFlags |= KEYEVENTF_KEYUP
			}

			for _, char := range p.Key {
				var inp INPUT
				inp.Type = INPUT_KEYBOARD
				ki := (*KEYBDINPUT)(unsafe.Pointer(&inp.Data[0]))
				ki.WScan = uint16(char)
				ki.DwFlags = dwFlags

				procSendInput.Call(1, uintptr(unsafe.Pointer(&inp)), uintptr(unsafe.Sizeof(inp)))
			}
		}

	case "SHORTCUT":
		if p.Name == "CTRL_ALT_DEL" {
			// Execute SendSAS via sas.dll
			return injector.TriggerSendSAS()
		} else if p.Name == "ALT_TAB" {
			injector.sendKeyScanSequence([]uint16{0x38, 0x0F})
		}
	}

	return nil
}

// TriggerSendSAS executes official Win32 SendSAS or returns explicit security policy error
func (injector *NativeInputInjector) TriggerSendSAS() error {
	if procSendSAS != nil && procSendSAS.Find() == nil {
		r1, _, err := procSendSAS.Call(0) // SendSAS(AsUser = FALSE)
		if r1 != 0 {
			return nil
		}
		return fmt.Errorf("SAS execution unavailable: Windows policy/service/uiAccess requirements are not satisfied (%v)", err)
	}
	return fmt.Errorf("SAS execution unavailable: Windows policy/service/uiAccess requirements are not satisfied (sas.dll unavailable)")
}

func (injector *NativeInputInjector) getVirtualKeyCode(code string, key string) uint16 {
	if vk, ok := vkCodeMap[code]; ok {
		return vk
	}
	if len(key) > 0 {
		char := key[0]
		if char >= 'a' && char <= 'z' {
			return uint16(char - 32)
		}
		if char >= 'A' && char <= 'Z' {
			return uint16(char)
		}
		if char >= '0' && char <= '9' {
			return uint16(char)
		}
	}
	return 0
}

func (injector *NativeInputInjector) sendKeyScanSequence(scans []uint16) {
	for _, sc := range scans {
		var inp INPUT
		inp.Type = INPUT_KEYBOARD
		ki := (*KEYBDINPUT)(unsafe.Pointer(&inp.Data[0]))
		ki.WScan = sc
		ki.DwFlags = KEYEVENTF_SCANCODE
		procSendInput.Call(1, uintptr(unsafe.Pointer(&inp)), uintptr(unsafe.Sizeof(inp)))
	}
	for i := len(scans) - 1; i >= 0; i-- {
		var inp INPUT
		inp.Type = INPUT_KEYBOARD
		ki := (*KEYBDINPUT)(unsafe.Pointer(&inp.Data[0]))
		ki.WScan = scans[i]
		ki.DwFlags = KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP
		procSendInput.Call(1, uintptr(unsafe.Pointer(&inp)), uintptr(unsafe.Sizeof(inp)))
	}
}

func (injector *NativeInputInjector) injectLinux(p InputEventPayload) error {
	fmt.Printf("[Linux Input] Injected %s event: Pos (%.2f, %.2f)\n", p.Type, p.XPct, p.YPct)
	return nil
}

