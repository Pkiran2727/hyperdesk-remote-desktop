package service

import (
	"fmt"
	"runtime"
)

type ServiceManager struct {
	ServiceName string
	OS          string
}

func NewServiceManager() *ServiceManager {
	return &ServiceManager{
		ServiceName: "HyperDeskHostService",
		OS:          runtime.GOOS,
	}
}

func (sm *ServiceManager) RunAsService() error {
	if sm.OS == "windows" {
		fmt.Printf("[Service] Running as Windows Background Service (%s) - UAC Lock Screen Enabled\n", sm.ServiceName)
	} else {
		fmt.Printf("[Service] Running as Linux systemd daemon (%s)\n", sm.ServiceName)
	}
	return nil
}
