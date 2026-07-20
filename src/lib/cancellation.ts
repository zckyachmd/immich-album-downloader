import { CancellationError } from "@/lib/errors";

class CancellationToken {
  cancelled: boolean;
  reason: string | null;
  listeners: Array<(reason: string) => void>;

  constructor() {
    this.cancelled = false;
    this.reason = null;
    this.listeners = [];
  }

  isCancelled() {
    return this.cancelled;
  }

  cancel(reason = "User requested cancellation") {
    if (!this.cancelled) {
      this.cancelled = true;
      this.reason = reason;
      this.listeners.forEach((listener) => listener(reason));
    }
  }

  throwIfCancelled() {
    if (this.cancelled) {
      throw new CancellationError(this.reason || "Operation was cancelled");
    }
  }

  onCancel(listener: (reason: string) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const cancellationToken = new CancellationToken();

export function setupSignalHandlers() {
  const gracefulShutdown = (signal: string) => {
    if (cancellationToken.isCancelled()) {
      console.log("\n\n⚠️  Force exit requested. Cleaning up...");

      // Guarantee an exit even if closeDatabase() hangs.
      const forceExitTimer = setTimeout(() => process.exit(1), 1500);
      forceExitTimer.unref?.();

      import("./db")
        .then(({ closeDatabase }) => {
          try {
            closeDatabase();
          } catch (err) {}
        })
        .catch(() => {})
        .finally(() => process.exit(1));

      return;
    }

    console.log(`\n\n⚠️  ${signal} received. Gracefully shutting down...`);
    console.log("💡 Finishing current downloads, please wait...");
    cancellationToken.cancel(`Interrupted by ${signal}`);
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("uncaughtException", (err) => {
    if (err.name === "CancellationError") return;
    console.error("\n💥 Uncaught exception:", err);
    cancellationToken.cancel("Uncaught exception");
  });
}
