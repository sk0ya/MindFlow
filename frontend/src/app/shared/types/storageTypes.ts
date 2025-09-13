import type { MindMapData } from '@shared/types';

// Storage operation results
export interface StorageResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// File upload result
export interface FileUploadResult {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  attachmentType: 'image' | 'file';
  downloadUrl?: string;
  storagePath?: string;
  uploadedAt: string;
}

// Map persistence operations
export interface MapPersistenceOperations {
  // Map CRUD
  loadInitialData: () => Promise<void>;
  saveData: (data: MindMapData) => Promise<void>;
  
  // Map list management
  refreshMapList: () => Promise<void>;
  addMapToList: (mapData: MindMapData) => Promise<void>;
  updateMapInList: (mapData: MindMapData) => Promise<void>;
  removeMapFromList: (mapId: string) => Promise<void>;
  
  // File operations
  uploadFile?: (mapId: string, nodeId: string, file: File) => Promise<FileUploadResult>;
  downloadFile?: (mapId: string, nodeId: string, fileId: string) => Promise<Blob>;
  deleteFile?: (mapId: string, nodeId: string, fileId: string) => Promise<void>;
}

// Storage configuration
export interface StorageConfiguration {
  mode: 'local' | 'cloud';
  authAdapter?: any;
  settings?: {
    autoSave?: boolean;
    syncInterval?: number;
    retryAttempts?: number;
  };
}

// Sync status
export interface SyncStatus {
  isOnline: boolean;
  lastSync?: Date;
  pendingOperations: number;
  isSyncing: boolean;
  error?: string;
}

// Storage state
export interface StorageState {
  isInitialized: boolean;
  allMindMaps: MindMapData[];
  syncStatus: SyncStatus;
  configuration: StorageConfiguration;
}