const CHUNK_SIZE = 64 * 1024; // 64KB Chunk Size for low-latency WebRTC DataChannel

export class FileTransferService {
  constructor(dataChannel) {
    this.dataChannel = dataChannel;
    this.activeTransfers = new Map(); // transferId -> { name, size, receivedBytes, chunks, sha256 }
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;

    if (this.dataChannel) {
      this.setupListener();
    }
  }

  setDataChannel(channel) {
    this.dataChannel = channel;
    this.setupListener();
  }

  setupListener() {
    if (!this.dataChannel) return;

    this.dataChannel.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);

          if (msg.type === 'FILE_START') {
            this.activeTransfers.set(msg.transferId, {
              id: msg.transferId,
              name: msg.name,
              size: msg.size,
              receivedBytes: 0,
              chunks: [],
              expectedSha256: msg.sha256,
              startTime: Date.now()
            });
            console.log(`[FileTransfer] Started receiving file: ${msg.name} (${(msg.size / 1024 / 1024).toFixed(2)} MB)`);
          } else if (msg.type === 'FILE_END') {
            const transfer = this.activeTransfers.get(msg.transferId);
            if (transfer) {
              const fileBlob = new Blob(transfer.chunks);
              const calculatedSha256 = await this.calculateSha256(fileBlob);

              if (transfer.expectedSha256 && transfer.expectedSha256 !== calculatedSha256) {
                console.error('[FileTransfer] Checksum mismatch error!');
                if (this.onError) this.onError(transfer.id, 'SHA-256 Checksum mismatch!');
              } else {
                console.log(`[FileTransfer] Successfully completed download: ${transfer.name}`);
                if (this.onComplete) {
                  this.onComplete({
                    id: transfer.id,
                    name: transfer.name,
                    blob: fileBlob,
                    size: transfer.size
                  });
                }
              }
            }
          }
        } else if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
          // Binary chunk received
          const arrayBuffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
          // Find active receiving transfer
          const activeId = Array.from(this.activeTransfers.keys()).pop();
          if (activeId) {
            const transfer = this.activeTransfers.get(activeId);
            transfer.chunks.push(arrayBuffer);
            transfer.receivedBytes += arrayBuffer.byteLength;

            const progressPct = Math.min(100, (transfer.receivedBytes / transfer.size) * 100);
            const elapsedSec = (Date.now() - transfer.startTime) / 1000;
            const speedMbps = elapsedSec > 0 ? (transfer.receivedBytes / 1024 / 1024 / elapsedSec).toFixed(2) : '0';

            if (this.onProgress) {
              this.onProgress({
                id: transfer.id,
                name: transfer.name,
                progressPct,
                speedMbps,
                receivedBytes: transfer.receivedBytes,
                totalBytes: transfer.size
              });
            }
          }
        }
      } catch (err) {
        console.error('[FileTransfer] Message processing error:', err);
      }
    };
  }

  async sendFile(file, transferId = 'FT_' + Date.now()) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel is not open for file transfer');
    }

    const sha256 = await this.calculateSha256(file);

    // 1. Send Header
    this.dataChannel.send(JSON.stringify({
      type: 'FILE_START',
      transferId,
      name: file.name,
      size: file.size,
      sha256
    }));

    // 2. Stream Chunks
    let offset = 0;
    const startTime = Date.now();

    while (offset < file.size) {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();

      this.dataChannel.send(buffer);
      offset += buffer.byteLength;

      const progressPct = Math.min(100, (offset / file.size) * 100);
      const elapsedSec = (Date.now() - startTime) / 1000;
      const speedMbps = elapsedSec > 0 ? (offset / 1024 / 1024 / elapsedSec).toFixed(2) : '0';

      if (this.onProgress) {
        this.onProgress({
          id: transferId,
          name: file.name,
          progressPct,
          speedMbps,
          receivedBytes: offset,
          totalBytes: file.size
        });
      }

      // Small throttle to prevent flooding WebRTC DataChannel queue
      if (this.dataChannel.bufferedAmount > 5 * 1024 * 1024) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    // 3. Send End Packet
    this.dataChannel.send(JSON.stringify({
      type: 'FILE_END',
      transferId
    }));
  }

  async calculateSha256(fileOrBlob) {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
