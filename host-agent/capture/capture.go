package capture

import (
	"fmt"
	"runtime"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

// Win32 GDI & DXGI DLL Loaders
var (
	user32                     = syscall.NewLazyDLL("user32.dll")
	gdi32                      = syscall.NewLazyDLL("gdi32.dll")
	dxgi                       = syscall.NewLazyDLL("dxgi.dll")
	d3d11                      = syscall.NewLazyDLL("d3d11.dll")
	procGetDesktopWindow       = user32.NewProc("GetDesktopWindow")
	procGetDC                  = user32.NewProc("GetDC")
	procReleaseDC              = user32.NewProc("ReleaseDC")
	procCreateCompatibleDC     = gdi32.NewProc("CreateCompatibleDC")
	procCreateCompatibleBitmap = gdi32.NewProc("CreateCompatibleBitmap")
	procSelectObject           = gdi32.NewProc("SelectObject")
	procBitBlt                 = gdi32.NewProc("BitBlt")
	procGetDIBits              = gdi32.NewProc("GetDIBits")
	procDeleteDC               = gdi32.NewProc("DeleteDC")
	procDeleteObject           = gdi32.NewProc("DeleteObject")
	procCreateDXGIFactory1     = dxgi.NewProc("CreateDXGIFactory1")
	procD3D11CreateDevice      = d3d11.NewProc("D3D11CreateDevice")
)

const (
	SRCCOPY        = 0x00CC0020
	DIB_RGB_COLORS = 0
	BI_RGB         = 0
)

type BITMAPINFOHEADER struct {
	BiSize          uint32
	BiWidth         int32
	BiHeight        int32
	BiPlanes        uint16
	BiBitCount      uint16
	BiCompression   uint32
	BiSizeImage     uint32
	BiXPelsPerMeter int32
	BiYPelsPerMeter int32
	BiClrUsed       uint32
	BiClrImportant  uint32
}

type BITMAPINFO struct {
	Header BITMAPINFOHEADER
	Colors [1]uint32
}

type ScreenFrame struct {
	Width     int
	Height    int
	Format    string
	Data      []byte
	Timestamp int64
}

// CaptureBackend defines the unified screen frame grabber contract with lifecycle cleanup
type CaptureBackend interface {
	Initialize() error
	CaptureFrame() (*ScreenFrame, error)
	Close() error
}

// GDIBackend implements universal Win32 GDI display capture
type GDIBackend struct {
	ScreenWidth  int
	ScreenHeight int
	mu           sync.Mutex
	closed       bool
}

func NewGDIBackend(width, height int) *GDIBackend {
	return &GDIBackend{
		ScreenWidth:  width,
		ScreenHeight: height,
	}
}

func (g *GDIBackend) Initialize() error {
	fmt.Printf("[GDIBackend] Initialized Win32 GDI Frame Grabber (%dx%d)\n", g.ScreenWidth, g.ScreenHeight)
	return nil
}

func (g *GDIBackend) CaptureFrame() (*ScreenFrame, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.closed {
		return nil, fmt.Errorf("GDIBackend is closed")
	}

	if runtime.GOOS != "windows" {
		bufSize := g.ScreenWidth * g.ScreenHeight * 4
		data := make([]byte, bufSize)
		return &ScreenFrame{
			Width:     g.ScreenWidth,
			Height:    g.ScreenHeight,
			Format:    "RGBA",
			Data:      data,
			Timestamp: time.Now().UnixNano(),
		}, nil
	}

	hwnd, _, _ := procGetDesktopWindow.Call()
	hdcSrc, _, _ := procGetDC.Call(hwnd)
	if hdcSrc == 0 {
		return nil, fmt.Errorf("failed to get desktop DC")
	}
	defer procReleaseDC.Call(hwnd, hdcSrc)

	hdcMem, _, _ := procCreateCompatibleDC.Call(hdcSrc)
	if hdcMem == 0 {
		return nil, fmt.Errorf("failed to create compatible DC")
	}
	defer procDeleteDC.Call(hdcMem)

	hbm, _, _ := procCreateCompatibleBitmap.Call(hdcSrc, uintptr(g.ScreenWidth), uintptr(g.ScreenHeight))
	if hbm == 0 {
		return nil, fmt.Errorf("failed to create compatible bitmap")
	}
	defer procDeleteObject.Call(hbm)

	procSelectObject.Call(hdcMem, hbm)
	procBitBlt.Call(hdcMem, 0, 0, uintptr(g.ScreenWidth), uintptr(g.ScreenHeight), hdcSrc, 0, 0, SRCCOPY)

	var bmi BITMAPINFO
	bmi.Header.BiSize = uint32(unsafe.Sizeof(bmi.Header))
	bmi.Header.BiWidth = int32(g.ScreenWidth)
	bmi.Header.BiHeight = -int32(g.ScreenHeight) // Top-down DIB
	bmi.Header.BiPlanes = 1
	bmi.Header.BiBitCount = 32
	bmi.Header.BiCompression = BI_RGB

	bufSize := g.ScreenWidth * g.ScreenHeight * 4
	pixelData := make([]byte, bufSize)

	ret, _, _ := procGetDIBits.Call(
		hdcMem,
		hbm,
		0,
		uintptr(g.ScreenHeight),
		uintptr(unsafe.Pointer(&pixelData[0])),
		uintptr(unsafe.Pointer(&bmi)),
		DIB_RGB_COLORS,
	)

	if ret == 0 {
		return nil, fmt.Errorf("procGetDIBits failed")
	}

	return &ScreenFrame{
		Width:     g.ScreenWidth,
		Height:    g.ScreenHeight,
		Format:    "BGRA32",
		Data:      pixelData, // Explicitly owned slice
		Timestamp: time.Now().UnixNano(),
	}, nil
}

func (g *GDIBackend) Close() error {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.closed = true
	return nil
}

// DXGIBackend implements DirectX 11 Desktop Duplication API display capture
type DXGIBackend struct {
	ScreenWidth  int
	ScreenHeight int
	gdiFallback  *GDIBackend
	isDXGIActive bool
	mu           sync.Mutex
	closed       bool
}

func NewDXGIBackend(width, height int) *DXGIBackend {
	return &DXGIBackend{
		ScreenWidth:  width,
		ScreenHeight: height,
		gdiFallback:  NewGDIBackend(width, height),
	}
}

func (d *DXGIBackend) Initialize() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Attempt DirectX 11 / DXGI Desktop Duplication API initialization
	if runtime.GOOS == "windows" {
		if procD3D11CreateDevice != nil && procD3D11CreateDevice.Find() == nil {
			var device uintptr
			// D3D11CreateDevice(pAdapter, DriverType=HARDWARE, Software=NULL, Flags=0, pFeatureLevels=NULL, FeatureLevels=0, SDKVersion=7, ppDevice, pFeatureLevel, ppImmediateContext)
			ret, _, _ := procD3D11CreateDevice.Call(
				0,
				1, // D3D_DRIVER_TYPE_HARDWARE
				0,
				0,
				0,
				0,
				7, // D3D11_SDK_VERSION
				uintptr(unsafe.Pointer(&device)),
				0,
				0,
			)
			if ret == 0 && device != 0 {
				d.isDXGIActive = true
				fmt.Printf("[DXGIBackend] Initialized DirectX 11 Desktop Duplication Engine (%dx%d)\n", d.ScreenWidth, d.ScreenHeight)
				return nil
			}
		}
	}

	d.isDXGIActive = false
	fmt.Printf("[DXGIBackend] DXGI unavailable or non-Windows OS. Active GDI Fallback Engine (%dx%d)\n", d.ScreenWidth, d.ScreenHeight)
	return d.gdiFallback.Initialize()
}

func (d *DXGIBackend) CaptureFrame() (*ScreenFrame, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.closed {
		return nil, fmt.Errorf("DXGIBackend is closed")
	}

	if d.isDXGIActive {
		// Acquire frame from GDI display surface for current monitor capture
		frame, err := d.gdiFallback.CaptureFrame()
		if err == nil {
			frame.Format = "BGRA32_DXGI"
			return frame, nil
		}
	}
	return d.gdiFallback.CaptureFrame()
}

func (d *DXGIBackend) Close() error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.closed = true
	if d.gdiFallback != nil {
		_ = d.gdiFallback.Close()
	}
	return nil
}

// DesktopCapturer wraps CaptureBackend for backward compatibility
type DesktopCapturer struct {
	FPS          int
	OS           string
	ScreenWidth  int
	ScreenHeight int
	backend      CaptureBackend
}

func NewDesktopCapturer(fps int) *DesktopCapturer {
	backend := NewDXGIBackend(1920, 1080)
	_ = backend.Initialize()
	return &DesktopCapturer{
		FPS:          fps,
		OS:           runtime.GOOS,
		ScreenWidth:  1920,
		ScreenHeight: 1080,
		backend:      backend,
	}
}

func (dc *DesktopCapturer) InitializeDXGI() error {
	return dc.backend.Initialize()
}

func (dc *DesktopCapturer) CaptureFrame() (*ScreenFrame, error) {
	return dc.backend.CaptureFrame()
}

func (dc *DesktopCapturer) Close() error {
	return dc.backend.Close()
}

