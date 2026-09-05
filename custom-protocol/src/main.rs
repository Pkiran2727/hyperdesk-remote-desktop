mod codec;
mod quic;

use codec::nvenc::{HardwareEncoderConfig, HardwareEncoderEngine};
use quic::transport::QuicTransportMultiplexer;

fn main() {
    println!("=========================================================");
    fmt_banner();

    let encoder_cfg = HardwareEncoderConfig::default();
    let _encoder = HardwareEncoderEngine::new(encoder_cfg);

    let _transport = QuicTransportMultiplexer::new("0.0.0.0:4433".to_string());

    println!("[CustomProtocol] QUIC Ultra-Low Latency engine running (<15ms target benchmark).");
}

fn fmt_banner() {
    println!("   HYPERDESK CUSTOM QUIC PROTOCOL ENGINE v1.0 (<15ms)");
    println!("=========================================================");
}
