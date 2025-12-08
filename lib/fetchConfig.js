import https from "https";
import { config } from "./config.js";

/**
 * Creates a custom fetch agent for HTTPS requests
 * Handles SSL certificate validation based on configuration
 * @returns {https.Agent|null} HTTPS agent or null for HTTP
 */
export function createFetchAgent() {
  // Only create agent for HTTPS
  if (config.baseUrl.startsWith("https://")) {
    return new https.Agent({
      rejectUnauthorized: config.sslVerify,
    });
  }
  return null;
}

/**
 * Gets fetch options with proper SSL configuration
 * @param {Object} additionalOptions - Additional fetch options
 * @returns {Object} Fetch options with agent configured
 */
export function getFetchOptions(additionalOptions = {}) {
  const agent = createFetchAgent();

  return {
    ...additionalOptions,
    ...(agent && { agent }),
  };
}
