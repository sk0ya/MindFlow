// Storage abstraction types for dual Local/Cloud architecture
import type { MindMapData } from '@shared/types';
import type { AuthAdapter } from '../auth/types';
import type { FileInfo } from '../cloud/api';

/**
 * 統一ストレージインターフェース
 * Local/Cloudモードで共通の操作を提供
 */
export interface StorageAdapter {
  // 初期化状態
  readonly isInitialized: boolean;
  
  // 基本操作
  loadInitialData(): Promise<MindMapData>;
  saveData(data: MindMapData): Promise<void>;
  
  // マップ管理
  loadAllMaps(): Promise<MindMapData[]>;
  saveAllMaps(maps: MindMapData[]): Promise<void>;
  addMapToList(map: MindMapData): Promise<void>;
  removeMapFromList(mapId: string): Promise<void>;
  updateMapInList(map: MindMapData): Promise<void>;
  
  // ファイル操作（オプショナル - クラウドモードのみ）
  uploadFile?(mindmapId: string, nodeId: string, file: File): Promise<FileInfo>;
  deleteFile?(mindmapId: string, nodeId: string, fileId: string): Promise<void>;
  getFileInfo?(mindmapId: string, nodeId: string, fileId: string): Promise<FileInfo>;
  downloadFile?(mindmapId: string, nodeId: string, fileId: string): Promise<Blob>;
  
  // ライフサイクル
  initialize(): Promise<void>;
  cleanup(): void;
}


/**
 * ストレージ設定
 */
export interface StorageConfig {
  mode: StorageMode;
  authAdapter?: AuthAdapter;
  autoSave?: boolean;
  syncInterval?: number;
  retryAttempts?: number;
  enableOfflineMode?: boolean;
}

/**
 * ストレージモード
 */
export type StorageMode = 'local' | 'cloud';

/**
 * 同期状態
 */
export interface SyncStatus {
  lastSync: Date | null;
  isSyncing: boolean;
  hasUnsyncedChanges: boolean;
  lastError: Error | null;
}

/**
 * ストレージイベント
 */
export interface StorageEvents {
  'sync:start': () => void;
  'sync:complete': (status: SyncStatus) => void;
  'sync:error': (error: Error) => void;
  'data:change': (data: MindMapData) => void;
}

/**
 * ストレージアダプターファクトリー
 */
export interface StorageAdapterFactory {
  create(config: StorageConfig): Promise<StorageAdapter>;
  isSupported(mode: StorageMode): boolean;
}