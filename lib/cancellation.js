/**
 * Cancellation token for graceful shutdown
 * Allows safe interruption of download process
 */
class CancellationToken {
  constructor() {
    this.cancelled = false;
    this.reason = null;
    this.listeners = [];
  }

  /**
   * Check if cancellation was requested
   * @returns {boolean} True if cancelled
   */
  isCancelled() {
    return this.cancelled;
  }

  /**
   * Request cancellation
   * @param {string} reason - Reason for cancellation
   */
  cancel(reason = "User requested cancellation") {
    if (!this.cancelled) {
      this.cancelled = true;
      this.reason = reason;
      this.listeners.forEach((listener) => listener(reason));
    }
  }

  /**
   * Throw error if cancelled
   * @throws {Error} If cancelled
   */
  throwIfCancelled() {
    if (this.cancelled) {
      const error = new Error(this.reason || "Operation was cancelled");
      error.name = "CancellationError";
      throw error;
    }
  }

  /**
   * Register a listener for cancellation events
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  onCancel(listener) {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

// Global cancellation token instance
export const cancellationToken = new CancellationToken();

/**
 * Setup signal handlers for graceful shutdown
 */
export function setupSignalHandlers() {
  const gracefulShutdown = (signal) => {
    if (cancellationToken.isCancelled()) {
      // Second interrupt - force exit
      console.log("\n\n⚠️  Force exit requested. Cleaning up...");

      // Close database before exit (async, but we'll exit anyway)
      import("./db.js")
        .then(({ closeDatabase }) => {
          try {
            closeDatabase();
          } catch (err) {
            // Ignore errors during forced exit
          }
        })
        .catch(() => {
          // Ignore import errors
        });

      process.exit(130);
      return;
    }

    console.log(`\n\n⚠️  ${signal} received. Gracefully shutting down...`);
    console.log("💡 Finishing current downloads, please wait...");
    cancellationToken.cancel(`Interrupted by ${signal}`);
  };

  // Handle SIGINT (Ctrl+C)
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle SIGTERM (kill command)
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    if (err.name === "CancellationError") {
      // Expected cancellation, don't treat as error
      return;
    }
    console.error("\n💥 Uncaught exception:", err);
    cancellationToken.cancel("Uncaught exception");
  });
}
