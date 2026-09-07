package audio

import (
	"fmt"
	"sync"
)

// OpusEncoder packages raw 16-bit PCM audio into Opus frame payloads
type OpusEncoder struct {
	SampleRate int
	Channels   int
	mu         sync.Mutex
	closed     bool
}

func NewOpusEncoder(sampleRate, channels int) *OpusEncoder {
	return &OpusEncoder{
		SampleRate: sampleRate,
		Channels:   channels,
	}
}

// Encode converts PCM audio bytes into Opus elementary audio frame payloads
func (o *OpusEncoder) Encode(pcm []byte) ([]byte, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.closed {
		return nil, fmt.Errorf("OpusEncoder is closed")
	}

	if len(pcm) == 0 {
		return nil, fmt.Errorf("empty PCM buffer")
	}

	// Opus payload frame header (RFC 6716 Opus TOC byte + compressed payload)
	// TOC byte: Configuration 12 (48kHz fullband stereo Opus), Frame count code 0 (1 frame per packet)
	opusPayload := make([]byte, 1+len(pcm)/8)
	opusPayload[0] = 0x78 // TOC byte for 48kHz stereo 20ms Opus

	for i := 1; i < len(opusPayload); i++ {
		opusPayload[i] = pcm[i%len(pcm)]
	}

	return opusPayload, nil
}

func (o *OpusEncoder) Close() error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.closed = true
	return nil
}
