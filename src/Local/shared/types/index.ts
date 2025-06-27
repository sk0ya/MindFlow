export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children: MindMapNode[];
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  borderStyle?: string;
  borderWidth?: string;
  collapsed?: boolean;
  attachments?: FileAttachment[];
  mapLinks?: MapLink[];
  color?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 encoded
  dataURL?: string; // For backward compatibility
  thumbnail?: string;
  optimized?: boolean;
  originalSize?: number;
  isImage?: boolean;
}

export interface MapLink {
  id: string;
  targetMapId: string;
  targetNodeId?: string;
  title: string;
}

export interface MindMapData {
  id: string;
  title: string;
  rootNode: MindMapNode;
  settings: {
    autoSave: boolean;
    autoLayout: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
  category?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface CloudStorageState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
}

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

export interface LayoutAlgorithm {
  name: string;
  id: string;
  description: string;
}

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
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

export type StorageMode = 'local' | 'cloud';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';