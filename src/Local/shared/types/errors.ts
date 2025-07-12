// Custom error types for better error handling
export enum ErrorCode {
  // Node errors
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  NODE_INVALID_PARENT = 'NODE_INVALID_PARENT',
  NODE_CIRCULAR_REFERENCE = 'NODE_CIRCULAR_REFERENCE',
  NODE_INVALID_POSITION = 'NODE_INVALID_POSITION',
  
  // Map errors
  MAP_NOT_FOUND = 'MAP_NOT_FOUND',
  MAP_INVALID_TITLE = 'MAP_INVALID_TITLE',
  MAP_STORAGE_FULL = 'MAP_STORAGE_FULL',
  
  // File errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_INVALID_TYPE = 'FILE_INVALID_TYPE',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  
  // Storage errors
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_ACCESS_DENIED = 'STORAGE_ACCESS_DENIED',
  STORAGE_CORRUPTED = 'STORAGE_CORRUPTED',
  
  // Validation errors
  VALIDATION_REQUIRED = 'VALIDATION_REQUIRED',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_TOO_LONG = 'VALIDATION_TOO_LONG',
  VALIDATION_TOO_SHORT = 'VALIDATION_TOO_SHORT',
  
  // Network errors
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_SERVER_ERROR = 'NETWORK_SERVER_ERROR',
  
  // Unknown error
  UNKNOWN = 'UNKNOWN'
}

export interface MindFlowError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  stack?: string;
}

export class MindFlowBaseError extends Error implements MindFlowError {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MindFlowError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Ensure proper prototype chain
    Object.setPrototypeOf(this, MindFlowBaseError.prototype);
  }
}

// Specific error classes
export class NodeError extends MindFlowBaseError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, details);
    this.name = 'NodeError';
  }
}

export class MapError extends MindFlowBaseError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, details);
    this.name = 'MapError';
  }
}

export class FileError extends MindFlowBaseError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, details);
    this.name = 'FileError';
  }
}

export class StorageError extends MindFlowBaseError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, details);
    this.name = 'StorageError';
  }
}

export class ValidationError extends MindFlowBaseError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(code, message, details);
    this.name = 'ValidationError';
  }
}

// Error factory functions
export const createNodeError = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): NodeError => new NodeError(code, message, details);

export const createMapError = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): MapError => new MapError(code, message, details);

export const createFileError = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): FileError => new FileError(code, message, details);

export const createStorageError = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): StorageError => new StorageError(code, message, details);

export const createValidationError = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ValidationError => new ValidationError(code, message, details);

// Error handling utilities
export const isNodeError = (error: unknown): error is NodeError => {
  return error instanceof NodeError;
};

export const isMapError = (error: unknown): error is MapError => {
  return error instanceof MapError;
};

export const isFileError = (error: unknown): error is FileError => {
  return error instanceof FileError;
};

export const isStorageError = (error: unknown): error is StorageError => {
  return error instanceof StorageError;
};

export const isValidationError = (error: unknown): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isMindFlowError = (error: unknown): error is MindFlowBaseError => {
  return error instanceof MindFlowBaseError;
};