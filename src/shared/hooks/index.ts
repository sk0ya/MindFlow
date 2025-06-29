/**
 * Shared hooks index
 * Exports performance and optimization hooks
 */

// Performance monitoring
export {
  usePerformanceMonitor,
  useOperationTimer,
  globalPerformanceCollector
} from './usePerformanceMonitor';

export type {
  PerformanceMetrics,
  PerformanceWarning
} from './usePerformanceMonitor';

// Optimization hooks
export {
  useStableCallback,
  useEventHandler,
  useDebouncedCallback,
  useThrottledCallback,
  useStableObject,
  useStableArray,
  useExpensiveValue,
  useChildrenMemo,
  useOptimizedState,
  useCallbackGroup,
  useRefCallback,
  useIntersectionObserver,
  useOptimizedResize
} from './useOptimizedCallbacks';

// Optimized authentication hooks
export { AuthProvider, useAuth } from './useAuthOptimized';
export { useMagicLinkOptimized } from './useMagicLinkOptimized';