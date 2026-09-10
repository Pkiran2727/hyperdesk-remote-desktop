# HyperDesk - Enterprise WebRTC Remote Desktop Platform

HyperDesk is a high-performance, low-latency (<15ms) WebRTC remote desktop platform featuring a native Go host agent, custom QUIC datagram transport, multi-monitor display switching, WASAPI/PulseAudio 48kHz audio capture, and mobile touch translation.

## Prerequisites & Dependencies

### Native Go Host Agent (`host-agent/`)
Building the Go host agent requires Cgo (`CGO_ENABLED=1`) and system development libraries for `libvpx` and `libva`:

#### Ubuntu / Debian / Fedora Linux:
```bash
# Ubuntu / Debian:
sudo apt-get update
sudo apt-get install -y build-essential libvpx-dev libva-dev pkg-config

# Fedora / RHEL:
sudo dnf install -y gcc libvpx-devel libva-devel pkgconfig
```

### Video Encoding Architecture
- **Software Encoder**: Genuine `libvpx` Cgo encoder (`vpx_codec_encode`) producing standard RFC 6386 VP8 elementary bitstreams.
- **Hardware Acceleration Probe**: 7-stage VA-API hardware capability probe (`/dev/dri/renderD128`) inspecting `VAProfileVP8Version0_3` + `VAEntrypointEncSlice` and `vaCreateContext`.
- **Intel UHD 730 iGPU**: Automatically selects `SOFTWARE (libvpx)` since 12th-Gen Intel media drivers support H.264/HEVC/VP9/AV1 hardware encoding while omitting VP8 hardware encoding.

## Running Tests

```bash
# Start signaling server:
npm run server

# Run master unified product test suite:
node tests/master_unified_suite.test.js
```
