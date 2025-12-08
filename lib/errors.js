/**
 * Custom error classes for standardized error handling
 */

/**
 * Base error class for application-specific errors
 */
export class AppError extends Error {
  constructor(message, code = "APP_ERROR", statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration error - invalid or missing configuration
 */
export class ConfigurationError extends AppError {
  constructor(message) {
    super(message, "CONFIG_ERROR", 500);
  }
}

/**
 * Validation error - invalid input or parameters
 */
export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, "VALIDATION_ERROR", 400);
    this.field = field;
  }
}

/**
 * API error - errors from Immich API
 */
export class APIError extends AppError {
  constructor(message, statusCode = 500, endpoint = null) {
    super(message, "API_ERROR", statusCode);
    this.endpoint = endpoint;
  }
}

/**
 * Network error - connection issues
 */
export class NetworkError extends AppError {
  constructor(message, originalError = null) {
    super(message, "NETWORK_ERROR", 503);
    this.originalError = originalError;
  }
}

/**
 * File system error - file operations failed
 */
export class FileSystemError extends AppError {
  constructor(message, path = null) {
    super(message, "FILE_SYSTEM_ERROR", 500);
    this.path = path;
  }
}

/**
 * Path traversal error - security violation
 */
export class PathTraversalError extends AppError {
  constructor(message, path = null) {
    super(message, "PATH_TRAVERSAL_ERROR", 400);
    this.path = path;
  }
}

/**
 * Database error - database operations failed
 */
export class DatabaseError extends AppError {
  constructor(message, operation = null) {
    super(message, "DATABASE_ERROR", 500);
    this.operation = operation;
  }
}
