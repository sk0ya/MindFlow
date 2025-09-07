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
  NodeId,
  MapId,
  FileId,
  UserId,
  MindMapNode,
  MindMapData,
  MindMapSettings,
  FileAttachment,
  NodeLink,
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

// Export branded type utilities
export {
  createNodeId,
  createMapId,
  createFileId,
  createUserId,
  isNodeId,
  isMapId,
  isFileId,
  isUserId
} from './core';

// Constants and configuration
export {
  FILE_CONSTANTS,
  LAYOUT_CONSTANTS,
  TYPOGRAPHY_CONSTANTS,
  DEFAULT_VALUES,
  STORAGE_CONSTANTS,
  VALIDATION_CONSTANTS,
  API_CONSTANTS,
  KEYBOARD_SHORTCUTS,
  PERFORMANCE_CONSTANTS,
  ERROR_CONSTANTS,
  UI_CONSTANTS
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
export const isValidMindMapNode = (obj: unknown): obj is MindMapNode => {
  if (!obj || typeof obj !== 'object') return false;
  const node = obj as Record<string, unknown>;
  return (
    typeof node.id === 'string' &&
    typeof node.text === 'string' &&
    typeof node.x === 'number' &&
    typeof node.y === 'number' &&
    Array.isArray(node.children)
  );
};

export const isValidMindMapData = (obj: unknown): obj is MindMapData => {
  if (!obj || typeof obj !== 'object') return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.id === 'string' &&
    typeof data.title === 'string' &&
    isValidMindMapNode(data.rootNode) &&
    typeof data.createdAt === 'string' &&
    typeof data.updatedAt === 'string' &&
    data.settings !== null &&
    typeof data.settings === 'object' &&
    typeof (data.settings as Record<string, unknown>).autoSave === 'boolean' &&
    typeof (data.settings as Record<string, unknown>).autoLayout === 'boolean'
  );
};

export const isValidFileAttachment = (obj: unknown): obj is FileAttachment => {
  if (!obj || typeof obj !== 'object') return false;
  const file = obj as Record<string, unknown>;
  return (
    typeof file.id === 'string' &&
    typeof file.name === 'string' &&
    typeof file.type === 'string' &&
    typeof file.size === 'number' &&
    typeof file.isImage === 'boolean'
  );
};

export const isValidAuthUser = (obj: unknown): obj is AuthUser => {
  if (!obj || typeof obj !== 'object') return false;
  const user = obj as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string'
  );
};