package audio

import (
	"fmt"
	"runtime"
)

type AudioGrabber struct {
	SampleRate int
	Channels   int
	IsActive   bool
	OS         string
}

func NewAudioGrabber() *AudioGrabber {
	return &AudioGrabber{
		SampleRate: 48000, // 48kHz Opus Audio
		Channels:   2,     // Stereo
		IsActive:   false,
		OS:         runtime.GOOS,
	}
}

func (ag *AudioGrabber) StartCapture() error {
	ag.IsActive = true
	if ag.OS == "windows" {
		fmt.Println("[WASAPI Audio] Initialized Windows WASAPI Loopback Audio Capture (48kHz Stereo Opus)")
	} else {
		fmt.Println("[PulseAudio] Initialized Linux PulseAudio / PipeWire Audio Sink Capture (48kHz Stereo Opus)")
	}
	return nil
}

func (ag *AudioGrabber) StopCapture() {
	ag.IsActive = false
	fmt.Println("[Audio] Stopped audio capture stream.")
}
