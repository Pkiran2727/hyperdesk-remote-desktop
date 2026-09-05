export class RateLimiter {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 20; // 20 requests per window
    this.refillRate = options.refillRate || 2; // 2 tokens per sec
    this.maxAttempts = options.maxAttempts || 5; // 5 failed passcode attempts
    this.lockoutTimeMs = options.lockoutTimeMs || 15 * 60 * 1000; // 15 mins lockout

    this.ipTokens = new Map(); // ip -> { tokens, lastRefill }
    this.failedAttempts = new Map(); // ip:hostId -> { count, lockedUntil }
  }

  isRateLimited(ip) {
    const now = Date.now();
    let bucket = this.ipTokens.get(ip);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.ipTokens.set(ip, bucket);
    } else {
      const elapsedSec = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsedSec * this.refillRate);
      bucket.lastRefill = now;
    }

    if (bucket.tokens < 1) {
      return true; // Rate limited
    }

    bucket.tokens -= 1;
    return false;
  }

  recordFailedAttempt(ip, hostId) {
    const key = `${ip}:${hostId}`;
    const now = Date.now();
    let record = this.failedAttempts.get(key);

    if (!record) {
      record = { count: 1, lockedUntil: 0 };
    } else {
      record.count += 1;
      if (record.count >= this.maxAttempts) {
        record.lockedUntil = now + this.lockoutTimeMs;
        console.warn(`[RateLimiter] Brute-force detected! IP ${ip} locked out for room ${hostId} until ${new Date(record.lockedUntil).toLocaleTimeString()}`);
      }
    }

    this.failedAttempts.set(key, record);
    return record;
  }

  isLockedOut(ip, hostId) {
    const key = `${ip}:${hostId}`;
    const record = this.failedAttempts.get(key);
    if (!record) return false;

    if (record.lockedUntil > Date.now()) {
      return true;
    }

    if (record.lockedUntil !== 0 && record.lockedUntil <= Date.now()) {
      // Lockout expired
      this.failedAttempts.delete(key);
      return false;
    }

    return false;
  }

  resetAttempts(ip, hostId) {
    const key = `${ip}:${hostId}`;
    this.failedAttempts.delete(key);
  }
}
