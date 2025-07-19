// Cloud storage adapter - integrates cloud storage with Local architecture
import type { MindMapData } from '@shared/types';
import type { StorageAdapter } from '../types';
import type { AuthAdapter } from '../../auth/types';
import { createInitialData } from '../../../shared/types/dataTypes';
import {
  initCloudIndexedDB,
  saveMindMapToCloudIndexedDB,
  getAllMindMapsFromCloudIndexedDB,
  removeMindMapFromCloudIndexedDB,
  getUserMapsFromCloudIndexedDB,
  cleanupCloudIndexedDB,
  type CloudCachedMindMap
} from '../../utils/cloudIndexedDB';
import { logger } from '../../../shared/utils/logger';

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
import { createCloudflareAPIClient, cleanEmptyNodesFromData, type CloudflareAPI } from '../../cloud/api';

/**
 * クラウドストレージアダプター
 * IndexedDB + Cloudflare Workers APIのハイブリッド永続化
 */
export class CloudStorageAdapter implements StorageAdapter {
  private _isInitialized = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private apiClient: CloudflareAPI;

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
      logger.info('🔧 CloudStorageAdapter: Initialize started');
      
      // 認証の初期化を待つ（タイムアウト付き）
      if (!this.authAdapter.isInitialized) {
        logger.info('⏳ CloudStorageAdapter: Waiting for auth adapter initialization...');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Auth adapter initialization timeout (10s)'));
          }, 10000); // 10秒タイムアウト
          
          const checkAuth = () => {
            if (this.authAdapter.isInitialized) {
              clearTimeout(timeout);
              logger.info('✅ CloudStorageAdapter: Auth adapter initialized');
              resolve();
            } else {
              setTimeout(checkAuth, 100);
            }
          };
          checkAuth();
        });
      }

      // Cloud IndexedDBを初期化
      logger.info('🗄️ CloudStorageAdapter: Initializing Cloud IndexedDB...');
      await initCloudIndexedDB();
      this._isInitialized = true;
      
      // バックグラウンド同期を開始
      this.startBackgroundSync();
      
      logger.info('✅ CloudStorageAdapter: Initialized with auth and API');
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: Initialization failed:', error);
      // 初期化に失敗してもアプリは続行可能にする
      this._isInitialized = true;
      throw error;
    }
  }

  /**
   * 初期データを読み込み（IndexedDB -> API）
   */
  async loadInitialData(): Promise<MindMapData> {
    logger.info('🚀 CloudStorageAdapter: loadInitialData started');
    
    if (!this.isInitialized) {
      logger.info('🔧 CloudStorageAdapter: Not initialized, initializing...');
      await this.initialize();
    }

    if (!this.authAdapter.isAuthenticated) {
      logger.debug('🔑 CloudStorageAdapter: User not authenticated, returning initial data');
      return createInitialData();
    }

    logger.info('✅ CloudStorageAdapter: User authenticated, proceeding with data load');

    try {
      // 1. まずIndexedDBからローカルキャッシュを確認
      logger.info('📋 CloudStorageAdapter: Step 1 - Checking local cache...');
      const localData = await this.getLocalData();
      logger.info('📋 CloudStorageAdapter: Local data check complete', { hasLocalData: !!localData });
      
      // 2. APIサーバーのヘルスチェック
      logger.info('🏥 CloudStorageAdapter: Step 2 - API health check...');
      const isHealthy = await this.apiClient.healthCheck();
      logger.info('🏥 CloudStorageAdapter: Health check complete', { isHealthy });
      
      if (!isHealthy) {
        logger.warn('⚠️ CloudStorageAdapter: API server unhealthy, using local data');
        if (localData) {
          logger.info('📋 CloudStorageAdapter: Returning local data (server unhealthy)');
          return localData;
        }
        logger.info('🆕 CloudStorageAdapter: Creating initial data (no local data, server unhealthy)');
        const initialData = createInitialData();
        await this.saveToLocal(initialData);
        return initialData;
      }
      
      // 3. APIからサーバーデータを取得
      logger.info('☁️ CloudStorageAdapter: Step 3 - Fetching server data...');
      let serverData: MindMapData | null = null;
      try {
        const serverMaps = await this.apiClient.getMindMaps();
        logger.info('☁️ CloudStorageAdapter: Server fetch complete', { mapCount: serverMaps.length });
        if (serverMaps.length > 0) {
          serverData = cleanEmptyNodesFromData(serverMaps[0]);
          logger.info('☁️ CloudStorageAdapter: Server data processed', { title: serverData.title });
        }
      } catch (apiError) {
        logger.warn('⚠️ CloudStorageAdapter: API fetch failed, using local data:', apiError);
      }
      
      // 4. サーバーデータがある場合はそれを使用、なければローカルデータ
      logger.info('🔄 CloudStorageAdapter: Step 4 - Deciding data source...');
      if (serverData) {
        logger.info('📋 CloudStorageAdapter: Returning server data:', serverData.title);
        return serverData;
      } else if (localData) {
        logger.info('📋 CloudStorageAdapter: Returning local cached data:', localData.title);
        return localData;
      }

      // データがない場合はデフォルトデータを作成
      logger.info('🆕 CloudStorageAdapter: Step 5 - Creating initial data...');
      const initialData = createInitialData();
      logger.info('🆕 CloudStorageAdapter: Initial data created:', initialData.title);
      
      // サーバーが健康な場合のみサーバーに保存を試行
      if (isHealthy) {
        logger.info('💾 CloudStorageAdapter: Saving to API (async)...');
        this.saveToAPIAsync(initialData);
      }
      logger.info('💾 CloudStorageAdapter: Saving to local...');
      await this.saveToLocal(initialData);
      
      logger.info('✅ CloudStorageAdapter: loadInitialData completed successfully');
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

      // 2. サーバーヘルスチェック後にAPIに保存（非同期）
      this.saveToAPIWithHealthCheck(data).catch(error => {
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
    return this.saveData(map);
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
  async uploadFile(mindmapId: string, nodeId: string, file: File): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.authAdapter.isAuthenticated) {
      throw new Error('User not authenticated for file upload');
    }

    try {
      logger.info('☁️ CloudStorageAdapter: Uploading file to cloud:', { mindmapId, nodeId, fileName: file.name });
      
      const uploadResult = await this.apiClient.uploadFile(mindmapId, nodeId, file);
      
      logger.info('✅ CloudStorageAdapter: File uploaded successfully:', uploadResult);
      return uploadResult;
    } catch (error) {
      logger.error('❌ CloudStorageAdapter: File upload failed:', error);
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
  async getFileInfo(mindmapId: string, nodeId: string, fileId: string): Promise<any> {
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
   * クリーンアップ
   */
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    // IndexedDB接続もクリーンアップ
    cleanupCloudIndexedDB();
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
        return cleanData as MindMapData;
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
      return allLocalData.map(({ _metadata, ...cleanData }) => cleanData as MindMapData);
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
   * ヘルスチェック付きでAPIに保存
   */
  private async saveToAPIWithHealthCheck(data: MindMapData): Promise<void> {
    if (!this.authAdapter.isAuthenticated) return;

    try {
      // サーバーヘルスチェック
      const isHealthy = await this.apiClient.healthCheck();
      if (!isHealthy) {
        logger.warn('⚠️ CloudStorageAdapter: API server unhealthy, skipping API save');
        return;
      }

      await this.saveToAPIAsync(data);
    } catch (error) {
      logger.warn('⚠️ CloudStorageAdapter: Health check or API save failed:', error);
    }
  }

  /**
   * バックグラウンド同期を開始
   */
  private startBackgroundSync(): void {
    // 30秒間隔でバックグラウンド同期
    this.syncInterval = setInterval(async () => {
      if (!this.authAdapter.isAuthenticated) return;

      try {
        const userId = this.authAdapter.user?.id || '';
        const dirtyMaps = await getCloudDirtyData(userId);
        for (const dirtyMap of dirtyMaps) {
          try {
            const { _metadata, ...cleanData } = dirtyMap;
            await this.apiClient.updateMindMap(cleanData as MindMapData);
            await markAsCloudSynced(dirtyMap.id);
            logger.debug('🔄 CloudStorageAdapter: Background sync completed:', dirtyMap.id);
          } catch (syncError) {
            logger.warn('⚠️ CloudStorageAdapter: Background sync failed:', syncError);
          }
        }
      } catch (error) {
        logger.warn('⚠️ CloudStorageAdapter: Background sync error:', error);
      }
    }, 30000);
  }
}