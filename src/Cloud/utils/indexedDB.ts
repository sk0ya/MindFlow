// Cloud Mode IndexedDB Utility
// ローカルキャッシュとオフライン対応のためのIndexedDB管理

interface MindMapData {
  id: string;
  title: string;
  rootNode: any;
  createdAt?: string;
  updatedAt: string;
  userId?: string;
}

interface CacheMetadata {
  lastSync: string;
  version: number;
  isDirty: boolean; // ローカル変更があるかどうか
}

interface CachedMindMap extends MindMapData {
  _metadata: CacheMetadata;
}

class CloudIndexedDB {
  private dbName = 'MindFlow-Cloud';
  private version = 1;
  private db: IDBDatabase | null = null;
  
  private readonly STORES = {
    MINDMAPS: 'mindmaps'
  } as const;

  // データベース初期化
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB initialization failed:', request.error);
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
          mindmapsStore.createIndex('userId', 'userId', { unique: false });
          mindmapsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        console.log('📋 Cloud IndexedDB schema upgraded');
      };
    });
  }

  // マインドマップを保存
  async saveMindMap(data: MindMapData, userId?: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const cachedData: CachedMindMap = {
      ...data,
      userId: userId || 'anonymous',
      _metadata: {
        lastSync: new Date().toISOString(),
        version: 1,
        isDirty: true // ローカル変更として記録
      }
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readwrite');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.put(cachedData);

      request.onsuccess = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('💾 IndexedDB: マインドマップ保存完了', { 
            id: data.id, 
            title: data.title,
            isDirty: true
          });
        }
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: マインドマップ保存失敗', request.error);
        reject(request.error);
      };
    });
  }

  // マインドマップを取得
  async getMindMap(id: string): Promise<CachedMindMap | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (process.env.NODE_ENV === 'development') {
          console.log('📋 IndexedDB: マインドマップ取得', { 
            id, 
            found: !!result,
            isDirty: result?._metadata?.isDirty
          });
        }
        resolve(result || null);
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: マインドマップ取得失敗', request.error);
        reject(request.error);
      };
    });
  }

  // ユーザーの全マインドマップを取得
  async getAllMindMaps(userId?: string): Promise<CachedMindMap[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      
      let request: IDBRequest;
      if (userId) {
        const index = store.index('userId');
        request = index.getAll(userId);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        const results = request.result || [];
        if (process.env.NODE_ENV === 'development') {
          console.log('📋 IndexedDB: 全マインドマップ取得', { 
            count: results.length,
            userId
          });
        }
        resolve(results);
      };

      request.onerror = () => {
        console.error('❌ IndexedDB: 全マインドマップ取得失敗', request.error);
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
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ IndexedDB: 同期完了マーク', { id });
            }
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
  async getDirtyMindMaps(): Promise<CachedMindMap[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.getAll();

      request.onsuccess = () => {
        const allData = request.result || [];
        const dirtyData = allData.filter(item => item._metadata?.isDirty);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 IndexedDB: 未同期データ取得', { 
            total: allData.length,
            dirty: dirtyData.length
          });
        }
        resolve(dirtyData);
      };

      request.onerror = () => reject(request.error);
    });
  }



  // データベースクリア（開発用）
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readwrite');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('🗑️ IndexedDB: 全データクリア完了');
        resolve();
      };
      
      request.onerror = () => reject(request.error);
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

export async function saveToIndexedDB(data: MindMapData, userId?: string): Promise<void> {
  return cloudIndexedDB.saveMindMap(data, userId);
}

export async function getFromIndexedDB(id: string): Promise<CachedMindMap | null> {
  return cloudIndexedDB.getMindMap(id);
}

export async function getAllFromIndexedDB(userId?: string): Promise<CachedMindMap[]> {
  return cloudIndexedDB.getAllMindMaps(userId);
}

export async function markAsSynced(id: string): Promise<void> {
  return cloudIndexedDB.markSynced(id);
}

export async function getDirtyData(): Promise<CachedMindMap[]> {
  return cloudIndexedDB.getDirtyMindMaps();
}

export async function clearCloudIndexedDB(): Promise<void> {
  return cloudIndexedDB.clearAll();
}


export type { MindMapData, CachedMindMap, CacheMetadata };