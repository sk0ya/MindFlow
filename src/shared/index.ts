/**
 * Shared module index
 * Central export point for all shared functionality
 */

// Export core types only to avoid conflicts
export type {
  MindMapNode,
  MindMapData,
  MindMapSettings,
  FileAttachment,
  NodeMapLink,
  AuthUser,
  AuthState,
  UIState,
  Position,
  MindMapHookReturn,
  AuthHookReturn
} from './types';

// Export constants
export {
  FILE_CONSTANTS,
  LAYOUT_CONSTANTS,
  TYPOGRAPHY_CONSTANTS,
  COLOR_CONSTANTS,
  DEFAULT_VALUES,
  STORAGE_CONSTANTS,
  VALIDATION_CONSTANTS
} from './types';

// Export shared components
export * from './components';

// Export shared utilities (selective to avoid conflicts)
export { logger } from './utils/logger';

// Export shared hooks
export * from './hooks';