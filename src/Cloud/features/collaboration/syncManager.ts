// オフライン対応とデータ同期管理

import { STORAGE_KEYS } from '../../shared/types/dataTypes.js';
import { storageManager } from '../../core/storage/StorageManager.js';

class SyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueue = this.loadSyncQueue();
    this.lastSyncTime = this.getLastSyncTime();
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // 同期キューの管理（クラウド専用 - メモリベース）
  loadSyncQueue() {
    // Cloud mode: sync queue stored in memory only
    console.log('📋 Loading sync queue from memory (cloud mode)');
    return [];
  }

  saveSyncQueue() {
    // Cloud mode: sync queue stored in memory only
    console.log('💾 Sync queue saved to memory (cloud mode)');
  }

  addToSyncQueue(operation) {
    const queueItem = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      operation,
      retryCount: 0
    };
    
    this.syncQueue.push(queueItem);
    this.saveSyncQueue();
    
    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  // 同期キューの処理
  async processSyncQueue() {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    const itemsToProcess = [...this.syncQueue];
    
    for (const item of itemsToProcess) {
      try {
        await this.executeOperation(item.operation);
        this.removeSyncQueueItem(item.id);
      } catch (error) {
        console.warn('Sync operation failed:', error);
        item.retryCount++;
        
        // 3回失敗したらキューから削除
        if (item.retryCount >= 3) {
          this.removeSyncQueueItem(item.id);
        }
      }
    }
    
    this.saveSyncQueue();
    this.updateLastSyncTime();
  }

  removeSyncQueueItem(itemId) {
    this.syncQueue = this.syncQueue.filter(item => item.id !== itemId);
  }

  async executeOperation(operation) {
    
    switch (operation.type) {
      case 'save':
        await storageManager.updateMindMap(operation.mindmapId, operation.data);
        break;
      case 'delete':
        await storageManager.deleteMindMap(operation.mindmapId);
        break;
      case 'create':
        await storageManager.createMindMap(operation.data);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  // 双方向同期（コンフリクト解決付き）
  async syncWithCloud() {
    if (!this.isOnline) {
      throw new Error('オフライン中は同期できません');
    }

    try {
      
      // 1. ローカルの変更をクラウドに送信
      await this.processSyncQueue();

      // 2. ローカルのすべてのマインドマップをクラウドに送信
      const localMaps = this.getAllMindMapsLocal();
      
      for (const map of localMaps) {
        // 無効なデータをスキップ
        if (!map.rootNode) {
          continue;
        }
        
        try {
          await storageManager.updateMindMap(map.id, map);
        } catch (updateError) {
          // 更新に失敗した場合は新規作成を試行
          try {
            const createResult = await storageManager.createMindMap(map);
          } catch (createError) {
            console.error('手動同期: マップ作成失敗', map.id, createError.message);
            throw createError; // エラーを再スロー
          }
        }
      }

      // 3. クラウドから最新データを取得
      const cloudMaps = await storageManager.getAllMindMaps();

      // 4. コンフリクト解決
      const resolvedMaps = this.resolveConflicts(localMaps, cloudMaps.mindmaps || []);

      // 5. ローカルストレージを更新
      this.saveToStorageLocal(STORAGE_KEYS.MINDMAPS, resolvedMaps);
      
      this.updateLastSyncTime();
      const conflicts = this.getConflictCount(localMaps, cloudMaps.mindmaps || []);
      
      return { 
        success: true, 
        conflicts: conflicts,
        localCount: localMaps.length,
        cloudCount: cloudMaps.mindmaps ? cloudMaps.mindmaps.length : 0
      };
      
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  // コンフリクト解決（最新の更新時刻を優先）
  resolveConflicts(localMaps, cloudMaps) {
    const mapById = new Map();
    
    // ローカルマップを追加
    localMaps.forEach(map => {
      mapById.set(map.id, { ...map, source: 'local' });
    });
    
    // クラウドマップとの比較・更新
    cloudMaps.forEach(cloudMap => {
      const localMap = mapById.get(cloudMap.id);
      
      if (!localMap) {
        // クラウドのみにある場合は追加（統一済みなので変換不要）
        mapById.set(cloudMap.id, { ...cloudMap, source: 'cloud' });
      } else {
        // 両方にある場合は更新時刻で判定
        const localTime = new Date(localMap.updatedAt);
        const cloudTime = new Date(cloudMap.updatedAt); // 統一済みなのでupdatedAtを使用
        
        if (cloudTime > localTime) {
          // 統一済みなので構造変換不要
          mapById.set(cloudMap.id, { ...cloudMap, source: 'cloud' });
        }
      }
    });
    
    return Array.from(mapById.values());
  }

  getConflictCount(localMaps, cloudMaps) {
    let conflicts = 0;
    const cloudMapIds = new Set(cloudMaps.map(m => m.id));
    
    localMaps.forEach(localMap => {
      const cloudMap = cloudMaps.find(m => m.id === localMap.id);
      if (cloudMap) {
        const localTime = new Date(localMap.updatedAt);
        const cloudTime = new Date(cloudMap.updatedAt); // 統一済みなのでupdatedAtを使用
        if (Math.abs(localTime - cloudTime) > 1000) { // 1秒以上の差があれば競合とみなす
          conflicts++;
        }
      }
    });
    
    return conflicts;
  }

  // クラウド専用操作のヘルパーメソッド
  getAllMindMapsLocal() {
    // Cloud mode: no local storage, return empty array
    console.log('☁️ Cloud mode: no local mindmaps storage');
    return [];
  }

  saveToStorageLocal(key, data) {
    // Cloud mode: no local storage operations
    console.log('☁️ Cloud mode: data not saved locally');
  }

  // 最終同期時刻の管理（クラウド専用）
  getLastSyncTime() {
    // Cloud mode: sync time stored in memory only
    console.log('🕒 Cloud mode: sync time from memory');
    return null;
  }

  updateLastSyncTime() {
    const now = new Date().toISOString();
    console.log('🕒 Last sync time updated:', now);
    this.lastSyncTime = now;
  }

  // 同期状態の取得
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      queueLength: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      needsSync: this.syncQueue.length > 0
    };
  }

  // 手動同期トリガー
  async forcSync() {
    return await this.syncWithCloud();
  }

  // オフライン操作の記録
  recordOfflineOperation(type, mindmapId, data = null) {
    this.addToSyncQueue({
      type,
      mindmapId,
      data
    });
  }
}

// シングルトンインスタンス
export const syncManager = new SyncManager();