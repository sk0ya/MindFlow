/**
 * BackgroundSyncManager - バックグラウンドでのCloud同期管理
 */

import { indexedDBManager, type SyncOperation, type MindMapIndexedData } from './indexedDBManager';

export interface SyncConfig {
  enabled: boolean;
  intervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
}

export interface SyncResult {
  success: boolean;
  operationsProcessed: number;
  errors: Array<{ operation: SyncOperation; error: string }>;
}

export interface CloudSyncAPI {
  getMindMaps(): Promise<any[]>;
  getMindMap(id: string): Promise<any>;
  createMindMap(data: any): Promise<any>;
  updateMindMap(id: string, data: any): Promise<any>;
  deleteMindMap(id: string): Promise<void>;
  createNode(mapId: string, nodeData: any): Promise<any>;
  updateNode(mapId: string, nodeId: string, nodeData: any): Promise<any>;
  deleteNode(mapId: string, nodeId: string): Promise<void>;
  moveNode(mapId: string, nodeId: string, moveData: any): Promise<any>;
}

export class BackgroundSyncManager {
  private syncConfig: SyncConfig = {
    enabled: false,
    intervalMs: 30000, // 30秒
    maxRetries: 3,
    retryDelayMs: 5000,
    batchSize: 10
  };

  private syncInterval: number | null = null;
  private isCurrentlySyncing = false;
  private cloudAPI: CloudSyncAPI | null = null;
  private eventEmitter = new EventTarget();

  /**
   * 同期マネージャーを初期化
   */
  async initialize(cloudAPI: CloudSyncAPI, config?: Partial<SyncConfig>): Promise<void> {
    this.cloudAPI = cloudAPI;
    if (config) {
      this.syncConfig = { ...this.syncConfig, ...config };
    }

    await indexedDBManager.initialize();
    console.log('🔄 BackgroundSyncManager初期化完了');
  }

  /**
   * バックグラウンド同期を開始
   */
  startBackgroundSync(): void {
    if (!this.syncConfig.enabled) {
      console.log('⏸️ バックグラウンド同期は無効です');
      return;
    }

    if (this.syncInterval) {
      console.log('⚠️ バックグラウンド同期は既に実行中です');
      return;
    }

    console.log(`🚀 バックグラウンド同期開始 (間隔: ${this.syncConfig.intervalMs}ms)`);
    
    // 即座に一回実行
    this.performSync();
    
    // 定期実行を設定
    this.syncInterval = window.setInterval(() => {
      this.performSync();
    }, this.syncConfig.intervalMs);

    this.emitEvent('sync-started', {});
  }

  /**
   * バックグラウンド同期を停止
   */
  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ バックグラウンド同期停止');
      this.emitEvent('sync-stopped', {});
    }
  }

  /**
   * 同期設定を更新
   */
  updateConfig(config: Partial<SyncConfig>): void {
    const wasEnabled = this.syncConfig.enabled;
    this.syncConfig = { ...this.syncConfig, ...config };

    // 有効化/無効化の状態変更をチェック
    if (!wasEnabled && this.syncConfig.enabled) {
      this.startBackgroundSync();
    } else if (wasEnabled && !this.syncConfig.enabled) {
      this.stopBackgroundSync();
    } else if (this.syncConfig.enabled && this.syncInterval) {
      // 間隔が変更された場合は再起動
      this.stopBackgroundSync();
      this.startBackgroundSync();
    }
  }

  /**
   * 手動で同期を実行
   */
  async performManualSync(): Promise<SyncResult> {
    console.log('🔄 手動同期開始');
    const result = await this.performSync();
    console.log('✅ 手動同期完了', result);
    return result;
  }

  /**
   * 実際の同期処理を実行
   */
  private async performSync(): Promise<SyncResult> {
    if (this.isCurrentlySyncing) {
      console.log('⏳ 同期処理が既に実行中のためスキップ');
      return { success: true, operationsProcessed: 0, errors: [] };
    }

    if (!this.cloudAPI) {
      console.error('❌ CloudAPI未初期化のため同期スキップ');
      return { success: false, operationsProcessed: 0, errors: [] };
    }

    this.isCurrentlySyncing = true;
    this.emitEvent('sync-started', {});

    try {
      // 1. ローカルからサーバーへの同期（未処理オペレーション）
      const localToCloudResult = await this.syncLocalToCloud();
      
      // 2. サーバーからローカルへの同期（変更確認）
      const cloudToLocalResult = await this.syncCloudToLocal();

      const totalResult: SyncResult = {
        success: localToCloudResult.success && cloudToLocalResult.success,
        operationsProcessed: localToCloudResult.operationsProcessed + cloudToLocalResult.operationsProcessed,
        errors: [...localToCloudResult.errors, ...cloudToLocalResult.errors]
      };

      this.emitEvent('sync-completed', totalResult);
      return totalResult;

    } catch (error) {
      console.error('❌ 同期エラー:', error);
      const errorResult: SyncResult = {
        success: false,
        operationsProcessed: 0,
        errors: [{ operation: {} as SyncOperation, error: String(error) }]
      };
      this.emitEvent('sync-error', errorResult);
      return errorResult;
    } finally {
      this.isCurrentlySyncing = false;
    }
  }

  /**
   * ローカルからクラウドへの同期
   */
  private async syncLocalToCloud(): Promise<SyncResult> {
    const pendingOps = await indexedDBManager.getPendingSyncOperations();
    if (pendingOps.length === 0) {
      return { success: true, operationsProcessed: 0, errors: [] };
    }

    console.log(`📤 ローカル→クラウド同期: ${pendingOps.length}件のオペレーション`);

    const errors: Array<{ operation: SyncOperation; error: string }> = [];
    let processedCount = 0;

    // バッチサイズごとに処理
    for (let i = 0; i < pendingOps.length; i += this.syncConfig.batchSize) {
      const batch = pendingOps.slice(i, i + this.syncConfig.batchSize);
      
      await Promise.all(batch.map(async (op) => {
        try {
          await this.processSyncOperation(op);
          processedCount++;
          await indexedDBManager.deleteSyncOperation(op.id);
        } catch (error) {
          console.error(`❌ オペレーション処理エラー ${op.id}:`, error);
          errors.push({ operation: op, error: String(error) });
          
          // リトライ回数を増やす
          if (op.retry_count < this.syncConfig.maxRetries) {
            await indexedDBManager.updateSyncOperation(op.id, {
              retry_count: op.retry_count + 1,
              status: 'pending'
            });
          } else {
            await indexedDBManager.updateSyncOperation(op.id, {
              status: 'failed'
            });
          }
        }
      }));
    }

    return {
      success: errors.length === 0,
      operationsProcessed: processedCount,
      errors
    };
  }

  /**
   * クラウドからローカルへの同期
   */
  private async syncCloudToLocal(): Promise<SyncResult> {
    try {
      console.log('📥 クラウド→ローカル同期開始');
      
      const cloudMaps = await this.cloudAPI!.getMindMaps();
      const localMaps = await indexedDBManager.getAllMindMaps();
      
      let processedCount = 0;
      const errors: Array<{ operation: SyncOperation; error: string }> = [];

      // クラウドのマップをローカルと比較
      for (const cloudMap of cloudMaps) {
        try {
          const localMap = localMaps.find(m => m.id === cloudMap.id);
          
          if (!localMap) {
            // ローカルにない新しいマップ
            await this.createLocalMapFromCloud(cloudMap);
            processedCount++;
          } else if (this.shouldUpdateFromCloud(localMap, cloudMap)) {
            // クラウドの方が新しい
            await this.updateLocalMapFromCloud(localMap, cloudMap);
            processedCount++;
          }
        } catch (error) {
          console.error(`❌ マップ同期エラー ${cloudMap.id}:`, error);
          errors.push({ 
            operation: { id: '', mapId: cloudMap.id, operation: 'update', data: cloudMap, timestamp: Date.now(), retry_count: 0, status: 'failed' },
            error: String(error) 
          });
        }
      }

      // ローカルで削除されたマップの検出（簡易実装）
      const cloudMapIds = new Set(cloudMaps.map(m => m.id));
      for (const localMap of localMaps) {
        if (!cloudMapIds.has(localMap.id) && localMap.syncStatus === 'synced') {
          // クラウドにないがローカルで同期済みのマップは削除対象
          await indexedDBManager.deleteMindMap(localMap.id);
          processedCount++;
        }
      }

      return {
        success: errors.length === 0,
        operationsProcessed: processedCount,
        errors
      };

    } catch (error) {
      console.error('❌ クラウド→ローカル同期エラー:', error);
      return {
        success: false,
        operationsProcessed: 0,
        errors: [{ operation: {} as SyncOperation, error: String(error) }]
      };
    }
  }

  /**
   * 個別の同期オペレーションを処理
   */
  private async processSyncOperation(op: SyncOperation): Promise<void> {
    console.log(`🔄 オペレーション処理: ${op.operation} for ${op.mapId}`);

    await indexedDBManager.updateSyncOperation(op.id, { status: 'syncing' });

    switch (op.operation) {
      case 'create':
        await this.cloudAPI!.createMindMap(op.data);
        await this.markMapAsSynced(op.mapId);
        break;

      case 'update':
        await this.cloudAPI!.updateMindMap(op.mapId, op.data);
        await this.markMapAsSynced(op.mapId);
        break;

      case 'delete':
        await this.cloudAPI!.deleteMindMap(op.mapId);
        break;

      case 'node_create':
        await this.cloudAPI!.createNode(op.mapId, op.data);
        await this.markMapAsSynced(op.mapId);
        break;

      case 'node_update':
        await this.cloudAPI!.updateNode(op.mapId, op.data.nodeId, op.data);
        await this.markMapAsSynced(op.mapId);
        break;

      case 'node_delete':
        await this.cloudAPI!.deleteNode(op.mapId, op.data.nodeId);
        await this.markMapAsSynced(op.mapId);
        break;

      case 'node_move':
        await this.cloudAPI!.moveNode(op.mapId, op.data.nodeId, op.data);
        await this.markMapAsSynced(op.mapId);
        break;

      default:
        throw new Error(`未知のオペレーション: ${op.operation}`);
    }

    await indexedDBManager.updateSyncOperation(op.id, { status: 'completed' });
  }

  /**
   * マップを同期済みとしてマーク
   */
  private async markMapAsSynced(mapId: string): Promise<void> {
    const map = await indexedDBManager.getMindMap(mapId);
    if (map) {
      map.syncStatus = 'synced';
      await indexedDBManager.saveMindMap(map);
    }
  }

  /**
   * クラウドからローカルマップを作成
   */
  private async createLocalMapFromCloud(cloudMap: any): Promise<void> {
    const localMap: MindMapIndexedData = {
      id: cloudMap.id,
      title: cloudMap.title,
      rootNode: cloudMap.rootNode || cloudMap.data?.rootNode,
      settings: cloudMap.settings || { autoSave: true, autoLayout: false },
      lastModified: new Date(cloudMap.updated_at || cloudMap.lastModified).getTime(),
      syncStatus: 'synced',
      cloudVersion: cloudMap.version || 1,
      localVersion: 1,
      userId: cloudMap.user_id
    };

    await indexedDBManager.saveMindMap(localMap);
    console.log(`📥 新しいマップをローカルに作成: ${cloudMap.id}`);
  }

  /**
   * クラウドからローカルマップを更新
   */
  private async updateLocalMapFromCloud(localMap: MindMapIndexedData, cloudMap: any): Promise<void> {
    const updatedMap: MindMapIndexedData = {
      ...localMap,
      title: cloudMap.title,
      rootNode: cloudMap.rootNode || cloudMap.data?.rootNode,
      settings: cloudMap.settings || localMap.settings,
      lastModified: new Date(cloudMap.updated_at || cloudMap.lastModified).getTime(),
      syncStatus: 'synced',
      cloudVersion: cloudMap.version || (localMap.cloudVersion || 0) + 1,
      localVersion: localMap.localVersion + 1
    };

    await indexedDBManager.saveMindMap(updatedMap);
    console.log(`📥 ローカルマップを更新: ${cloudMap.id}`);
  }

  /**
   * クラウドから更新すべきかどうかを判定
   */
  private shouldUpdateFromCloud(localMap: MindMapIndexedData, cloudMap: any): boolean {
    const cloudModified = new Date(cloudMap.updated_at || cloudMap.lastModified).getTime();
    const localModified = localMap.lastModified;

    // クラウドの方が新しい場合、または競合状態の場合
    return cloudModified > localModified || localMap.syncStatus === 'conflict';
  }

  /**
   * イベントを発火
   */
  private emitEvent(type: string, data: any): void {
    this.eventEmitter.dispatchEvent(new CustomEvent(type, { detail: data }));
  }

  /**
   * イベントリスナーを追加
   */
  addEventListener(type: string, listener: (event: CustomEvent) => void): void {
    this.eventEmitter.addEventListener(type, listener as EventListener);
  }

  /**
   * イベントリスナーを削除
   */
  removeEventListener(type: string, listener: (event: CustomEvent) => void): void {
    this.eventEmitter.removeEventListener(type, listener as EventListener);
  }

  /**
   * 現在の同期状態を取得
   */
  getSyncStatus(): {
    isRunning: boolean;
    isCurrentlySyncing: boolean;
    config: SyncConfig;
  } {
    return {
      isRunning: this.syncInterval !== null,
      isCurrentlySyncing: this.isCurrentlySyncing,
      config: { ...this.syncConfig }
    };
  }

  /**
   * リソースのクリーンアップ
   */
  destroy(): void {
    this.stopBackgroundSync();
    indexedDBManager.close();
    console.log('🧹 BackgroundSyncManager破棄完了');
  }
}

// シングルトンインスタンス
export const backgroundSyncManager = new BackgroundSyncManager();