// Local Mode IndexedDB Utility
// LocalStorageの代替としてIndexedDBを使用してパフォーマンスと容量を改善

import type { MindMapData } from '@shared/types';

interface LocalCacheMetadata {
  lastModified: string;
  version: number;
}

interface CachedLocalMindMap extends MindMapData {
  _metadata: LocalCacheMetadata;
}

class LocalIndexedDB {
  private dbName = 'MindFlow-Local';
  private version = 1;
  private db: IDBDatabase | null = null;
  
  private readonly STORES = {
    MINDMAPS: 'mindmaps',
    CURRENT_MAP: 'currentMap'
  } as const;

  // データベース初期化
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Local IndexedDB initialization failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Local IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // マインドマップリストストア
        if (!db.objectStoreNames.contains(this.STORES.MINDMAPS)) {
          const mindmapsStore = db.createObjectStore(this.STORES.MINDMAPS, { keyPath: 'id' });
          mindmapsStore.createIndex('title', 'title', { unique: false });
          mindmapsStore.createIndex('lastModified', '_metadata.lastModified', { unique: false });
        }

        // 現在のマップストア（単一レコード）
        if (!db.objectStoreNames.contains(this.STORES.CURRENT_MAP)) {
          db.createObjectStore(this.STORES.CURRENT_MAP, { keyPath: 'key' });
        }

        console.log('📋 Local IndexedDB schema upgraded');
      };
    });
  }

  // 現在のマインドマップを保存
  async saveCurrentMap(data: MindMapData): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }

    const cachedData: CachedLocalMindMap = {
      ...data,
      _metadata: {
        lastModified: new Date().toISOString(),
        version: 1
      }
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.CURRENT_MAP], 'readwrite');
      const store = transaction.objectStore(this.STORES.CURRENT_MAP);
      const request = store.put({ key: 'currentMap', data: cachedData });

      request.onsuccess = () => {
        console.log('💾 IndexedDB: 現在のマップ保存完了', { 
          id: data.id, 
          title: data.title 
        });
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: 現在のマップ保存失敗', request.error);
        reject(request.error);
      };
    });
  }

  // 現在のマインドマップを取得
  async getCurrentMap(): Promise<CachedLocalMindMap | null> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.CURRENT_MAP], 'readonly');
      const store = transaction.objectStore(this.STORES.CURRENT_MAP);
      const request = store.get('currentMap');

      request.onsuccess = () => {
        const result = request.result;
        const mapData = result?.data || null;
        console.log('📋 IndexedDB: 現在のマップ取得', { 
          found: !!mapData,
          id: mapData?.id
        });
        resolve(mapData);
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: 現在のマップ取得失敗', request.error);
        reject(request.error);
      };
    });
  }

  // マインドマップをリストに保存
  async saveMindMapToList(data: MindMapData): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }

    const cachedData: CachedLocalMindMap = {
      ...data,
      _metadata: {
        lastModified: new Date().toISOString(),
        version: 1
      }
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readwrite');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.put(cachedData);

      request.onsuccess = () => {
        console.log('💾 IndexedDB: マップをリストに保存', { 
          id: data.id, 
          title: data.title
        });
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: マップリスト保存失敗', request.error);
        reject(request.error);
      };
    });
  }

  // 全マインドマップを取得
  async getAllMindMaps(): Promise<CachedLocalMindMap[]> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        console.log('📋 IndexedDB: 全マップ取得', { count: results.length });
        resolve(results);
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: 全マップ取得失敗', request.error);
        reject(request.error);
      };
    });
  }

  // マインドマップをリストから削除
  async removeMindMapFromList(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readwrite');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('🗑️ IndexedDB: マップをリストから削除', { id });
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: マップ削除失敗', request.error);
        reject(request.error);
      };
    });
  }

  // データベースクリア（開発用）
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS, this.STORES.CURRENT_MAP], 'readwrite');
      
      const clearMindmaps = transaction.objectStore(this.STORES.MINDMAPS).clear();
      const clearCurrentMap = transaction.objectStore(this.STORES.CURRENT_MAP).clear();

      let completedStores = 0;
      const totalStores = 2;

      const checkCompletion = () => {
        completedStores++;
        if (completedStores === totalStores) {
          console.log('🗑️ Local IndexedDB: 全データクリア完了');
          resolve();
        }
      };

      clearMindmaps.onsuccess = checkCompletion;
      clearCurrentMap.onsuccess = checkCompletion;
      
      clearMindmaps.onerror = () => reject(clearMindmaps.error);
      clearCurrentMap.onerror = () => reject(clearCurrentMap.error);
    });
  }

  // 接続クローズ
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔌 Local IndexedDB connection closed');
    }
  }
}

// シングルトンインスタンス
export const localIndexedDB = new LocalIndexedDB();

// 便利な関数をエクスポート
export async function initLocalIndexedDB(): Promise<void> {
  return localIndexedDB.init();
}

export async function saveCurrentMapToIndexedDB(data: MindMapData): Promise<void> {
  return localIndexedDB.saveCurrentMap(data);
}

export async function getCurrentMapFromIndexedDB(): Promise<CachedLocalMindMap | null> {
  return localIndexedDB.getCurrentMap();
}

export async function saveMindMapToIndexedDB(data: MindMapData): Promise<void> {
  return localIndexedDB.saveMindMapToList(data);
}

export async function getAllMindMapsFromIndexedDB(): Promise<CachedLocalMindMap[]> {
  return localIndexedDB.getAllMindMaps();
}

export async function removeMindMapFromIndexedDB(id: string): Promise<void> {
  return localIndexedDB.removeMindMapFromList(id);
}

export async function clearLocalIndexedDB(): Promise<void> {
  return localIndexedDB.clearAll();
}

export type { CachedLocalMindMap, LocalCacheMetadata };