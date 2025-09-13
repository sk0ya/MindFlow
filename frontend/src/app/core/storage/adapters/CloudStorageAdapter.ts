// Cloud storage adapter - integrates cloud storage with Local architecture
import type { MindMapData } from '../../../../shared/types';
import type { StorageAdapter } from '../types';
import type { AuthAdapter } from '../../auth/types';
import { createInitialData } from '../../../shared/types/dataTypes';
import {
  initCloudIndexedDB,
  saveMindMapToCloudIndexedDB,
  getAllMindMapsFromCloudIndexedDB,
  removeMindMapFromCloudIndexedDB,
  getUserMapsFromCloudIndexedDB,
  type CloudCachedMindMap
} from '../../utils/cloudIndexedDB';
import { logger } from '../../../shared/utils/logger';
import { STORAGE_KEYS, getLocalStorage, setLocalStorage } from '../../../shared/utils/localStorage';
import { createCloudflareAPIClient, cleanEmptyNodesFromData, type CloudflareAPI, type FileInfo } from '../../cloud/api';
import { SyncStatusService } from '../../services/SyncStatusService';
import { EditingStateService } from '../../services/EditingStateService';

// Cloud-specific helper functions using separate cloud IndexedDB
const saveToCloudIndexedDB = async (data: MindMapData, userId: string): Promise<void> => {
  const cloudData: CloudCachedMindMap = {
    ...data,
    _metadata: {
      lastSync: new Date().toISOString(),
      version: 1,
      isDirty: false,
      userId
    }
  };
  return saveMindMapToCloudIndexedDB(cloudData);
};

const getAllFromCloudIndexedDB = async (userId: string): Promise<CloudCachedMindMap[]> => {
  // ユーザー専用のマップのみを取得
  return getUserMapsFromCloudIndexedDB(userId);
};

const markAsCloudSynced = async (id: string): Promise<void> => {
  // Cloud-specific sync marking implementation
  logger.debug('📋 Marked as synced:', id);
};

const getCloudDirtyData = async (userId: string): Promise<CloudCachedMindMap[]> => {
  const allMaps = await getAllMindMapsFromCloudIndexedDB();
  return allMaps.filter(map => 
    map._metadata.userId === userId && map._metadata.isDirty
  );
};

const deleteFromCloudIndexedDB = async (id: string): Promise<void> => {
  return removeMindMapFromCloudIndexedDB(id);
};

function isMindMapData(data: unknown): data is MindMapData {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  
  if (typeof obj.id !== 'string' ||
      typeof obj.title !== 'string' ||
      typeof obj.version !== 'number' ||
      !obj.rootNode ||
      typeof obj.rootNode !== 'object') {
    return false;
  }
  
  const rootNode = obj.rootNode as Record<string, unknown>;
  return typeof rootNode.id === 'string';
}

function validateAndCleanData(data: unknown): MindMapData | null {
  if (!isMindMapData(data)) return null;
  return cleanEmptyNodesFromData(data);
}

/**
 * クラウドストレージアダプター
 * IndexedDB + Cloudflare Workers APIのハイブリッド永続化
 */
export class CloudStorageAdapter implements StorageAdapter {
  private _isInitialized = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private apiClient: CloudflareAPI;
  private abortController: AbortController | null = null;
  private syncStatusService = SyncStatusService.getInstance();
  private editingStateService = EditingStateService.getInstance();
  private lastKnownServerVersion: Map<string, string> = new Map();

  constructor(private authAdapter: AuthAdapter) {
    this.apiClient = createCloudflareAPIClient(() => this.authAdapter.getAuthHeaders());
  }

  get isInitialized(): boolean {
    return this._isInitialized && this.authAdapter.isInitialized;
  }

  /**
   * IndexedDBとクラウド接続を初期化
   */
  async initialize(): Promise<void> {
    try {
      // Create abort controller for initialization
      this.abortController = new AbortController();
      
      // 認証の初期化を待つ
      if (!this.authAdapter.isInitialized) {
        await new Promise<void>((resolve, reject) => {
          const checkAuth = () => {
            if (this.abortController?.signal.aborted) {
              reject(new Error('Initialization aborted'));
              return;
            }
            
            if (this.authAdapter.isInitialized) {
              resolve();
            } else {
              setTimeout(checkAuth, 100);
            }
          };
          checkAuth();
        });
      }

      // Cloud IndexedDBを初期化
      await initCloudIndexedDB();
      
      // 起動時に期限切れキャッシュをクリーンアップ
      await this.performStartupCleanup();
      
      this._isInitialized = true;
      
      // バックグラウンド同期を開始
      this.startBackgroundSync();
      
      logger.info('✅ CloudStorageAdapter: Initialized with auth and API');
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 初期データを読み込み（IndexedDB -> API）
   */
  async loadInitialData(): Promise<MindMapData> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.authAdapter.isAuthenticated) {
      logger.debug('🔑 CloudStorageAdapter: User not authenticated, returning initial data');
      return createInitialData();
    }

    try {
      // 1. まずIndexedDBからローカルキャッシュを確認
      const localData = await this.getLocalData();
      
      // 2. APIからサーバーデータを取得
      let serverData: MindMapData | null = null;
      try {
        const serverMaps = await this.apiClient.getMindMaps();
        if (serverMaps.length > 0) {
          serverData = cleanEmptyNodesFromData(serverMaps[0]);
        }
      } catch (apiError) {
        logger.warn('⚠️ CloudStorageAdapter: API fetch failed, using local data:', apiError);
      }
      
      // 3. サーバーデータがある場合はそれを使用、なければローカルデータ
      if (serverData) {
        logger.info('📋 CloudStorageAdapter: Loaded server data:', serverData.title);
        return serverData;
      } else if (localData) {
        logger.info('📋 CloudStorageAdapter: Using local cached data:', localData.title);
        return localData;
      }

      // データがない場合はデフォルトデータを作成
      const initialData = createInitialData();
      logger.info('🆕 CloudStorageAdapter: Created initial data:', initialData.title);
      
      // 初期データは新規作成なので直接作成APIを呼び出し
      this.createInitialDataAsync(initialData);
      await this.saveToLocal(initialData);
      
      return initialData;
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Failed to load initial data:', error);
      
      // エラー時はローカルデータまたはデフォルトデータを返す
      const localData = await this.getLocalData();
      if (localData) {
        return localData;
      }
      
      return createInitialData();
    }
  }

  /**
   * データを保存（ローカル優先、バックグラウンドでクラウド同期）
   */
  async saveData(data: MindMapData): Promise<void> {
    if (!this._isInitialized) {
      logger.warn('CloudStorageAdapter: Not initialized, skipping save');
      return;
    }

    try {
      // 認証されている場合のみ保存
      if (!this.authAdapter.isAuthenticated) {
        logger.warn('CloudStorageAdapter: User not authenticated, skipping save');
        return;
      }

      // 1. まずローカルに保存（即座の応答性）
      await this.saveToLocal(data);
      logger.debug('💾 CloudStorageAdapter: Data saved locally:', data.title);

      // 2. APIにも保存（非同期）
      this.saveToAPIAsync(data).catch(error => {
        logger.warn('⚠️ CloudStorageAdapter: Background API save failed:', error);
      });
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Failed to save data:', error);
      throw error;
    }
  }

  /**
   * 全マップを読み込み
   */
  async loadAllMaps(): Promise<MindMapData[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.authAdapter.isAuthenticated) {
      return [];
    }

    try {
      // APIから全マップを取得
      const serverMaps = await this.apiClient.getMindMaps();
      if (serverMaps.length > 0) {
        const cleanedMaps = serverMaps.map(map => cleanEmptyNodesFromData(map));
        logger.info(`📋 CloudStorageAdapter: Loaded ${cleanedMaps.length} maps from API`);
        
        // Note: ローカルキャッシュの更新は明示的な保存時のみ行う（読み込み時は不要）
        
        return cleanedMaps;
      }

      // サーバーにデータがない場合はローカルキャッシュを確認
      const localMaps = await this.getAllLocalMaps();
      logger.info(`📋 CloudStorageAdapter: Loaded ${localMaps.length} maps from local cache`);
      return localMaps;
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Failed to load maps:', error);
      
      // エラー時はローカルキャッシュを返す
      return this.getAllLocalMaps();
    }
  }

  /**
   * 全マップを保存
   */
  async saveAllMaps(maps: MindMapData[]): Promise<void> {
    if (!this._isInitialized) {
      logger.warn('CloudStorageAdapter: Not initialized, skipping save all maps');
      return;
    }

    try {
      // 各マップを個別に保存
      await Promise.all(maps.map(map => this.saveData(map)));
      logger.info(`💾 CloudStorageAdapter: Saved ${maps.length} maps`);
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Failed to save maps:', error);
      throw error;
    }
  }

  /**
   * マップをリストに追加
   */
  async addMapToList(map: MindMapData): Promise<void> {
    if (!this._isInitialized) {
      logger.warn('CloudStorageAdapter: Not initialized, skipping add map to list');
      return;
    }

    try {
      // 認証されている場合のみ保存
      if (!this.authAdapter.isAuthenticated) {
        logger.warn('CloudStorageAdapter: User not authenticated, skipping add map to list');
        return;
      }

      // 1. まずローカルに保存（即座の応答性）
      await this.saveToLocal(map);
      logger.debug('💾 CloudStorageAdapter: New map saved locally:', map.title);

      // 2. 新規マップなので直接作成APIを呼び出し
      try {
        const createdMap = await this.apiClient.createMindMap(map);
        logger.info('☁️ CloudStorageAdapter: New map created in cloud:', createdMap.title);
        await markAsCloudSynced(createdMap.id);
      } catch (createError) {
        logger.warn('⚠️ CloudStorageAdapter: Failed to create map in cloud, saved locally only:', createError);
      }
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Failed to add map to list:', error);
      throw error;
    }
  }

  /**
   * マップをリストから削除
   */
  async removeMapFromList(mapId: string): Promise<void> {
    if (!this._isInitialized) {
      logger.warn('CloudStorageAdapter: Not initialized, skipping remove map');
      return;
    }

    try {
      // APIから削除
      if (this.authAdapter.isAuthenticated) {
        await this.apiClient.deleteMindMap(mapId);
      }

      // ローカルからも削除
      await deleteFromCloudIndexedDB(mapId);
      
      logger.info('🗑️ CloudStorageAdapter: Removed map:', mapId);
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Failed to remove map:', error);
      throw error;
    }
  }

  /**
   * マップをリストで更新
   */
  async updateMapInList(map: MindMapData): Promise<void> {
    return this.saveData(map);
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(mindmapId: string, nodeId: string, file: File): Promise<FileInfo> {
    logger.info('🚀 CloudStorageAdapter: uploadFile called', { 
      mindmapId, 
      nodeId, 
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      isInitialized: this.isInitialized
    });

    if (!this.isInitialized) {
      logger.info('🔄 CloudStorageAdapter: Not initialized, initializing...');
      await this.initialize();
    }

    logger.info('🔐 CloudStorageAdapter: Auth check', {
      isAuthenticated: this.authAdapter.isAuthenticated,
      hasUser: !!this.authAdapter.user,
      userId: this.authAdapter.user?.id
    });

    if (!this.authAdapter.isAuthenticated) {
      logger.error('❌ CloudStorageAdapter: User not authenticated');
      throw new Error('User not authenticated for file upload');
    }

    try {
      logger.info('☁️ CloudStorageAdapter: Calling API client uploadFile...');
      
      const uploadResult = await this.apiClient.uploadFile(mindmapId, nodeId, file);
      
      logger.info('✅ CloudStorageAdapter: File uploaded successfully:', uploadResult);
      return uploadResult;
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: File upload failed:', error);
      logger.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * ファイルを削除
   */
  async deleteFile(mindmapId: string, nodeId: string, fileId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.authAdapter.isAuthenticated) {
      throw new Error('User not authenticated for file deletion');
    }

    try {
      logger.info('🗑️ CloudStorageAdapter: Deleting file from cloud:', { mindmapId, nodeId, fileId });
      
      await this.apiClient.deleteFile(mindmapId, nodeId, fileId);
      
      logger.info('✅ CloudStorageAdapter: File deleted successfully');
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: File deletion failed:', error);
      throw error;
    }
  }

  /**
   * ファイル情報を取得
   */
  async getFileInfo(mindmapId: string, nodeId: string, fileId: string): Promise<FileInfo> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.authAdapter.isAuthenticated) {
      throw new Error('User not authenticated for file access');
    }

    try {
      return await this.apiClient.getFileInfo(mindmapId, nodeId, fileId);
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Failed to get file info:', error);
      throw error;
    }
  }

  /**
   * ファイルをダウンロード
   */
  async downloadFile(mindmapId: string, nodeId: string, fileId: string): Promise<Blob> {
    logger.info('🚀 CloudStorageAdapter: downloadFile called', { 
      mindmapId, 
      nodeId, 
      fileId,
      isInitialized: this.isInitialized
    });

    if (!this.isInitialized) {
      logger.info('🔄 CloudStorageAdapter: Not initialized, initializing...');
      await this.initialize();
    }

    logger.info('🔐 CloudStorageAdapter: Auth check', {
      isAuthenticated: this.authAdapter.isAuthenticated,
      hasUser: !!this.authAdapter.user,
      userId: this.authAdapter.user?.id
    });

    if (!this.authAdapter.isAuthenticated) {
      logger.error('❌ CloudStorageAdapter: User not authenticated');
      throw new Error('User not authenticated for file download');
    }

    try {
      logger.info('☁️ CloudStorageAdapter: Calling API client downloadFile...');
      
      const blob = await this.apiClient.downloadFile(mindmapId, nodeId, fileId);
      
      logger.info('✅ CloudStorageAdapter: File downloaded successfully:', {
        size: blob.size,
        type: blob.type
      });
      return blob;
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: File download failed:', error);
      logger.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * すべてのファイル情報を取得
   */
  async getAllFiles(): Promise<FileInfo[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.authAdapter.isAuthenticated) {
      throw new Error('User not authenticated for file access');
    }

    try {
      logger.info('📋 CloudStorageAdapter: Getting all files');
      const files = await this.apiClient.getAllFiles();
      logger.info(`✅ CloudStorageAdapter: Retrieved ${files.length} files`);
      return files;
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Failed to get all files:', error);
      // エラーの場合は空配列を返す（fallback）
      return [];
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    // Cancel any ongoing async operations
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // SyncStatusServiceのクリーンアップ
    this.syncStatusService.cleanup();
    
    // EditingStateServiceのクリーンアップ
    this.editingStateService.cleanup();
    
    logger.info('🧹 CloudStorageAdapter: Cleanup completed');
  }

  /**
   * ローカルデータを取得
   */
  private async getLocalData(): Promise<MindMapData | null> {
    try {
      const userId = this.authAdapter.user?.id;
      if (!userId) return null;

      const allLocalData = await getAllFromCloudIndexedDB(userId);
      if (allLocalData.length > 0) {
        const { _metadata, ...cleanData } = allLocalData[0];
        return validateAndCleanData(cleanData);
      }
      return null;
    } catch (error) {
      logger.warn('⚠️ CloudStorageAdapter: Failed to get local data:', error);
      return null;
    }
  }

  /**
   * 全ローカルマップを取得
   */
  private async getAllLocalMaps(): Promise<MindMapData[]> {
    try {
      const userId = this.authAdapter.user?.id;
      if (!userId) return [];

      const allLocalData = await getAllFromCloudIndexedDB(userId);
      return allLocalData
        .map(({ _metadata, ...cleanData }) => validateAndCleanData(cleanData))
        .filter((data): data is MindMapData => data !== null);
    } catch (error) {
      logger.warn('⚠️ CloudStorageAdapter: Failed to get all local maps:', error);
      return [];
    }
  }

  /**
   * ローカルに保存
   */
  private async saveToLocal(data: MindMapData): Promise<void> {
    const userId = this.authAdapter.user?.id;
    if (!userId) {
      throw new Error('User ID required for local storage');
    }
    await saveToCloudIndexedDB(data, userId);
  }

  /**
   * 非同期でAPIに保存
   */
  private async saveToAPIAsync(data: MindMapData): Promise<void> {
    if (!this.authAdapter.isAuthenticated) return;

    try {
      // まずサーバーに存在するかチェックして、適切なAPIを使用
      let updatedData: MindMapData;
      
      try {
        // 既存のマップを更新を試行
        updatedData = await this.apiClient.updateMindMap(data);
        logger.debug('☁️ CloudStorageAdapter: Data updated in cloud:', updatedData.title);
      } catch (updateError) {
        // 更新が失敗した場合は新規作成を試行
        logger.debug('🆕 CloudStorageAdapter: Creating new mindmap in cloud');
        updatedData = await this.apiClient.createMindMap(data);
        logger.debug('☁️ CloudStorageAdapter: Data created in cloud:', updatedData.title);
      }
      
      await markAsCloudSynced(updatedData.id);
    } catch (error) {
      logger.warn('⚠️ CloudStorageAdapter: Cloud sync failed, data saved locally:', error);
    }
  }

  /**
   * 初期データを非同期でAPIに作成
   */
  private async createInitialDataAsync(data: MindMapData): Promise<void> {
    if (!this.authAdapter.isAuthenticated) return;

    try {
      // 新規作成なので直接作成APIを使用
      const createdData = await this.apiClient.createMindMap(data);
      logger.info('☁️ CloudStorageAdapter: Initial data created in cloud:', createdData.title);
      await markAsCloudSynced(createdData.id);
    } catch (error) {
      logger.warn('⚠️ CloudStorageAdapter: Failed to create initial data in cloud, saved locally only:', error);
    }
  }

  /**
   * バックグラウンド同期を開始
   */
  private startBackgroundSync(): void {
    // 30秒間隔でバックグラウンド同期
    this.syncInterval = setInterval(async () => {
      if (!this.authAdapter.isAuthenticated) {
        this.syncStatusService.updateStatus({ isOnline: false });
        return;
      }

      // Create a new AbortController for this sync cycle
      const syncAbortController = new AbortController();
      
      try {
        // 編集中は同期チェックをスキップ
        if (this.editingStateService.isEditing()) {
          return;
        }

        // 1. ローカルの dirty データをサーバーに送信
        await this.syncDirtyDataToServer(syncAbortController);
        
        // 2. サーバーから更新をチェック（編集中でない場合のみ）
        if (!this.editingStateService.isEditing()) {
          await this.checkServerUpdates();
        }
        
        this.syncStatusService.onSyncSuccess();
      } catch (error) {
        logger.warn('⚠️ CloudStorageAdapter: Background sync error:', error);
        this.syncStatusService.onSyncFailure(error instanceof Error ? error.message : '同期エラー');
      }
    }, 30000);
  }

  /**
   * Dirty データをサーバーに同期
   */
  private async syncDirtyDataToServer(syncAbortController: AbortController): Promise<void> {
    const userId = this.authAdapter.user?.id || '';
    const dirtyMaps = await getCloudDirtyData(userId);
    
    if (dirtyMaps.length === 0) return;
    
    this.syncStatusService.updatePendingUploads(dirtyMaps.length);
    
    for (const dirtyMap of dirtyMaps) {
      // Check if we should abort
      if (syncAbortController.signal.aborted) {
        logger.debug('🚫 CloudStorageAdapter: Background sync aborted');
        break;
      }
      
      try {
        const { _metadata, ...cleanData } = dirtyMap;
        const validData = validateAndCleanData(cleanData);
        if (validData) {
          await this.apiClient.updateMindMap(validData);
          await markAsCloudSynced(dirtyMap.id);
          logger.debug('🔄 CloudStorageAdapter: Background sync completed:', dirtyMap.id);
        }
      } catch (syncError) {
        logger.warn('⚠️ CloudStorageAdapter: Background sync failed for map:', dirtyMap.id, syncError);
        this.syncStatusService.onSyncFailure(syncError instanceof Error ? syncError.message : '同期エラー', dirtyMap.id);
      }
    }
    
    this.syncStatusService.updatePendingUploads(0);
  }

  /**
   * サーバーからの更新をチェック
   */
  private async checkServerUpdates(): Promise<void> {
    try {
      const serverMaps = await this.apiClient.getMindMaps();
      const userId = this.authAdapter.user?.id || '';
      const localMaps = await getAllFromCloudIndexedDB(userId);
      
      let updateCount = 0;
      const updatedMaps: MindMapData[] = [];
      
      for (const serverMap of serverMaps) {
        const localMap = localMaps.find(map => map.id === serverMap.id);
        const lastKnownVersion = this.lastKnownServerVersion.get(serverMap.id);
        
        // サーバーとローカルのタイムスタンプを比較
        const serverTimestamp = new Date(serverMap.updatedAt).getTime();
        const localTimestamp = localMap ? new Date(localMap.updatedAt).getTime() : 0;
        
        // 詳細ログは開発時のみ
        // logger.debug('Checking map for updates:', { ... });
        
        // 初回チェック時：バージョンを記録するだけで通知しない
        if (!lastKnownVersion) {
          this.lastKnownServerVersion.set(serverMap.id, serverMap.updatedAt);
          // logger.debug('📋 First time checking map, recording version:', serverMap.title);
          continue;
        }
        
        // 既にこのバージョンを知っている場合はスキップ
        if (lastKnownVersion === serverMap.updatedAt) {
          // logger.debug('✅ Already know this version:', serverMap.title);
          continue;
        }
        
        // ローカルにマップがない場合（新規マップ）
        if (!localMap) {
          updateCount++;
          updatedMaps.push(serverMap);
          this.lastKnownServerVersion.set(serverMap.id, serverMap.updatedAt);
          logger.info('🆕 New map found on server:', serverMap.title);
          continue;
        }
        
        // サーバー側が新しい場合のみ更新通知
        if (serverTimestamp > localTimestamp) {
          updateCount++;
          updatedMaps.push(serverMap);
          this.lastKnownServerVersion.set(serverMap.id, serverMap.updatedAt);
          logger.info('🔄 Server map is newer:', serverMap.title, {
            serverTime: new Date(serverTimestamp).toISOString(),
            localTime: new Date(localTimestamp).toISOString(),
            timeDiff: serverTimestamp - localTimestamp
          });
        } else {
          // ローカル側が新しいか同じ場合：バージョンだけ更新して通知しない
          this.lastKnownServerVersion.set(serverMap.id, serverMap.updatedAt);
          // logger.debug('📱 Local map is newer or equal, no update needed:', serverMap.title);
        }
      }
      
      if (updateCount > 0) {
        logger.info(`📥 Found ${updateCount} updates on server`);
        
        // 更新されたマップをローカルキャッシュに保存（バックグラウンドで）
        this.cacheUpdatedMapsAsync(updatedMaps, userId);
        
        // ユーザーに通知
        this.syncStatusService.onUpdatesAvailable(updateCount);
      }
      
    } catch (error) {
      logger.warn('⚠️ CloudStorageAdapter: Failed to check server updates:', error);
    }
  }

  /**
   * 更新されたマップをバックグラウンドでローカルキャッシュに保存
   */
  private async cacheUpdatedMapsAsync(updatedMaps: MindMapData[], userId: string): Promise<void> {
    try {
      for (const map of updatedMaps) {
        const validatedMap = validateAndCleanData(map);
        if (validatedMap) {
          await saveToCloudIndexedDB(validatedMap, userId);
          logger.debug('🔄 Cached updated map:', map.title);
        }
      }
      logger.info(`💾 Cached ${updatedMaps.length} updated maps`);
    } catch (error) {
      logger.warn('⚠️ Failed to cache updated maps:', error);
    }
  }

  /**
   * アプリ起動時の期限切れキャッシュクリーンアップ
   */
  private async performStartupCleanup(): Promise<void> {
    try {
      const userId = this.authAdapter.user?.id;
      if (!userId) {
        logger.debug('🧹 CloudStorageAdapter: Skip cleanup - no authenticated user');
        return;
      }

      // 前回のクリーンアップ時刻をチェック
      const result = getLocalStorage<string>(STORAGE_KEYS.LAST_CLEANUP);
      const lastCleanup = result.success ? result.data : null;
      const now = new Date();

      // 24時間以内にクリーンアップ済みの場合はスキップ
      if (lastCleanup) {
        const lastCleanupTime = new Date(lastCleanup);
        const timeSinceLastCleanup = now.getTime() - lastCleanupTime.getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (timeSinceLastCleanup < twentyFourHours) {
          logger.debug('🧹 CloudStorageAdapter: Skip cleanup - less than 24 hours since last cleanup');
          return;
        }
      }

      // 期限切れキャッシュの削除 (30日以上古い)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const allMaps = await getUserMapsFromCloudIndexedDB(userId);
      const expiredMaps = allMaps.filter(map => 
        new Date(map._metadata.lastSync) < thirtyDaysAgo
      );

      let removedCount = 0;
      for (const map of expiredMaps) {
        try {
          await removeMindMapFromCloudIndexedDB(map.id);
          removedCount++;
        } catch (error) {
          logger.warn('⚠️ CloudStorageAdapter: Failed to remove expired cache:', map.id, error);
        }
      }

      // 容量制限の実施 (最大100件)
      const remainingMaps = await getUserMapsFromCloudIndexedDB(userId);
      const maxCacheEntries = 100;
      
      if (remainingMaps.length > maxCacheEntries) {
        // lastSyncが古い順にソート
        const sortedMaps = remainingMaps.sort((a, b) => 
          new Date(a._metadata.lastSync).getTime() - 
          new Date(b._metadata.lastSync).getTime()
        );

        const excessMaps = sortedMaps.slice(0, remainingMaps.length - maxCacheEntries);
        for (const map of excessMaps) {
          try {
            await removeMindMapFromCloudIndexedDB(map.id);
            removedCount++;
          } catch (error) {
            logger.warn('⚠️ CloudStorageAdapter: Failed to remove excess cache:', map.id, error);
          }
        }
      }

      // クリーンアップ時刻を記録
      setLocalStorage(STORAGE_KEYS.LAST_CLEANUP, now.toISOString());

      if (removedCount > 0) {
        logger.info(`🧹 CloudStorageAdapter: Startup cleanup completed - removed ${removedCount} cache entries`);
      } else {
        logger.debug('🧹 CloudStorageAdapter: Startup cleanup completed - no entries to remove');
      }

    } catch (error) {
      logger.warn('⚠️ CloudStorageAdapter: Startup cleanup failed:', error);
      // クリーンアップ失敗は初期化を阻害しない
    }
  }
}