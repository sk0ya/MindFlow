// オフライン対応とデータ同期管理

import { STORAGE_KEYS } from './dataTypes.js';

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

  // 同期キューの管理
  loadSyncQueue() {
    try {
      const item = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error('Sync queue load error:', error);
      return [];
    }
  }

  saveSyncQueue() {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Sync queue save error:', error);
    }
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
    const { cloudStorage } = await import('./cloudStorage.js');
    
    switch (operation.type) {
      case 'save':
        await cloudStorage.updateMindMap(operation.mindmapId, operation.data);
        break;
      case 'delete':
        await cloudStorage.deleteMindMap(operation.mindmapId);
        break;
      case 'create':
        await cloudStorage.createMindMap(operation.data);
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
      const { cloudStorage } = await import('./cloudStorage.js');
      
      // 1. ローカルの変更をクラウドに送信
      await this.processSyncQueue();

      // 2. クラウドから最新データを取得
      const cloudMaps = await cloudStorage.getAllMindMaps();
      const localMaps = this.getAllMindMapsLocal();

      // 3. コンフリクト解決
      const resolvedMaps = this.resolveConflicts(localMaps, cloudMaps.mindmaps || []);

      // 4. ローカルストレージを更新
      this.saveToStorageLocal(STORAGE_KEYS.MINDMAPS, resolvedMaps);
      
      this.updateLastSyncTime();
      return { success: true, conflicts: this.getConflictCount(localMaps, cloudMaps.mindmaps || []) };
      
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
        // クラウドのみにある場合は追加
        mapById.set(cloudMap.id, { ...cloudMap, source: 'cloud' });
      } else {
        // 両方にある場合は更新時刻で判定
        const localTime = new Date(localMap.updatedAt);
        const cloudTime = new Date(cloudMap.updated_at || cloudMap.updatedAt);
        
        if (cloudTime > localTime) {
          mapById.set(cloudMap.id, { 
            ...cloudMap, 
            updatedAt: cloudMap.updated_at || cloudMap.updatedAt,
            source: 'cloud' 
          });
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
        const cloudTime = new Date(cloudMap.updated_at || cloudMap.updatedAt);
        if (Math.abs(localTime - cloudTime) > 1000) { // 1秒以上の差があれば競合とみなす
          conflicts++;
        }
      }
    });
    
    return conflicts;
  }

  // ローカルストレージ操作のヘルパーメソッド
  getAllMindMapsLocal() {
    try {
      const item = localStorage.getItem(STORAGE_KEYS.MINDMAPS);
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error('Local mindmaps load error:', error);
      return [];
    }
  }

  saveToStorageLocal(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Local storage save error:', error);
    }
  }

  // 最終同期時刻の管理
  getLastSyncTime() {
    try {
      const item = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Last sync time load error:', error);
      return null;
    }
  }

  updateLastSyncTime() {
    const now = new Date().toISOString();
    this.saveToStorageLocal(STORAGE_KEYS.LAST_SYNC_TIME, now);
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