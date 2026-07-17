export class AppError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code = "APP_ERROR", statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR", 500);
  }
}

export class ValidationError extends AppError {
  field: string | null;

  constructor(message: string, field: string | null = null) {
    super(message, "VALIDATION_ERROR", 400);
    this.field = field;
  }
}

export class APIError extends AppError {
  endpoint: string | null;

  constructor(message: string, statusCode = 500, endpoint: string | null = null) {
    super(message, "API_ERROR", statusCode);
    this.endpoint = endpoint;
  }
}

export class NetworkError extends AppError {
  originalError: unknown;

  constructor(message: string, originalError: unknown = null) {
    super(message, "NETWORK_ERROR", 503);
    this.originalError = originalError;
  }
}

export class FileSystemError extends AppError {
  path: string | null;

  constructor(message: string, path: string | null = null) {
    super(message, "FILE_SYSTEM_ERROR", 500);
    this.path = path;
  }
}

export class PathTraversalError extends AppError {
  path: string | null;

  constructor(message: string, path: string | null = null) {
    super(message, "PATH_TRAVERSAL_ERROR", 400);
    this.path = path;
  }
}

export class DatabaseError extends AppError {
  operation: string | null;

  constructor(message: string, operation: string | null = null) {
    super(message, "DATABASE_ERROR", 500);
    this.operation = operation;
  }
}
