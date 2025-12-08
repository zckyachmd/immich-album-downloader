/**
 * Simple rate limiter with exponential backoff
 * Prevents overwhelming the API server
 */
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  /**
   * Waits if necessary to respect rate limits
   * @returns {Promise<void>}
   */
  async waitIfNeeded() {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    // If we're at the limit, wait
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 10; // Add 10ms buffer
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.waitIfNeeded(); // Recursive check
    }

    // Record this request
    this.requests.push(now);
  }

  /**
   * Resets the rate limiter
   */
  reset() {
    this.requests = [];
  }
}

// Create a default rate limiter (10 requests per second)
// Can be configured via environment variable
const maxRequests = parseInt(process.env.IMMICH_RATE_LIMIT_REQUESTS || "10", 10);
const windowMs = parseInt(process.env.IMMICH_RATE_LIMIT_WINDOW_MS || "1000", 10);

export const rateLimiter = new RateLimiter(maxRequests, windowMs);
export { RateLimiter };
