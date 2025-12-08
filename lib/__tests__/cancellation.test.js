import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { cancellationToken } from "../cancellation.js";

describe("cancellation", () => {
  beforeEach(() => {
    // Reset cancellation token before each test
    cancellationToken.cancelled = false;
    cancellationToken.reason = null;
    cancellationToken.listeners = [];
  });

  describe("CancellationToken", () => {
    test("should initialize as not cancelled", () => {
      expect(cancellationToken.isCancelled()).toBe(false);
      expect(cancellationToken.reason).toBeNull();
    });

    test("should cancel with reason", () => {
      cancellationToken.cancel("Test cancellation");
      expect(cancellationToken.isCancelled()).toBe(true);
      expect(cancellationToken.reason).toBe("Test cancellation");
    });

    test("should cancel with default reason", () => {
      cancellationToken.cancel();
      expect(cancellationToken.isCancelled()).toBe(true);
      expect(cancellationToken.reason).toBe("User requested cancellation");
    });

    test("should not cancel twice", () => {
      cancellationToken.cancel("First");
      const firstReason = cancellationToken.reason;
      cancellationToken.cancel("Second");
      expect(cancellationToken.reason).toBe(firstReason);
    });

    test("should throw error when cancelled", () => {
      cancellationToken.cancel("Test cancellation");
      expect(() => {
        cancellationToken.throwIfCancelled();
      }).toThrow("Test cancellation");
    });

    test("should throw CancellationError when cancelled", () => {
      cancellationToken.cancel("Test cancellation");
      try {
        cancellationToken.throwIfCancelled();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.name).toBe("CancellationError");
        expect(error.message).toBe("Test cancellation");
      }
    });

    test("should throw with default message when cancelled without reason", () => {
      cancellationToken.cancel();
      try {
        cancellationToken.throwIfCancelled();
        expect(true).toBe(false);
      } catch (error) {
        expect(error.name).toBe("CancellationError");
        expect(error.message).toBe("User requested cancellation");
      }
    });

    test("should not throw when not cancelled", () => {
      expect(() => {
        cancellationToken.throwIfCancelled();
      }).not.toThrow();
    });

    test("should register and call listeners on cancel", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      cancellationToken.onCancel(listener1);
      cancellationToken.onCancel(listener2);

      cancellationToken.cancel("Test");

      expect(listener1).toHaveBeenCalledWith("Test");
      expect(listener2).toHaveBeenCalledWith("Test");
    });

    test("should allow unsubscribing from listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 = cancellationToken.onCancel(listener1);
      cancellationToken.onCancel(listener2);

      unsubscribe1();
      cancellationToken.cancel("Test");

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith("Test");
    });

    test("should handle multiple unsubscribe calls", () => {
      const listener = jest.fn();
      const unsubscribe = cancellationToken.onCancel(listener);

      unsubscribe();
      unsubscribe(); // Call again, should not error

      cancellationToken.cancel("Test");
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
