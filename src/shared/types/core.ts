/**
 * Core type definitions shared across Local and Cloud modes
 * This file contains the unified type system for MindFlow application
 */

// Branded types for enhanced type safety
export type NodeId = string & { readonly __brand: 'NodeId' };
export type MapId = string & { readonly __brand: 'MapId' };
export type FileId = string & { readonly __brand: 'FileId' };
export type UserId = string & { readonly __brand: 'UserId' };

// Type guards and factory functions for branded types
export const createNodeId = (id: string): NodeId => id as NodeId;
export const createMapId = (id: string): MapId => id as MapId;
export const createFileId = (id: string): FileId => id as FileId;
export const createUserId = (id: string): UserId => id as UserId;

export const isNodeId = (id: string): id is NodeId => typeof id === 'string' && id.length > 0;
export const isMapId = (id: string): id is MapId => typeof id === 'string' && id.length > 0;
export const isFileId = (id: string): id is FileId => typeof id === 'string' && id.length > 0;
export const isUserId = (id: string): id is UserId => typeof id === 'string' && id.length > 0;

// Base node interface that both modes can extend
export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children: MindMapNode[];
  
  // Optional visual properties
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  
  // Functional properties  
  collapsed?: boolean;
  attachments?: FileAttachment[];
  links?: NodeLink[];
  
  // Image display properties
  customImageWidth?: number;
  customImageHeight?: number;
  
  // Markdown note for each node
  note?: string;
}

// Main mindmap data structure
export interface MindMapData {
  id: string;
  title: string;
  rootNode: MindMapNode;
  category?: string;
  theme?: string;
  createdAt: string;
  updatedAt: string;
  settings: MindMapSettings;
}

// Settings configuration
export interface MindMapSettings {
  autoSave: boolean;
  autoLayout: boolean;
  snapToGrid?: boolean;
  showGrid?: boolean;
  animationEnabled?: boolean;
}

// File attachment interface with support for both local and cloud storage
export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  isImage: boolean;
  createdAt: string;
  
  // Data storage (for local mode)
  data?: string; // Base64 encoded data
  dataURL?: string; // For backward compatibility
  
  // Cloud storage (for cloud mode)
  downloadUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  r2FileId?: string;
  isR2Storage?: boolean;
  
  // Common optimization fields
  isOptimized?: boolean;
  originalSize?: number;
  optimizedSize?: number;
  compressionRatio?: string;
  optimizedType?: string;
  thumbnail?: string;
  nodeId?: string;
}

// Node link interface for linking to other mindmaps or nodes
export interface NodeLink {
  id: string;
  targetMapId?: string; // ID of target mindmap
  targetNodeId?: string; // ID of target node (optional, for root if not specified)
  createdAt: string;
  updatedAt: string;
}


// Authentication types
export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  name?: string;
  avatar?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

// UI State types
export interface UIState {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  showTutorial: boolean;
  showKeyboardHelper: boolean;
  showMapList: boolean;
  showCloudStorage: boolean;
  showLayoutPanel: boolean;
  zoom: number;
  panX: number;
  panY: number;
}

// Cloud storage state
export interface CloudStorageState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
}

// Utility types
export interface Position {
  x: number;
  y: number;
}

export interface Theme {
  name: string;
  background: string;
  connectionColor: string;
  textColor: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface StorageStats {
  used: number;
  total: number;
  percentage: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  nodeCount: number;
  memoryUsage?: number;
}

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
}

export interface LayoutAlgorithm {
  name: string;
  id: string;
  description: string;
}

// Enum-like types
export type StorageMode = 'local' | 'cloud';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// Event types for consistency
export interface NodeEvent {
  nodeId: string;
  action: 'select' | 'edit' | 'create' | 'delete' | 'move';
  data?: unknown;
}

export interface MapEvent {
  mapId: string;
  action: 'create' | 'delete' | 'rename' | 'switch';
  data?: unknown;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
  timestamp: string;
}

// Hook return types for consistency
export interface MindMapHookReturn {
  data: MindMapData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSelectedNodeId: (id: string | null) => void;
  setEditingNodeId: (id: string | null) => void;
  setEditText: (text: string) => void;
  findNode: (id: string) => MindMapNode | null;
  updateNode: (id: string, updates: Partial<MindMapNode>) => void;
  addChildNode: (parentId: string, text?: string, autoEdit?: boolean) => void;
  deleteNode: (id: string) => void;
  startEdit: (nodeId: string) => void;
  finishEdit: (nodeId?: string, text?: string) => void;
  updateTitle: (title: string) => void;
}

export interface AuthHookReturn {
  authState: AuthState;
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAuthToken: () => string | null;
  getAuthHeaders: () => { [key: string]: string };
}