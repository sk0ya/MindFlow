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

// Node utilities (safe additions)
export {
  findNode,
  findParentNode,
  getAllDescendants,
  countNodes,
  getNodeDepth,
  wouldCreateCircularReference,
  calculateDistance,
  wouldNodesCollide,
  createNewNode,
  cloneNode,
  validateNodeText,
  calculateOptimalFontSize,
  getSiblings,
  getNodeIndex
} from './nodeUtils';

// Enhanced error handling and safety utilities
export {
  type Result,
  safeOperation,
  safeAsyncOperation,
  logError,
  validateInput,
  debounce,
  throttle,
  safeLocalStorage,
  performanceUtils
} from './errorUtils';