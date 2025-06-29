/**
 * Unified type system index for MindFlow application
 * Exports all type definitions for consistent usage across Local and Cloud modes
 */

// Import core types for type guards
import type {
  MindMapNode,
  MindMapData,
  FileAttachment,
  AuthUser
} from './core';

// Core type definitions
export type {
  MindMapNode,
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
} from './core';

// Constants and configuration
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
} from './constants';

// Legacy compatibility exports (to be phased out)
export type {
  MindMapNode as Node // Cloud mode compatibility
} from './core';

// Utility type helpers
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type WithTimestamps<T> = T & {
  createdAt: string;
  updatedAt: string;
};

// Type guards for runtime type checking
export const isValidMindMapNode = (obj: any): obj is MindMapNode => {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    Array.isArray(obj.children)
  );
};

export const isValidMindMapData = (obj: any): obj is MindMapData => {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    isValidMindMapNode(obj.rootNode) &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    obj.settings &&
    typeof obj.settings.autoSave === 'boolean' &&
    typeof obj.settings.autoLayout === 'boolean'
  );
};

export const isValidFileAttachment = (obj: any): obj is FileAttachment => {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.size === 'number' &&
    typeof obj.isImage === 'boolean'
  );
};

export const isValidAuthUser = (obj: any): obj is AuthUser => {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.email === 'string'
  );
};