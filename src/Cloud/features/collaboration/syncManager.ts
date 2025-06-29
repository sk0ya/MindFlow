// オフライン対応とデータ同期管理

import { STORAGE_KEYS } from '../../shared/types/dataTypes.js';
import type { MindMapData } from '../../core/storage/types.js';
import { storageManager } from '../../core/storage/StorageManager.js';

// 型定義
export interface SyncQueueItem {
  id: string;
  timestamp: string;
  operation: SyncOperation;
  retryCount: number;
}

export interface SyncOperation {
  type: 'save' | 'delete' | 'create';
  mindmapId: string;
  data?: MindMapData | null;
}

export interface SyncStatus {
  isOnline: boolean;
  queueLength: number;
  lastSyncTime: string | number | null;
  needsSync: boolean;
}

export interface SyncResult {
  success: boolean;
  conflicts: number;
  localCount: number;
  cloudCount: number;
}

export interface CloudMapsResponse {
  mindmaps?: MindMapData[];
}

class SyncManager {
  isOnline: boolean;
  syncQueue: SyncQueueItem[];
  lastSyncTime: string | number | null;
  
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

  addToSyncQueue(operation: SyncOperation): void {
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
  async processSyncQueue(): Promise<void> {
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

  removeSyncQueueItem(itemId: string): void {
    this.syncQueue = this.syncQueue.filter(item => item.id !== itemId);
  }

  async executeOperation(operation: SyncOperation): Promise<void> {
    
    switch (operation.type) {
      case 'save':
        if (operation.data) {
          await storageManager.updateMindMap(operation.mindmapId, operation.data);
        }
        break;
      case 'delete':
        await storageManager.deleteMindMap(operation.mindmapId);
        break;
      case 'create':
        if (operation.data) {
          await storageManager.createMindMap(operation.data);
        }
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  // 双方向同期（コンフリクト解決付き）
  async syncWithCloud(): Promise<SyncResult> {
    if (!this.isOnline) {
      throw new Error('オフライン中は同期できません');
    }

    try {
      
      // 1. ローカルの変更をクラウドに送信
      await this.processSyncQueue();

      // 2. ローカルのすべてのマインドマップをクラウドに送信
      const localMaps: MindMapData[] = this.getAllMindMapsLocal();
      
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
            await storageManager.createMindMap(map);
          } catch (createError) {
            console.error('手動同期: マップ作成失敗', map.id, createError.message);
            throw createError; // エラーを再スロー
          }
        }
      }

      // 3. クラウドから最新データを取得
      const cloudMaps: CloudMapsResponse = await storageManager.getAllMindMaps();

      // 4. コンフリクト解決
      const cloudMapsArray: MindMapData[] = cloudMaps?.mindmaps || [];
      const resolvedMaps: MindMapData[] = this.resolveConflicts(localMaps, cloudMapsArray);

      // 5. ローカルストレージを更新
      this.saveToStorageLocal(STORAGE_KEYS.MINDMAPS, resolvedMaps);
      
      this.updateLastSyncTime();
      const conflicts: number = this.getConflictCount(localMaps, cloudMapsArray);
      
      return { 
        success: true, 
        conflicts: conflicts,
        localCount: localMaps.length,
        cloudCount: cloudMapsArray.length
      };
      
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  // コンフリクト解決（最新の更新時刻を優先）
  resolveConflicts(localMaps: MindMapData[], cloudMaps: MindMapData[]): MindMapData[] {
    const mapById = new Map<string, MindMapData & { source: 'local' | 'cloud' }>();
    
    // ローカルマップを追加
    localMaps.forEach((map: MindMapData) => {
      mapById.set(map.id, { ...map, source: 'local' });
    });
    
    // クラウドマップとの比較・更新
    cloudMaps.forEach((cloudMap: MindMapData) => {
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

  getConflictCount(localMaps: MindMapData[], cloudMaps: MindMapData[]): number {
    let conflicts = 0;
    
    localMaps.forEach((localMap: MindMapData) => {
      const cloudMap = cloudMaps.find((m: MindMapData) => m.id === localMap.id);
      if (cloudMap) {
        const localTime = new Date(localMap.updatedAt);
        const cloudTime = new Date(cloudMap.updatedAt); // 統一済みなのでupdatedAtを使用
        if (Math.abs(localTime.getTime() - cloudTime.getTime()) > 1000) { // 1秒以上の差があれば競合とみなす
          conflicts++;
        }
      }
    });
    
    return conflicts;
  }

  // クラウド専用操作のヘルパーメソッド
  getAllMindMapsLocal(): MindMapData[] {
    // Cloud mode: no local storage, return empty array
    console.log('☁️ Cloud mode: no local mindmaps storage');
    return [];
  }

  saveToStorageLocal(_key: string, _data: any): void {
    // Cloud mode: no local storage operations
    console.log('☁️ Cloud mode: data not saved locally');
  }

  // 最終同期時刻の管理（クラウド専用）
  getLastSyncTime(): string | number | null {
    // Cloud mode: sync time stored in memory only
    console.log('🕒 Cloud mode: sync time from memory');
    return null;
  }

  updateLastSyncTime(): void {
    const now = new Date().toISOString();
    console.log('🕒 Last sync time updated:', now);
    this.lastSyncTime = now;
  }

  // 同期状態の取得
  getSyncStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      queueLength: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      needsSync: this.syncQueue.length > 0
    };
  }

  // 手動同期トリガー
  async forcSync(): Promise<SyncResult> {
    return await this.syncWithCloud();
  }

  // オフライン操作の記録
  recordOfflineOperation(type: 'save' | 'delete' | 'create', mindmapId: string, data: MindMapData | null = null): void {
    this.addToSyncQueue({
      type,
      mindmapId,
      data: data
    });
  }
}

// シングルトンインスタンス
export const syncManager = new SyncManager();