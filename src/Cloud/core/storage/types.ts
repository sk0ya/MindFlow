// 完全分離ストレージエンジンの型定義

export interface MindMapData {
  id: string;
  title: string;
  rootNode: Node;
  settings?: {
    autoSave?: boolean;
    autoLayout?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 encoded - required for compatibility with shared types
  dataURL?: string; // For backward compatibility
  downloadUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  thumbnail?: string;
  r2FileId?: string;
  isR2Storage?: boolean;
  nodeId?: string;
  isImage?: boolean;
  optimized?: boolean;
  originalSize?: number;
}

export interface MapLink {
  id: string;
  targetMapId: string;
  title: string; // Required to match shared types
  targetNodeId?: string; // Add optional field from shared types for compatibility
}

export interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  fontWeight?: string;
  children?: Node[];
  attachments?: FileAttachment[];
  mapLinks?: MapLink[];
  color?: string;
  collapsed?: boolean;
  isTemporary?: boolean;
}

// 統一されたストレージ結果型
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  newId?: string;
  local?: boolean; // ローカルモード専用フラグ
}

// 同期状態
export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSync: string | null;
  mode: 'local' | 'cloud';
}

// 統一ストレージエンジンインターフェース
export interface StorageEngine {
  readonly mode: 'local' | 'cloud';
  readonly name: string;

  // マップ管理
  getAllMaps(): Promise<MindMapData[]>;
  getMap(mapId: string): Promise<MindMapData>;
  createMap(mapData: MindMapData): Promise<StorageResult<MindMapData>>;
  updateMap(mapId: string, mapData: MindMapData): Promise<StorageResult<MindMapData>>;
  deleteMap(mapId: string): Promise<StorageResult<MindMapData | null | boolean>>;

  // 現在のマップ管理
  getCurrentMap(): Promise<MindMapData | null>;
  setCurrentMap(mapData: MindMapData): Promise<StorageResult<MindMapData>>;

  // ノード操作
  addNode(mapId: string, nodeData: Node, parentId: string): Promise<StorageResult<Node>>;
  updateNode(mapId: string, nodeId: string, updates: Partial<Node>): Promise<StorageResult<Node>>;
  deleteNode(mapId: string, nodeId: string): Promise<StorageResult<boolean>>;
  moveNode(mapId: string, nodeId: string, newParentId: string): Promise<StorageResult<boolean>>;

  // インポート・エクスポート
  exportMapAsJSON(mapData: MindMapData): Promise<void>;
  importMapFromJSON(file: File): Promise<StorageResult<MindMapData>>;

  // 同期・接続
  testConnection(): Promise<boolean>;
  getSyncStatus(): SyncStatus;

  // ユーティリティ
  hasLocalData(): Promise<boolean>;
  cleanupCorruptedData(): Promise<any>;
  clearAllData(): Promise<boolean>;
}

// 旧型定義（後方互換性のため残す）
export interface UpdateResult {
  success: boolean;
  error?: string;
  newId?: string;
  finalId?: string;
}

export interface AddNodeResult extends UpdateResult {
  node?: Node;
}

export interface StorageAdapter {
  readonly name: string;
  readonly storageMode: 'local' | 'cloud';
  
  getAllMaps(): Promise<MindMapData[]>;
  getMap(mapId: string): Promise<MindMapData>;
  createMap(mapData: MindMapData): Promise<MindMapData>;
  updateMap(mapId: string, mapData: MindMapData): Promise<MindMapData>;
  deleteMap(mapId: string): Promise<boolean>;
  
  addNode?(mapId: string, nodeData: Node, parentId: string): Promise<AddNodeResult>;
  updateNode?(mapId: string, nodeId: string, updates: Partial<Node>): Promise<UpdateResult>;
  deleteNode?(mapId: string, nodeId: string): Promise<UpdateResult>;
  
  initialize?(): Promise<void>;
  isInitialized?: boolean;
}

export interface LocalStorageAdapter extends StorageAdapter {
  readonly storageMode: 'local';
}

export interface CloudStorageAdapter extends StorageAdapter {
  readonly storageMode: 'cloud';
  baseUrl: string;
  
  addNode(mapId: string, nodeData: Node, parentId: string): Promise<AddNodeResult>;
  updateNode(mapId: string, nodeId: string, updates: Partial<Node>): Promise<UpdateResult>;
  deleteNode(mapId: string, nodeId: string): Promise<UpdateResult>;
}