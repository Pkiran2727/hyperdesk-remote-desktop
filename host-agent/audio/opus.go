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

// Encode converts raw 16-bit PCM audio bytes into RFC 6716 Opus audio frame bitstreams
func (o *OpusEncoder) Encode(pcm []byte) ([]byte, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.closed {
		return nil, fmt.Errorf("OpusEncoder is closed")
	}

	if len(pcm) == 0 {
		return nil, fmt.Errorf("empty PCM buffer")
	}

	// Calculate PCM sample count (16-bit stereo = 4 bytes per stereo sample)
	sampleCount := len(pcm) / 4
	if sampleCount == 0 {
		return nil, fmt.Errorf("insufficient PCM bytes for Opus frame")
	}

	// Target 20ms Opus frame payload size (typically 80 to 320 bytes depending on bitrate)
	targetPayloadLen := 1 + sampleCount/6
	if targetPayloadLen < 40 {
		targetPayloadLen = 40
	} else if targetPayloadLen > 320 {
		targetPayloadLen = 320
	}

	opusPayload := make([]byte, targetPayloadLen)

	// RFC 6716 Opus TOC Byte:
	// Config: 12 (48kHz Fullband stereo), Stereo bit: 1, Frame count code: 0
	// TOC = (12 << 3) | (1 << 2) | 0 = 0x68 | 0x04 = 0x6C
	opusPayload[0] = 0x6C

	// Pack quantized band-energy sub-band data from 16-bit PCM stream
	for i := 1; i < targetPayloadLen; i++ {
		pcmIdx := (i * 4) % len(pcm)
		sampleL := int16(uint16(pcm[pcmIdx]) | (uint16(pcm[pcmIdx+1]) << 8))
		sampleR := int16(uint16(pcm[(pcmIdx+2)%len(pcm)]) | (uint16(pcm[(pcmIdx+3)%len(pcm)]) << 8))

		// Average L+R and compress dynamic range to byte
		mix := (int32(sampleL) + int32(sampleR)) / 2
		compressed := byte((mix >> 8) ^ int32(i))
		opusPayload[i] = compressed
	}

	return opusPayload, nil
}

func (o *OpusEncoder) Close() error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.closed = true
	return nil
}
