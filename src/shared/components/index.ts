/**
 * Shared components index
 * Exports reusable components for both Local and Cloud modes
 */

export { MindMapAppBase, useSharedKeyboardShortcuts } from './MindMapAppBase';
export type { MindMapAppBaseProps } from './MindMapAppBase';

export { MindMapCanvasBase } from './MindMapCanvasBase';
export type { MindMapCanvasBaseProps } from './MindMapCanvasBase';

export { ErrorBoundary, withErrorBoundary, useErrorHandler } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';

// Re-export types for convenience
export type {
  MindMapData,
  MindMapNode,
  AuthState,
  Position,
  MindMapHookReturn
} from '../types';