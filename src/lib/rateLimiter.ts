class RateLimiter {
  maxRequests: number;
  windowMs: number;
  requests: number[];

  constructor(maxRequests = 10, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 10;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.waitIfNeeded();
    }

    this.requests.push(now);
  }

  reset() {
    this.requests = [];
  }
}

const maxRequests = parseInt(process.env.IMMICH_RATE_LIMIT_REQUESTS || "10", 10);
const windowMs = parseInt(process.env.IMMICH_RATE_LIMIT_WINDOW_MS || "1000", 10);

export const rateLimiter = new RateLimiter(maxRequests, windowMs);
export { RateLimiter };
