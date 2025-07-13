// Cloud storage adapter - integrates cloud storage with Local architecture
import type { MindMapData } from '@shared/types';
import type { StorageAdapter } from '../types';
import type { AuthAdapter } from '../../auth/types';
import { createInitialData } from '../../../shared/types/dataTypes';
import {
  initLocalIndexedDB,
  saveMindMapToIndexedDB,
  getAllMindMapsFromIndexedDB,
  removeMindMapFromIndexedDB
} from '../../utils/indexedDB';

// Bridge functions to map cloud-specific calls to working local IndexedDB
const initCloudIndexedDB = initLocalIndexedDB;

const saveToCloudIndexedDB = async (data: MindMapData, _userId: string): Promise<void> => {
  return saveMindMapToIndexedDB(data);
};

const getAllFromCloudIndexedDB = async (userId: string): Promise<any[]> => {
  const maps = await getAllMindMapsFromIndexedDB();
  return maps.map(map => ({
    ...map,
    _metadata: {
      lastSync: new Date().toISOString(),
      version: 1,
      isDirty: false,
      userId
    }
  }));
};

const markAsCloudSynced = async (id: string): Promise<void> => {
  // No-op for now, could be implemented with metadata updates
  console.log('📋 Marked as synced:', id);
};

const getCloudDirtyData = async (_userId: string): Promise<any[]> => {
  // Return empty array for now since local data doesn't track dirty state
  return [];
};

const deleteFromCloudIndexedDB = async (id: string): Promise<void> => {
  return removeMindMapFromIndexedDB(id);
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
      // 認証の初期化を待つ
      if (!this.authAdapter.isInitialized) {
        await new Promise<void>(resolve => {
          const checkAuth = () => {
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
      this._isInitialized = true;
      
      // バックグラウンド同期を開始
      this.startBackgroundSync();
      
      console.log('✅ CloudStorageAdapter: Initialized with auth and API');
    } catch (error) {
      console.error('❌ CloudStorageAdapter: Initialization failed:', error);
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
      console.log('🔑 CloudStorageAdapter: User not authenticated, returning initial data');
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
        console.warn('⚠️ CloudStorageAdapter: API fetch failed, using local data:', apiError);
      }
      
      // 3. サーバーデータがある場合はそれを使用、なければローカルデータ
      if (serverData) {
        console.log('📋 CloudStorageAdapter: Loaded server data:', serverData.title);
        return serverData;
      } else if (localData) {
        console.log('📋 CloudStorageAdapter: Using local cached data:', localData.title);
        return localData;
      }

      // データがない場合はデフォルトデータを作成
      const initialData = createInitialData();
      console.log('🆕 CloudStorageAdapter: Created initial data:', initialData.title);
      
      // すぐにサーバーに保存（非同期）
      this.saveToAPIAsync(initialData);
      await this.saveToLocal(initialData);
      
      return initialData;
    } catch (error) {
      console.error('❌ CloudStorageAdapter: Failed to load initial data:', error);
      
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
      console.warn('CloudStorageAdapter: Not initialized, skipping save');
      return;
    }

    try {
      // 認証されている場合のみ保存
      if (!this.authAdapter.isAuthenticated) {
        console.warn('CloudStorageAdapter: User not authenticated, skipping save');
        return;
      }

      // 1. まずローカルに保存（即座の応答性）
      await this.saveToLocal(data);
      console.log('💾 CloudStorageAdapter: Data saved locally:', data.title);

      // 2. APIにも保存（非同期）
      this.saveToAPIAsync(data).catch(error => {
        console.warn('⚠️ CloudStorageAdapter: Background API save failed:', error);
      });
    } catch (error) {
      console.error('❌ CloudStorageAdapter: Failed to save data:', error);
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
        console.log(`📋 CloudStorageAdapter: Loaded ${cleanedMaps.length} maps from API`);
        
        // Note: ローカルキャッシュの更新は明示的な保存時のみ行う（読み込み時は不要）
        
        return cleanedMaps;
      }

      // サーバーにデータがない場合はローカルキャッシュを確認
      const localMaps = await this.getAllLocalMaps();
      console.log(`📋 CloudStorageAdapter: Loaded ${localMaps.length} maps from local cache`);
      return localMaps;
    } catch (error) {
      console.error('❌ CloudStorageAdapter: Failed to load maps:', error);
      
      // エラー時はローカルキャッシュを返す
      return this.getAllLocalMaps();
    }
  }

  /**
   * 全マップを保存
   */
  async saveAllMaps(maps: MindMapData[]): Promise<void> {
    if (!this._isInitialized) {
      console.warn('CloudStorageAdapter: Not initialized, skipping save all maps');
      return;
    }

    try {
      // 各マップを個別に保存
      await Promise.all(maps.map(map => this.saveData(map)));
      console.log(`💾 CloudStorageAdapter: Saved ${maps.length} maps`);
    } catch (error) {
      console.error('❌ CloudStorageAdapter: Failed to save maps:', error);
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
      console.warn('CloudStorageAdapter: Not initialized, skipping remove map');
      return;
    }

    try {
      // APIから削除
      if (this.authAdapter.isAuthenticated) {
        await this.apiClient.deleteMindMap(mapId);
      }

      // ローカルからも削除
      await deleteFromCloudIndexedDB(mapId);
      
      console.log('🗑️ CloudStorageAdapter: Removed map:', mapId);
    } catch (error) {
      console.error('❌ CloudStorageAdapter: Failed to remove map:', error);
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
   * クリーンアップ
   */
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('🧹 CloudStorageAdapter: Cleanup completed');
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
      console.warn('⚠️ CloudStorageAdapter: Failed to get local data:', error);
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
      console.warn('⚠️ CloudStorageAdapter: Failed to get all local maps:', error);
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
        console.log('☁️ CloudStorageAdapter: Data updated in cloud:', updatedData.title);
      } catch (updateError) {
        // 更新が失敗した場合は新規作成を試行
        console.log('🆕 CloudStorageAdapter: Creating new mindmap in cloud');
        updatedData = await this.apiClient.createMindMap(data);
        console.log('☁️ CloudStorageAdapter: Data created in cloud:', updatedData.title);
      }
      
      await markAsCloudSynced(updatedData.id);
    } catch (error) {
      console.warn('⚠️ CloudStorageAdapter: Cloud sync failed, data saved locally:', error);
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
            console.log('🔄 CloudStorageAdapter: Background sync completed:', dirtyMap.id);
          } catch (syncError) {
            console.warn('⚠️ CloudStorageAdapter: Background sync failed:', syncError);
          }
        }
      } catch (error) {
        console.warn('⚠️ CloudStorageAdapter: Background sync error:', error);
      }
    }, 30000);
  }
}