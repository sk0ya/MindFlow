/**
 * Shared utilities index
 * Exports utility functions for both Local and Cloud modes
 */

export {
  createAppError,
  classifyError,
  isAppError,
  safeAsync,
  withRetry,
  errorHandler,
  GlobalErrorHandler,
  ERROR_CODES,
  ERROR_SEVERITY
} from './errorHandling';

export type {
  AppError,
  ErrorHandler,
  AsyncResult
} from './errorHandling';

// Memoization utilities
export {
  deepEqual,
  shallowEqual,
  arrayEqual,
  memoComponent,
  deepMemoComponent,
  shallowMemoComponent,
  LRUCache,
  memoizeFunction,
  memoizeAsync,
  createSelector,
  createStructuredSelector
} from './memoization';

// Logging system
export { logger, LogLevel } from './logger';
export type { LogEntry, LoggerConfig } from './logger';