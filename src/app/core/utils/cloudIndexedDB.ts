import type { MindMapData } from '@shared/types';

/**
 * クラウドモード専用のIndexedDBユーティリティ
 * ローカルモードとは完全に分離されたデータベースを使用
 */

export interface CloudCachedMindMap extends MindMapData {
  _metadata: {
    lastSync: string;
    version: number;
    isDirty: boolean;
    userId: string;
  };
}

class CloudIndexedDBManager {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'MindFlow-Cloud'; // ローカルとは異なるDB名
  private readonly version = 1;
  private readonly STORES = {
    CURRENT_MAP: 'currentMap',
    ALL_MAPS: 'allMaps'
  } as const;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: 初期化エラー', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Cloud IndexedDB: 初期化完了');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 現在のマップストア
        if (!db.objectStoreNames.contains(this.STORES.CURRENT_MAP)) {
          db.createObjectStore(this.STORES.CURRENT_MAP);
        }
        
        // 全マップストア
        if (!db.objectStoreNames.contains(this.STORES.ALL_MAPS)) {
          const store = db.createObjectStore(this.STORES.ALL_MAPS, { keyPath: 'id' });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('userId', '_metadata.userId', { unique: false });
        }
        
        console.log('🔧 Cloud IndexedDB: データベース構造作成完了');
      };
    });
  }

  // 現在のマップを保存
  async saveCurrentMap(data: CloudCachedMindMap): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.CURRENT_MAP], 'readwrite');
      const store = transaction.objectStore(this.STORES.CURRENT_MAP);
      const request = store.put(data, 'currentMap');

      request.onsuccess = () => {
        console.log('💾 Cloud IndexedDB: 現在のマップ保存完了', { 
          id: data.id, 
          title: data.title,
          userId: data._metadata.userId
        });
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: 現在のマップ保存失敗', request.error);
        reject(request.error);
      };
    });
  }

  // 現在のマップを取得
  async getCurrentMap(): Promise<CloudCachedMindMap | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.CURRENT_MAP], 'readonly');
      const store = transaction.objectStore(this.STORES.CURRENT_MAP);
      const request = store.get('currentMap');

      request.onsuccess = () => {
        const result = request.result;
        const mapData = result || null;
        console.log('📋 Cloud IndexedDB: 現在のマップ取得', { 
          found: !!mapData,
          title: mapData?.title,
          userId: mapData?._metadata?.userId
        });
        resolve(mapData);
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: 現在のマップ取得失敗', request.error);
        reject(request.error);
      };
    });
  }

  // マップをリストに保存
  async saveMindMapToList(data: CloudCachedMindMap): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.ALL_MAPS], 'readwrite');
      const store = transaction.objectStore(this.STORES.ALL_MAPS);
      const request = store.put(data);

      request.onsuccess = () => {
        console.log('💾 Cloud IndexedDB: マップリスト保存完了', { 
          id: data.id, 
          title: data.title,
          userId: data._metadata.userId
        });
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: マップリスト保存失敗', request.error);
        reject(request.error);
      };
    });
  }

  // 全マップを取得
  async getAllMindMaps(): Promise<CloudCachedMindMap[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.ALL_MAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.ALL_MAPS);
      const request = store.getAll();

      request.onsuccess = () => {
        const maps = request.result || [];
        console.log('📋 Cloud IndexedDB: 全マップ取得', { 
          count: maps.length,
          userIds: [...new Set(maps.map(m => m._metadata?.userId).filter(Boolean))]
        });
        resolve(maps);
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: 全マップ取得失敗', request.error);
        reject(request.error);
      };
    });
  }

  // マップをリストから削除
  async removeMindMapFromList(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.ALL_MAPS], 'readwrite');
      const store = transaction.objectStore(this.STORES.ALL_MAPS);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('🗑️ Cloud IndexedDB: マップ削除完了', { id });
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: マップ削除失敗', request.error);
        reject(request.error);
      };
    });
  }

  // データベース全体をクリア
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.CURRENT_MAP, this.STORES.ALL_MAPS], 'readwrite');
      
      transaction.objectStore(this.STORES.CURRENT_MAP).clear();
      transaction.objectStore(this.STORES.ALL_MAPS).clear();

      transaction.oncomplete = () => {
        console.log('🧹 Cloud IndexedDB: 全データクリア完了');
        resolve();
      };

      transaction.onerror = () => {
        console.error('❌ Cloud IndexedDB: データクリア失敗', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // ユーザー専用のマップを取得
  async getUserMaps(userId: string): Promise<CloudCachedMindMap[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.ALL_MAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.ALL_MAPS);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const maps = request.result || [];
        console.log('📋 Cloud IndexedDB: ユーザーマップ取得', { 
          userId,
          count: maps.length
        });
        resolve(maps);
      };

      request.onerror = () => {
        console.error('❌ Cloud IndexedDB: ユーザーマップ取得失敗', request.error);
        reject(request.error);
      };
    });
  }
}

// シングルトンインスタンス
const cloudIndexedDB = new CloudIndexedDBManager();

// エクスポート関数
export async function initCloudIndexedDB(): Promise<void> {
  return cloudIndexedDB.init();
}

export async function saveCurrentMapToCloudIndexedDB(data: CloudCachedMindMap): Promise<void> {
  return cloudIndexedDB.saveCurrentMap(data);
}

export async function getCurrentMapFromCloudIndexedDB(): Promise<CloudCachedMindMap | null> {
  return cloudIndexedDB.getCurrentMap();
}

export async function saveMindMapToCloudIndexedDB(data: CloudCachedMindMap): Promise<void> {
  return cloudIndexedDB.saveMindMapToList(data);
}

export async function getAllMindMapsFromCloudIndexedDB(): Promise<CloudCachedMindMap[]> {
  return cloudIndexedDB.getAllMindMaps();
}

export async function removeMindMapFromCloudIndexedDB(id: string): Promise<void> {
  return cloudIndexedDB.removeMindMapFromList(id);
}

export async function clearCloudIndexedDB(): Promise<void> {
  return cloudIndexedDB.clearAll();
}

export async function getUserMapsFromCloudIndexedDB(userId: string): Promise<CloudCachedMindMap[]> {
  return cloudIndexedDB.getUserMaps(userId);
}