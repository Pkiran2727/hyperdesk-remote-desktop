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
	stream     *WASAPIStream
	opusEnc    *OpusEncoder
}

func NewAudioGrabber() *AudioGrabber {
	ag := &AudioGrabber{
		SampleRate: 48000, // 48kHz Opus Audio
		Channels:   2,     // Stereo PCM
		IsActive:   false,
		OS:         runtime.GOOS,
	}
	ag.stream = NewWASAPIStream(ag.SampleRate, ag.Channels)
	ag.opusEnc = NewOpusEncoder(ag.SampleRate, ag.Channels)
	return ag
}

func (ag *AudioGrabber) StartCapture() error {
	ag.IsActive = true
	return ag.stream.StartCapture()
}

func (ag *AudioGrabber) ReadPCMFrame() []byte {
	pcm, err := ag.stream.ReadPCMFrame()
	if err != nil {
		frameSize := 48000 * 2 * 2 / 50
		return make([]byte, frameSize)
	}
	return pcm
}

func (ag *AudioGrabber) ReadOpusFrame() ([]byte, error) {
	pcm, err := ag.stream.ReadPCMFrame()
	if err != nil {
		return nil, err
	}
	return ag.opusEnc.Encode(pcm)
}

func (ag *AudioGrabber) StopCapture() {
	ag.IsActive = false
	_ = ag.stream.StopCapture()
	_ = ag.opusEnc.Close()
	fmt.Println("[Audio] Stopped WASAPI system audio loopback capture stream.")
}

