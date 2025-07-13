// Cloud-specific IndexedDB utilities for Local architecture
import type { MindMapData } from '@shared/types';

interface CloudCacheMetadata {
  lastSync: string;
  version: number;
  isDirty: boolean; // ローカル変更があるかどうか
  userId: string;
}

interface CachedCloudMindMap extends MindMapData {
  _metadata: CloudCacheMetadata;
}

class CloudIndexedDB {
  private dbName = 'MindFlow-Cloud-Local';
  private version = 1;
  private db: IDBDatabase | null = null;
  
  private readonly STORES = {
    MINDMAPS: 'mindmaps',
    SYNC_QUEUE: 'syncQueue'
  } as const;

  // データベース初期化
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Cloud IndexedDB initialization failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Cloud IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // マインドマップストア
        if (!db.objectStoreNames.contains(this.STORES.MINDMAPS)) {
          const mindmapsStore = db.createObjectStore(this.STORES.MINDMAPS, { keyPath: 'id' });
          mindmapsStore.createIndex('userId', '_metadata.userId', { unique: false });
          mindmapsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          mindmapsStore.createIndex('isDirty', '_metadata.isDirty', { unique: false });
        }

        // 同期キューストア
        if (!db.objectStoreNames.contains(this.STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(this.STORES.SYNC_QUEUE, { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('operation', 'operation', { unique: false });
        }

        console.log('📋 Cloud IndexedDB schema upgraded');
      };
    });
  }

  // マインドマップを保存
  async saveMindMap(data: MindMapData, userId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const cachedData: CachedCloudMindMap = {
      ...data,
      _metadata: {
        lastSync: new Date().toISOString(),
        version: 1,
        isDirty: true,
        userId
      }
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readwrite');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.put(cachedData);

      request.onsuccess = () => {
        console.log('💾 Cloud IndexedDB: マインドマップ保存完了', { 
          id: data.id, 
          title: data.title,
          userId
        });
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: マインドマップ保存失敗', request.error);
        reject(request.error);
      };
    });
  }

  // マインドマップを取得
  async getMindMap(id: string): Promise<CachedCloudMindMap | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        console.log('📋 Cloud IndexedDB: マインドマップ取得', { 
          id, 
          found: !!result,
          isDirty: result?._metadata?.isDirty
        });
        resolve(result || null);
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: マインドマップ取得失敗', request.error);
        reject(request.error);
      };
    });
  }

  // ユーザーの全マインドマップを取得
  async getAllMindMaps(userId: string): Promise<CachedCloudMindMap[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const results = request.result || [];
        console.log('📋 Cloud IndexedDB: 全マインドマップ取得', { 
          count: results.length,
          userId
        });
        resolve(results);
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: 全マインドマップ取得失敗', request.error);
        reject(request.error);
      };
    });
  }

  // 同期完了をマーク（dirtyフラグをクリア）
  async markSynced(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readwrite');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data._metadata.isDirty = false;
          data._metadata.lastSync = new Date().toISOString();
          
          const putRequest = store.put(data);
          putRequest.onsuccess = () => {
            console.log('✅ Cloud IndexedDB: 同期完了マーク', { id });
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(); // データが存在しない場合はそのまま完了
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // 未同期データを取得
  async getDirtyMindMaps(): Promise<CachedCloudMindMap[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const index = store.index('isDirty');
      const request = index.getAll(IDBKeyRange.only(true));

      request.onsuccess = () => {
        const dirtyData = request.result || [];
        console.log('🔄 Cloud IndexedDB: 未同期データ取得', { 
          dirty: dirtyData.length
        });
        resolve(dirtyData);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // マインドマップを削除
  async deleteMindMap(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readwrite');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('🗑️ Cloud IndexedDB: マインドマップ削除完了', { id });
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: マインドマップ削除失敗', request.error);
        reject(request.error);
      };
    });
  }

  // データベースクリア（開発用）
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS, this.STORES.SYNC_QUEUE], 'readwrite');
      
      const clearMindmaps = transaction.objectStore(this.STORES.MINDMAPS).clear();
      const clearSyncQueue = transaction.objectStore(this.STORES.SYNC_QUEUE).clear();

      let completedStores = 0;
      const totalStores = 2;

      const checkCompletion = () => {
        completedStores++;
        if (completedStores === totalStores) {
          console.log('🗑️ Cloud IndexedDB: 全データクリア完了');
          resolve();
        }
      };

      clearMindmaps.onsuccess = checkCompletion;
      clearSyncQueue.onsuccess = checkCompletion;
      
      clearMindmaps.onerror = () => reject(clearMindmaps.error);
      clearSyncQueue.onerror = () => reject(clearSyncQueue.error);
    });
  }

  // 接続クローズ
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔌 Cloud IndexedDB connection closed');
    }
  }
}

// シングルトンインスタンス
export const cloudIndexedDB = new CloudIndexedDB();

// 便利な関数をエクスポート
export async function initCloudIndexedDB(): Promise<void> {
  return cloudIndexedDB.init();
}

export async function saveToCloudIndexedDB(data: MindMapData, userId: string): Promise<void> {
  return cloudIndexedDB.saveMindMap(data, userId);
}

export async function getFromCloudIndexedDB(id: string): Promise<CachedCloudMindMap | null> {
  return cloudIndexedDB.getMindMap(id);
}

export async function getAllFromCloudIndexedDB(userId: string): Promise<CachedCloudMindMap[]> {
  return cloudIndexedDB.getAllMindMaps(userId);
}

export async function markAsCloudSynced(id: string): Promise<void> {
  return cloudIndexedDB.markSynced(id);
}

export async function getCloudDirtyData(): Promise<CachedCloudMindMap[]> {
  return cloudIndexedDB.getDirtyMindMaps();
}

export async function deleteFromCloudIndexedDB(id: string): Promise<void> {
  return cloudIndexedDB.deleteMindMap(id);
}

export async function clearCloudIndexedDB(): Promise<void> {
  return cloudIndexedDB.clearAll();
}

export type { CachedCloudMindMap, CloudCacheMetadata };