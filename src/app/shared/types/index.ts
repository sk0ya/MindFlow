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
  ValidationResult,
  StorageStats,
  PerformanceMetrics,
  KeyboardShortcut,
  LayoutAlgorithm,
  NodeEvent,
  MapEvent,
  AppError,
  MindMapHookReturn,
} from '@shared/types';

// Import local types
export type {
  Position,
  Theme,
  MindMapHookDependency,
  FileHandlersDependency,
  MapHandlersDependency,
  UIStateDependency,
  ImageFile,
} from './dataTypes';

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
} from '@shared/types';

// Re-export type guards
export {
  isValidMindMapNode,
  isValidMindMapData,
  isValidFileAttachment,
} from '@shared/types';

// Export new type safety modules
export type { NodeId, MapId, FileId } from './brandedTypes';
export { isNodeId, isMapId, isFileId, createNodeId, createMapId, createFileId } from './brandedTypes';

export type { Result } from './result';
export { Success, Failure, isSuccess, isFailure, map, flatMap, match, collect, tryCatch, tryCatchAsync } from './result';

export type { MindFlowError } from './errors';
export { 
  ErrorCode, 
  MindFlowBaseError, 
  NodeError, 
  MapError, 
  FileError, 
  StorageError, 
  ValidationError,
  createNodeError,
  createMapError,
  createFileError,
  createStorageError,
  createValidationError,
  isNodeError,
  isMapError,
  isFileError,
  isStorageError,
  isValidationError,
  isMindFlowError
} from './errors';