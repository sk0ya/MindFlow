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

      // 2. ローカルのすべてのマインドマップをクラウドに送信
      const localMaps = this.getAllMindMapsLocal();
      console.log('手動同期: ローカルマップ数', localMaps.length);
      
      for (const map of localMaps) {
        try {
          console.log('手動同期: マップを送信中', map.id, map.title);
          await cloudStorage.updateMindMap(map.id, map);
          console.log('手動同期: マップ送信成功', map.id);
        } catch (updateError) {
          // 更新に失敗した場合は新規作成を試行
          console.log('手動同期: 更新失敗、新規作成を試行', map.id, updateError.message);
          try {
            const createResult = await cloudStorage.createMindMap(map);
            console.log('手動同期: マップ作成成功', map.id, createResult);
          } catch (createError) {
            console.error('手動同期: マップ作成失敗', map.id, createError.message);
            throw createError; // エラーを再スロー
          }
        }
      }

      // 3. クラウドから最新データを取得
      const cloudMaps = await cloudStorage.getAllMindMaps();
      console.log('手動同期: クラウドマップ数', cloudMaps.mindmaps ? cloudMaps.mindmaps.length : 0);

      // 4. コンフリクト解決
      const resolvedMaps = this.resolveConflicts(localMaps, cloudMaps.mindmaps || []);

      // 5. ローカルストレージを更新
      this.saveToStorageLocal(STORAGE_KEYS.MINDMAPS, resolvedMaps);
      
      this.updateLastSyncTime();
      const conflicts = this.getConflictCount(localMaps, cloudMaps.mindmaps || []);
      console.log('手動同期完了: 競合数', conflicts);
      
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
        // クラウドのみにある場合は追加（データ構造を変換）
        const transformedCloudMap = {
          ...cloudMap,
          ...(cloudMap.data || {}), // dataフィールドが存在する場合は展開
          updatedAt: cloudMap.updated_at || cloudMap.updatedAt,
          source: 'cloud'
        };
        // dataフィールドは不要なので削除
        delete transformedCloudMap.data;
        mapById.set(cloudMap.id, transformedCloudMap);
      } else {
        // 両方にある場合は更新時刻で判定
        const localTime = new Date(localMap.updatedAt);
        const cloudTime = new Date(cloudMap.updated_at || cloudMap.updatedAt);
        
        if (cloudTime > localTime) {
          // クラウドデータの構造を正しく変換
          const transformedCloudMap = {
            ...cloudMap,
            ...(cloudMap.data || {}), // dataフィールドが存在する場合は展開
            updatedAt: cloudMap.updated_at || cloudMap.updatedAt,
            source: 'cloud'
          };
          // dataフィールドは不要なので削除
          delete transformedCloudMap.data;
          mapById.set(cloudMap.id, transformedCloudMap);
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