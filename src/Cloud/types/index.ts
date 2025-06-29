/**
 * Cloud mode types - now using shared type system
 * This file re-exports shared types for Cloud mode usage
 */

// Import all types from shared system
export type {
  MindMapNode as Node, // Cloud mode compatibility
  MindMapNode, // Also provide the standard name
  MindMapData,
  MindMapSettings,
  FileAttachment,
  NodeMapLink,
  AuthUser,
  AuthState,
  UIState,
  CloudStorageState,
  Position,
  Theme,
  ValidationResult,
  StorageStats,
  PerformanceMetrics,
  KeyboardShortcut,
  LayoutAlgorithm,
  StorageMode,
  SyncStatus,
  ConnectionStatus,
  NodeEvent,
  MapEvent,
  AppError,
  MindMapHookReturn,
  AuthHookReturn
} from '../../shared/types';

// Re-export constants for convenience
export {
  FILE_CONSTANTS,
  LAYOUT_CONSTANTS,
  TYPOGRAPHY_CONSTANTS,
  COLOR_CONSTANTS,
  DEFAULT_VALUES,
  STORAGE_CONSTANTS,
  VALIDATION_CONSTANTS,
  API_CONSTANTS,
  KEYBOARD_SHORTCUTS,
  THEME_CONSTANTS,
  PERFORMANCE_CONSTANTS
} from '../../shared/types';

// Re-export type guards
export {
  isValidMindMapNode,
  isValidMindMapData,
  isValidFileAttachment,
  isValidAuthUser
} from '../../shared/types';