import { ConfigurationError } from "./errors.js";

/**
 * Validates and exports configuration
 * Throws error early if configuration is invalid
 * @throws {ConfigurationError} If configuration is invalid
 */
function validateConfig() {
  const required = ["IMMICH_API_KEY", "IMMICH_BASE_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please set them in your .env file or environment."
    );
  }

  // Validate API key format (basic check)
  if (process.env.IMMICH_API_KEY.length < 10) {
    throw new ConfigurationError("IMMICH_API_KEY appears to be invalid (too short)");
  }

  // Validate URL format and normalize
  let baseUrl;
  try {
    baseUrl = new URL(process.env.IMMICH_BASE_URL);
  } catch (e) {
    throw new ConfigurationError(
      `IMMICH_BASE_URL must be a valid URL. Got: ${process.env.IMMICH_BASE_URL}`
    );
  }

  // Normalize base URL - remove trailing slashes
  // Keep /api if present - we'll handle it in API calls
  let normalizedBaseUrl = baseUrl.href.replace(/\/+$/, ""); // Remove trailing slashes

  // Warn/error on HTTP in production
  if (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
    throw new ConfigurationError("IMMICH_BASE_URL must use HTTPS in production environment");
  }

  // Warn on HTTP in development
  if (process.env.NODE_ENV !== "production" && baseUrl.protocol !== "https:") {
    console.warn("⚠️  WARNING: Using HTTP connection. This is insecure!");
  }

  // SSL/TLS configuration
  // Default: true (verify SSL certificates)
  // Set IMMICH_SSL_VERIFY=false to skip SSL verification (for self-signed certs)
  const sslVerify = process.env.IMMICH_SSL_VERIFY !== "false";

  if (!sslVerify && process.env.NODE_ENV === "production") {
    console.warn("⚠️  WARNING: SSL certificate verification is disabled. This is insecure!");
  }

  // Concurrency configuration
  // Default: 5 concurrent downloads
  // Can be overridden by CLI argument --concurrency
  let concurrency = 5;
  if (process.env.IMMICH_CONCURRENCY) {
    const parsed = parseInt(process.env.IMMICH_CONCURRENCY, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
      concurrency = parsed;
    } else {
      console.warn(`⚠️  WARNING: IMMICH_CONCURRENCY must be between 1 and 50. Using default: 5`);
    }
  }

  // Max retries configuration
  // Default: 3 retries
  // Can be overridden by CLI argument --max-retries
  let maxRetries = 3;
  if (process.env.IMMICH_MAX_RETRIES) {
    const parsed = parseInt(process.env.IMMICH_MAX_RETRIES, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
      maxRetries = parsed;
    } else {
      console.warn(`⚠️  WARNING: IMMICH_MAX_RETRIES must be between 0 and 10. Using default: 3`);
    }
  }

  // Download timeout configuration (in milliseconds)
  // Default: 30000 (30 seconds)
  // Increase for large files or slow connections
  let downloadTimeout = 30000;
  if (process.env.IMMICH_DOWNLOAD_TIMEOUT) {
    const parsed = parseInt(process.env.IMMICH_DOWNLOAD_TIMEOUT, 10);
    if (!isNaN(parsed) && parsed >= 5000 && parsed <= 600000) {
      downloadTimeout = parsed;
    } else {
      console.warn(
        `⚠️  WARNING: IMMICH_DOWNLOAD_TIMEOUT must be between 5000 and 600000 ms (5s-10m). Using default: 30000`
      );
    }
  }

  return {
    apiKey: process.env.IMMICH_API_KEY,
    baseUrl: normalizedBaseUrl,
    defaultOutput: process.env.DEFAULT_OUTPUT || "./media-downloads",
    sslVerify: sslVerify,
    concurrency: concurrency,
    maxRetries: maxRetries,
    downloadTimeout: downloadTimeout,
  };
}

export const config = validateConfig();
