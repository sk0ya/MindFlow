/**
 * Local mode types - now using shared type system
 * This file re-exports shared types for backward compatibility
 */

// Import all types from shared system
export type {
  MindMapNode,
  MindMapData,
  MindMapSettings,
  FileAttachment,
  NodeMapLink as MapLink, // Backward compatibility alias
  UIState,
  Position,
  Theme,
  ValidationResult,
  StorageStats,
  PerformanceMetrics,
  KeyboardShortcut,
  LayoutAlgorithm,
  NodeEvent,
  MapEvent,
  AppError,
  MindMapHookReturn,
} from '../../../shared/types';

// Re-export constants for convenience
export {
  FILE_CONSTANTS,
  LAYOUT_CONSTANTS,
  TYPOGRAPHY_CONSTANTS,
  COLOR_CONSTANTS,
  DEFAULT_VALUES,
  STORAGE_CONSTANTS,
  VALIDATION_CONSTANTS,
  KEYBOARD_SHORTCUTS,
  THEME_CONSTANTS,
  PERFORMANCE_CONSTANTS
} from '../../../shared/types';

// Re-export type guards
export {
  isValidMindMapNode,
  isValidMindMapData,
  isValidFileAttachment,
} from '../../../shared/types';