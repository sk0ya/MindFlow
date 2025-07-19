// 型定義のエクスポート

export * from './environment';
export * from './auth';
export * from './api';

// 共通ユーティリティ型
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type NonEmptyArray<T> = [T, ...T[]];

// エラー関連の型
export interface AppError extends Error {
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

export class ValidationError extends Error implements AppError {
  public readonly code = 'VALIDATION_ERROR';
  public readonly status = 400;
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class AuthenticationError extends Error implements AppError {
  public readonly code = 'AUTHENTICATION_ERROR';
  public readonly status = 401;

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements AppError {
  public readonly code = 'AUTHORIZATION_ERROR';
  public readonly status = 403;

  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error implements AppError {
  public readonly code = 'NOT_FOUND';
  public readonly status = 404;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements AppError {
  public readonly code = 'CONFLICT';
  public readonly status = 409;

  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends Error implements AppError {
  public readonly code = 'INTERNAL_SERVER_ERROR';
  public readonly status = 500;

  constructor(message: string = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
  }
}