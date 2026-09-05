package multimonitor

import (
	"fmt"
	"runtime"
)

type MonitorInfo struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	IsPrimary bool   `json:"isPrimary"`
}

type MonitorManager struct {
	ActiveMonitorID int
	Monitors        []MonitorInfo
}

func NewMonitorManager() *MonitorManager {
	mm := &MonitorManager{
		ActiveMonitorID: 0,
	}
	mm.EnumerateMonitors()
	return mm
}

func (mm *MonitorManager) EnumerateMonitors() []MonitorInfo {
	monitors := []MonitorInfo{}

	if runtime.GOOS == "windows" {
		// Win32 EnumDisplayMonitors API Binding Simulation
		monitors = append(monitors, MonitorInfo{
			ID:        0,
			Name:      "Display 1 (Primary DXGI)",
			Width:     1920,
			Height:    1080,
			IsPrimary: true,
		})
		monitors = append(monitors, MonitorInfo{
			ID:        1,
			Name:      "Display 2 (Secondary DXGI)",
			Width:     2560,
			Height:    1440,
			IsPrimary: false,
		})
	} else {
		// Linux X11 / PipeWire Output Enumeration
		monitors = append(monitors, MonitorInfo{
			ID:        0,
			Name:      "eDP-1 (Primary PipeWire)",
			Width:     1920,
			Height:    1080,
			IsPrimary: true,
		})
		monitors = append(monitors, MonitorInfo{
			ID:        1,
			Name:      "HDMI-1 (External Monitor)",
			Width:     1920,
			Height:    1080,
			IsPrimary: false,
		})
	}

	mm.Monitors = monitors
	return monitors
}

func (mm *MonitorManager) SwitchMonitor(id int) error {
	for _, mon := range mm.Monitors {
		if mon.ID == id {
			mm.ActiveMonitorID = id
			fmt.Printf("[MultiMonitor] Switched active capture display to Monitor #%d (%s)\n", id, mon.Name)
			return nil
		}
	}
	return fmt.Errorf("monitor ID %d not found", id)
}
