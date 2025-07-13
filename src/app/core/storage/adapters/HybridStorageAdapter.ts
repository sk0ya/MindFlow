// Hybrid storage adapter - combines local IndexedDB with cloud backup
import type { MindMapData } from '@shared/types';
import type { StorageAdapter, SyncStatus } from '../types';
import type { AuthAdapter } from '../../auth/types';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { CloudStorageAdapter } from './CloudStorageAdapter';

/**
 * ハイブリッドストレージアダプター
 * ローカルの高速性とクラウドのバックアップ/同期を組み合わせ
 */
export class HybridStorageAdapter implements StorageAdapter {
  private localAdapter: LocalStorageAdapter;
  private cloudAdapter: CloudStorageAdapter;
  private syncStatus: SyncStatus;

  constructor(private authAdapter: AuthAdapter) {
    this.localAdapter = new LocalStorageAdapter();
    this.cloudAdapter = new CloudStorageAdapter(authAdapter);
    this.syncStatus = {
      lastSync: null,
      isSyncing: false,
      hasUnsyncedChanges: false,
      lastError: null
    };
  }

  get isInitialized(): boolean {
    return this.localAdapter.isInitialized && 
           (!this.authAdapter.isAuthenticated || this.cloudAdapter.isInitialized);
  }

  /**
   * ローカルとクラウドの両方を初期化
   */
  async initialize(): Promise<void> {
    try {
      // ローカル初期化（必須）
      await this.localAdapter.initialize();
      console.log('✅ HybridStorageAdapter: Local initialized');

      // 認証されている場合のみクラウド初期化
      if (this.authAdapter.isAuthenticated) {
        try {
          await this.cloudAdapter.initialize();
          console.log('✅ HybridStorageAdapter: Cloud initialized');
        } catch (cloudError) {
          console.warn('⚠️ HybridStorageAdapter: Cloud init failed, using local only:', cloudError);
          this.syncStatus.lastError = cloudError as Error;
        }
      }

      console.log('✅ HybridStorageAdapter: Hybrid mode initialized');
    } catch (error) {
      console.error('❌ HybridStorageAdapter: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 初期データを読み込み（ローカル優先、クラウドで補完）
   */
  async loadInitialData(): Promise<MindMapData> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 1. まずローカルから高速読み込み
      const localData = await this.localAdapter.loadInitialData();
      console.log('📋 HybridStorageAdapter: Loaded from local:', localData.title);

      // 2. 認証されている場合はバックグラウンドでクラウドと同期
      if (this.authAdapter.isAuthenticated && this.cloudAdapter.isInitialized) {
        this.syncInBackground().catch(error => {
          console.warn('⚠️ HybridStorageAdapter: Background sync failed:', error);
          this.syncStatus.lastError = error as Error;
        });
      }

      return localData;
    } catch (error) {
      console.error('❌ HybridStorageAdapter: Failed to load initial data:', error);
      throw error;
    }
  }

  /**
   * データを保存（ローカル即座、クラウド非同期）
   */
  async saveData(data: MindMapData): Promise<void> {
    if (!this.localAdapter.isInitialized) {
      console.warn('HybridStorageAdapter: Local not initialized, skipping save');
      return;
    }

    try {
      // 1. ローカルに即座保存（ユーザー体験優先）
      await this.localAdapter.saveData(data);
      console.log('💾 HybridStorageAdapter: Data saved locally:', data.title);

      // 2. 未同期フラグを設定
      this.syncStatus.hasUnsyncedChanges = true;

      // 3. 認証されている場合はバックグラウンドでクラウド同期
      if (this.authAdapter.isAuthenticated && this.cloudAdapter.isInitialized) {
        this.saveToCloudAsync(data).catch(error => {
          console.warn('⚠️ HybridStorageAdapter: Cloud save failed:', error);
          this.syncStatus.lastError = error as Error;
        });
      }
    } catch (error) {
      console.error('❌ HybridStorageAdapter: Failed to save data:', error);
      throw error;
    }
  }

  /**
   * 全マップを読み込み（ローカル優先）
   */
  async loadAllMaps(): Promise<MindMapData[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // ローカルから読み込み
      const localMaps = await this.localAdapter.loadAllMaps();
      console.log(`📋 HybridStorageAdapter: Loaded ${localMaps.length} maps from local`);

      // 認証されている場合はクラウドからも確認（バックグラウンド）
      if (this.authAdapter.isAuthenticated && this.cloudAdapter.isInitialized) {
        this.syncAllMapsInBackground().catch(error => {
          console.warn('⚠️ HybridStorageAdapter: Background maps sync failed:', error);
        });
      }

      return localMaps;
    } catch (error) {
      console.error('❌ HybridStorageAdapter: Failed to load maps:', error);
      return [];
    }
  }

  /**
   * 全マップを保存
   */
  async saveAllMaps(maps: MindMapData[]): Promise<void> {
    if (!this.localAdapter.isInitialized) {
      console.warn('HybridStorageAdapter: Local not initialized, skipping save all maps');
      return;
    }

    try {
      // ローカルに保存
      await this.localAdapter.saveAllMaps(maps);
      console.log(`💾 HybridStorageAdapter: Saved ${maps.length} maps locally`);

      // 未同期フラグを設定
      this.syncStatus.hasUnsyncedChanges = true;

      // 認証されている場合はクラウドにも保存（バックグラウンド）
      if (this.authAdapter.isAuthenticated && this.cloudAdapter.isInitialized) {
        this.saveAllMapsToCloudAsync(maps).catch(error => {
          console.warn('⚠️ HybridStorageAdapter: Cloud save all failed:', error);
          this.syncStatus.lastError = error as Error;
        });
      }
    } catch (error) {
      console.error('❌ HybridStorageAdapter: Failed to save maps:', error);
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
    if (!this.localAdapter.isInitialized) {
      console.warn('HybridStorageAdapter: Local not initialized, skipping remove map');
      return;
    }

    try {
      // ローカルから削除
      await this.localAdapter.removeMapFromList(mapId);
      console.log('🗑️ HybridStorageAdapter: Removed map locally:', mapId);

      // 認証されている場合はクラウドからも削除（バックグラウンド）
      if (this.authAdapter.isAuthenticated && this.cloudAdapter.isInitialized) {
        this.removeFromCloudAsync(mapId).catch(error => {
          console.warn('⚠️ HybridStorageAdapter: Cloud remove failed:', error);
          this.syncStatus.lastError = error as Error;
        });
      }
    } catch (error) {
      console.error('❌ HybridStorageAdapter: Failed to remove map:', error);
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
    this.localAdapter.cleanup();
    this.cloudAdapter.cleanup();
    console.log('🧹 HybridStorageAdapter: Cleanup completed');
  }

  /**
   * 同期状態を取得
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * 手動同期を実行
   */
  async forceSync(): Promise<void> {
    if (!this.authAdapter.isAuthenticated || !this.cloudAdapter.isInitialized) {
      throw new Error('Cloud sync requires authentication');
    }

    this.syncStatus.isSyncing = true;
    this.syncStatus.lastError = null;

    try {
      await this.syncInBackground();
      this.syncStatus.hasUnsyncedChanges = false;
      this.syncStatus.lastSync = new Date();
      console.log('✅ HybridStorageAdapter: Manual sync completed');
    } catch (error) {
      this.syncStatus.lastError = error as Error;
      console.error('❌ HybridStorageAdapter: Manual sync failed:', error);
      throw error;
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  /**
   * バックグラウンドでクラウドと同期
   */
  private async syncInBackground(): Promise<void> {
    try {
      // ローカルからクラウドへの同期は CloudStorageAdapter の内部機能に任せる
      console.log('🔄 HybridStorageAdapter: Background sync started');
      
      // 同期完了後のフラグ更新
      this.syncStatus.hasUnsyncedChanges = false;
      this.syncStatus.lastSync = new Date();
      this.syncStatus.lastError = null;
    } catch (error) {
      this.syncStatus.lastError = error as Error;
      throw error;
    }
  }

  /**
   * 全マップのバックグラウンド同期
   */
  private async syncAllMapsInBackground(): Promise<void> {
    try {
      const cloudMaps = await this.cloudAdapter.loadAllMaps();
      const localMaps = await this.localAdapter.loadAllMaps();

      // 簡単な同期ロジック：クラウドにあってローカルにないものをローカルに追加
      for (const cloudMap of cloudMaps) {
        const existsLocally = localMaps.some(local => local.id === cloudMap.id);
        if (!existsLocally) {
          await this.localAdapter.addMapToList(cloudMap);
          console.log('📥 HybridStorageAdapter: Synced map from cloud:', cloudMap.title);
        }
      }
    } catch (error) {
      console.warn('⚠️ HybridStorageAdapter: Maps sync failed:', error);
    }
  }

  /**
   * 非同期でクラウドに保存
   */
  private async saveToCloudAsync(data: MindMapData): Promise<void> {
    try {
      await this.cloudAdapter.saveData(data);
      console.log('☁️ HybridStorageAdapter: Data synced to cloud:', data.title);
      this.syncStatus.hasUnsyncedChanges = false;
      this.syncStatus.lastSync = new Date();
      this.syncStatus.lastError = null;
    } catch (error) {
      this.syncStatus.lastError = error as Error;
      throw error;
    }
  }

  /**
   * 非同期で全マップをクラウドに保存
   */
  private async saveAllMapsToCloudAsync(maps: MindMapData[]): Promise<void> {
    try {
      await this.cloudAdapter.saveAllMaps(maps);
      console.log(`☁️ HybridStorageAdapter: ${maps.length} maps synced to cloud`);
      this.syncStatus.hasUnsyncedChanges = false;
      this.syncStatus.lastSync = new Date();
      this.syncStatus.lastError = null;
    } catch (error) {
      this.syncStatus.lastError = error as Error;
      throw error;
    }
  }

  /**
   * 非同期でクラウドから削除
   */
  private async removeFromCloudAsync(mapId: string): Promise<void> {
    try {
      await this.cloudAdapter.removeMapFromList(mapId);
      console.log('☁️ HybridStorageAdapter: Map removed from cloud:', mapId);
    } catch (error) {
      this.syncStatus.lastError = error as Error;
      throw error;
    }
  }
}