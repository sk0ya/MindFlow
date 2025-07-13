// Cloud storage adapter - integrates cloud storage with Local architecture
import type { MindMapData } from '@shared/types';
import type { StorageAdapter, AuthAdapter } from '../types';
import { createInitialData } from '@local/shared/types/dataTypes';
import {
  initCloudIndexedDB,
  saveToIndexedDB,
  getAllFromIndexedDB,
  markAsSynced,
  getDirtyData
} from '../../../../Cloud/utils/indexedDB';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api.shigekazukoya.workers.dev';

/**
 * クラウドストレージアダプター
 * Cloud modeの機能をLocal architectureで使用するためのアダプター
 */
export class CloudStorageAdapter implements StorageAdapter {
  private _isInitialized = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(private authAdapter: AuthAdapter) {}

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
        await new Promise(resolve => {
          const checkAuth = () => {
            if (this.authAdapter.isInitialized) {
              resolve(undefined);
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
      
      console.log('✅ CloudStorageAdapter: Initialized with auth');
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
      throw new Error('Authentication required for cloud storage');
    }

    try {
      // 1. まずIndexedDBからローカルキャッシュを確認
      const localData = await this.getLocalData();
      
      // 2. APIからサーバーデータを取得
      const serverData = await this.fetchFromAPI();
      
      // 3. サーバーデータがある場合はそれを使用、なければローカルデータ
      if (serverData) {
        // サーバーデータをローカルに保存
        await this.saveToLocal(serverData);
        await markAsSynced(serverData.id);
        console.log('📋 CloudStorageAdapter: Loaded server data:', serverData.title);
        return serverData;
      } else if (localData) {
        console.log('📋 CloudStorageAdapter: Using local cached data:', localData.title);
        return localData;
      }

      // データがない場合はデフォルトデータを作成
      const initialData = createInitialData();
      console.log('🆕 CloudStorageAdapter: Created initial data:', initialData.title);
      
      // すぐにサーバーに保存
      await this.saveToAPI(initialData);
      await this.saveToLocal(initialData);
      await markAsSynced(initialData.id);
      
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
      // 1. まずローカルに保存（即座の応答性）
      await this.saveToLocal(data);
      console.log('💾 CloudStorageAdapter: Data saved locally:', data.title);

      // 2. 認証されている場合はAPIにも保存
      if (this.authAdapter.isAuthenticated) {
        try {
          await this.saveToAPI(data);
          await markAsSynced(data.id);
          console.log('☁️ CloudStorageAdapter: Data synced to cloud:', data.title);
        } catch (apiError) {
          console.warn('⚠️ CloudStorageAdapter: Cloud sync failed, data saved locally:', apiError);
          // ローカルには保存されているので、エラーは投げない
        }
      }
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
      const serverMaps = await this.fetchAllFromAPI();
      if (serverMaps.length > 0) {
        console.log(`📋 CloudStorageAdapter: Loaded ${serverMaps.length} maps from API`);
        return serverMaps;
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
        const headers = this.authAdapter.getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/api/mindmaps/${mapId}`, {
          method: 'DELETE',
          headers: headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to delete map from API: ${response.statusText}`);
        }
      }

      // ローカルからも削除（実装が必要な場合）
      // Note: Cloud IndexedDBにはremove機能がないため、必要に応じて実装
      
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
      const userEmail = this.authAdapter.user?.email;
      if (!userEmail) return null;

      const allLocalData = await getAllFromIndexedDB(userEmail);
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
      const userEmail = this.authAdapter.user?.email;
      if (!userEmail) return [];

      const allLocalData = await getAllFromIndexedDB(userEmail);
      return allLocalData.map((cachedMap: any) => {
        const { _metadata, ...cleanData } = cachedMap;
        return cleanData as MindMapData;
      });
    } catch (error) {
      console.warn('⚠️ CloudStorageAdapter: Failed to get all local maps:', error);
      return [];
    }
  }

  /**
   * ローカルに保存
   */
  private async saveToLocal(data: MindMapData): Promise<void> {
    const userEmail = this.authAdapter.user?.email;
    if (!userEmail) {
      throw new Error('User email required for local storage');
    }
    await saveToIndexedDB(data, userEmail);
  }

  /**
   * APIからデータを取得
   */
  private async fetchFromAPI(): Promise<MindMapData | null> {
    const headers = this.authAdapter.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // データなし
      }
      throw new Error(`API fetch failed: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.mindmaps && result.mindmaps.length > 0) {
      return result.mindmaps[0]; // 最初のマップを返す
    }
    
    return null;
  }

  /**
   * APIから全マップを取得
   */
  private async fetchAllFromAPI(): Promise<MindMapData[]> {
    const headers = this.authAdapter.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return []; // データなし
      }
      throw new Error(`API fetch all failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.mindmaps || [];
  }

  /**
   * APIにデータを保存
   */
  private async saveToAPI(data: MindMapData): Promise<void> {
    const headers = this.authAdapter.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/mindmaps`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API save failed: ${response.statusText}`);
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
        const dirtyMaps = await getDirtyData();
        for (const dirtyMap of dirtyMaps) {
          try {
            await this.saveToAPI(dirtyMap);
            await markAsSynced(dirtyMap.id);
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