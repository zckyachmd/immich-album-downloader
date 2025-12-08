import fetch from "node-fetch";
import { config } from "./config.js";
import { log, logError } from "./logger.js";
import { getFetchOptions } from "./fetchConfig.js";

/**
 * Checks if the Immich API is accessible and credentials are valid
 * @returns {Promise<boolean>} True if healthy, false otherwise
 */
export async function checkHealth() {
  try {
    // Normalize base URL - ensure we have /api prefix
    const apiBase = config.baseUrl.endsWith("/api") ? config.baseUrl : `${config.baseUrl}/api`;

    // Health check endpoints (with fallback)
    // Primary: /api/server/about - Official server info endpoint (Status: Stable)
    // Fallback: /api/albums - Reliable endpoint if /api/server/about fails
    const endpoints = [
      `${apiBase}/server/about`, // Primary: official server info endpoint (confirmed working)
      `${apiBase}/albums`, // Fallback: albums endpoint (always works)
    ];

    if (process.env.NODE_ENV === "development" || process.env.VERBOSE === "true") {
      log(`🔍 Trying health check endpoints:`, "info");
      endpoints.forEach((url, i) => {
        log(`  ${i + 1}. ${url}`, "info");
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let lastError = null;
    let triedEndpoints = [];

    for (const url of endpoints) {
      try {
        const res = await fetch(
          url,
          getFetchOptions({
            headers: {
              "x-api-key": config.apiKey,
              Accept: "application/json",
            },
            signal: controller.signal,
          })
        );

        clearTimeout(timeout);

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            logError("❌ Authentication failed. Please check your IMMICH_API_KEY.");
            return false;
          }
          // Try next endpoint if this one fails (only log in verbose mode)
          if (url !== endpoints[endpoints.length - 1]) {
            triedEndpoints.push({ url, status: res.status, reason: "HTTP " + res.status });
            if (process.env.NODE_ENV === "development" || process.env.VERBOSE === "true") {
              log(`⚠️  Endpoint ${url} returned ${res.status}, trying next...`, "info");
            }
            continue;
          }
          logError(`❌ API returned status ${res.status}. Please check your IMMICH_BASE_URL.`);
          return false;
        }

        // Check if response is JSON
        let data;
        const contentType = res.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          // Try to get text to see what we got
          const text = await res.text();
          if (text.trim().startsWith("<!")) {
            // HTML response - endpoint might not exist, try next (only log in verbose)
            if (url !== endpoints[endpoints.length - 1]) {
              triedEndpoints.push({ url, status: res.status, reason: "HTML response" });
              if (process.env.NODE_ENV === "development" || process.env.VERBOSE === "true") {
                log(`⚠️  Endpoint ${url} returned HTML, trying next...`, "info");
              }
              continue;
            }
            // Last endpoint failed - this is a real error
            logError(
              `❌ Server returned HTML instead of JSON. This might indicate a wrong URL or server error.`
            );
            logError(`Response preview: ${text.substring(0, 200)}...`, { verbose: true });
            return false;
          }
          // Try to parse as JSON anyway
          try {
            data = JSON.parse(text);
          } catch (e) {
            if (url !== endpoints[endpoints.length - 1]) {
              triedEndpoints.push({ url, status: res.status, reason: "Invalid JSON" });
              if (process.env.NODE_ENV === "development" || process.env.VERBOSE === "true") {
                log(`⚠️  Endpoint ${url} returned invalid JSON, trying next...`, "info");
              }
              continue;
            }
            logError(`❌ Could not parse response as JSON. Content-Type: ${contentType}`);
            return false;
          }
        } else {
          try {
            data = await res.json();
          } catch (e) {
            // If JSON parsing fails, try to get text
            const text = await res.text();
            if (url !== endpoints[endpoints.length - 1]) {
              triedEndpoints.push({ url, status: res.status, reason: "JSON parse error" });
              if (process.env.NODE_ENV === "development" || process.env.VERBOSE === "true") {
                log(`⚠️  Endpoint ${url} JSON parse failed, trying next...`, "info");
              }
              continue;
            }
            logError(`❌ Failed to parse JSON response: ${e.message}`);
            logError(`Response preview: ${text.substring(0, 200)}...`, { verbose: true });
            return false;
          }
        }

        // Extract version from response (different endpoints may have different structures)
        let version = "unknown";
        let serverInfo = "";

        if (data.version) {
          // /api/server/about endpoint returns version directly
          version = data.version;
          // Build additional info string
          // Note: version from API already includes 'v' prefix (e.g., "v2.3.1")
          if (data.build) {
            serverInfo = ` (${data.version}, build: ${data.build.substring(0, 7)})`;
          } else {
            serverInfo = ` (${data.version})`;
          }
        } else if (data.serverVersion) {
          version = data.serverVersion;
          serverInfo = ` (version: ${version})`;
        } else if (Array.isArray(data)) {
          // If it's albums endpoint, we got a valid response
          version = "connected";
        }

        // If we tried other endpoints before this one succeeded, log it in verbose mode
        if (
          triedEndpoints.length > 0 &&
          (process.env.NODE_ENV === "development" || process.env.VERBOSE === "true")
        ) {
          log(
            `ℹ️  Successfully connected via ${url} (tried ${triedEndpoints.length} other endpoint(s) first)`,
            "info"
          );
        }

        log(
          `✅ Connected to Immich server${serverInfo || (version !== "connected" ? ` (version: ${version})` : "")}`
        );
        return true;
      } catch (fetchError) {
        lastError = fetchError;
        // Try next endpoint if this one fails
        if (url !== endpoints[endpoints.length - 1]) {
          continue;
        }
        clearTimeout(timeout);
        throw fetchError;
      }
    }

    // If all endpoints failed
    if (lastError) {
      throw lastError;
    }

    return false;
  } catch (err) {
    if (err.name === "AbortError") {
      logError("❌ Connection timeout. Please check your IMMICH_BASE_URL and network connection.");
    } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      logError(`❌ Cannot connect to ${config.baseUrl}. Please check your IMMICH_BASE_URL.`);
    } else if (
      err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      err.code === "CERT_HAS_EXPIRED" ||
      err.code === "SELF_SIGNED_CERT_IN_CHAIN"
    ) {
      logError(`❌ SSL certificate error: ${err.message}`);
      logError(
        `💡 Tip: If you're using a self-signed certificate, set IMMICH_SSL_VERIFY=false in your .env file`
      );
      logError(
        `⚠️  WARNING: Disabling SSL verification is insecure and should only be used for development/testing!`
      );
    } else if (err.message.includes("fetch") || err.message.includes("JSON")) {
      logError(`❌ Network/Parse error: ${err.message}`);
      if (err.message.includes("JSON")) {
        logError(
          `💡 This might indicate the server returned HTML instead of JSON. Check your IMMICH_BASE_URL.`
        );
      }
    } else {
      logError(`❌ Health check failed: ${err.message}`);
    }
    return false;
  }
}
