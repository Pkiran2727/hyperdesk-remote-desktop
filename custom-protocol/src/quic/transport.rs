use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QuicStreamType {
    VideoDatagram = 0,
    AudioStream = 1,
    InputEvent = 2,
    ClipboardSync = 3,
    ControlCommand = 4,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuicPacket {
    pub stream_type: QuicStreamType,
    pub payload_seq: u64,
    pub timestamp_us: u64, // Microsecond timestamp for sub-15ms latency benchmarks
    pub data: Vec<u8>,
}

pub struct QuicTransportMultiplexer {
    pub server_addr: String,
}

impl QuicTransportMultiplexer {
    pub fn new(server_addr: String) -> Self {
        println!("[QUIC Transport] Initialized multiplexer on {}", server_addr);
        Self { server_addr }
    }

    pub fn pack_video_frame(&self, seq: u64, frame_data: Vec<u8>) -> QuicPacket {
        QuicPacket {
            stream_type: QuicStreamType::VideoDatagram,
            payload_seq: seq,
            timestamp_us: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_micros() as u64,
            data: frame_data,
        }
    }
}
