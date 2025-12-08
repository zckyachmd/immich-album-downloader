import { describe, test, expect } from "@jest/globals";
import {
  AppError,
  ConfigurationError,
  ValidationError,
  APIError,
  NetworkError,
  PathTraversalError,
  FileSystemError,
  DatabaseError,
} from "../errors.js";

describe("Custom Errors", () => {
  test("AppError should have correct properties", () => {
    const error = new AppError("Test message", "TEST_CODE", 400);
    expect(error.message).toBe("Test message");
    expect(error.code).toBe("TEST_CODE");
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe("AppError");
  });

  test("AppError should use default values", () => {
    const error = new AppError("Test message");
    expect(error.code).toBe("APP_ERROR");
    expect(error.statusCode).toBe(500);
  });

  test("ConfigurationError should have correct defaults", () => {
    const error = new ConfigurationError("Config error");
    expect(error.message).toBe("Config error");
    expect(error.code).toBe("CONFIG_ERROR");
    expect(error.statusCode).toBe(500);
  });

  test("ValidationError should include field", () => {
    const error = new ValidationError("Invalid input", "username");
    expect(error.message).toBe("Invalid input");
    expect(error.field).toBe("username");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
  });

  test("ValidationError should work without field", () => {
    const error = new ValidationError("Invalid input");
    expect(error.field).toBeNull();
  });

  test("APIError should include endpoint", () => {
    const error = new APIError("API failed", 404, "/api/test");
    expect(error.message).toBe("API failed");
    expect(error.statusCode).toBe(404);
    expect(error.endpoint).toBe("/api/test");
  });

  test("APIError should work without endpoint", () => {
    const error = new APIError("API failed", 500);
    expect(error.endpoint).toBeNull();
  });

  test("NetworkError should include original error", () => {
    const originalError = new Error("Network timeout");
    const error = new NetworkError("Connection failed", originalError);
    expect(error.message).toBe("Connection failed");
    expect(error.originalError).toBe(originalError);
    expect(error.statusCode).toBe(503);
  });

  test("NetworkError should work without original error", () => {
    const error = new NetworkError("Connection failed");
    expect(error.originalError).toBeNull();
  });

  test("PathTraversalError should include path", () => {
    const error = new PathTraversalError("Path traversal detected", "/etc/passwd");
    expect(error.message).toBe("Path traversal detected");
    expect(error.path).toBe("/etc/passwd");
    expect(error.code).toBe("PATH_TRAVERSAL_ERROR");
    expect(error.statusCode).toBe(400);
  });

  test("PathTraversalError should work without path", () => {
    const error = new PathTraversalError("Path traversal detected");
    expect(error.path).toBeNull();
  });

  test("FileSystemError should include path", () => {
    const error = new FileSystemError("File operation failed", "/path/to/file");
    expect(error.message).toBe("File operation failed");
    expect(error.path).toBe("/path/to/file");
    expect(error.code).toBe("FILE_SYSTEM_ERROR");
    expect(error.statusCode).toBe(500);
  });

  test("FileSystemError should work without path", () => {
    const error = new FileSystemError("File operation failed");
    expect(error.path).toBeNull();
  });

  test("DatabaseError should include operation", () => {
    const error = new DatabaseError("Database operation failed", "query");
    expect(error.message).toBe("Database operation failed");
    expect(error.operation).toBe("query");
    expect(error.code).toBe("DATABASE_ERROR");
    expect(error.statusCode).toBe(500);
  });

  test("DatabaseError should work without operation", () => {
    const error = new DatabaseError("Database operation failed");
    expect(error.operation).toBeNull();
  });
});
