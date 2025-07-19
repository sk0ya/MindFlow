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

  // マインドマップを保存（読み取り専用 - indexedDB.tsで実装）
  async saveMindMap(_data: MindMapData, _userId: string): Promise<void> {
    console.warn('⚠️ CloudIndexedDB書き込み無効: indexedDB.tsを使用してください');
    throw new Error('CloudIndexedDB write operations disabled. Use indexedDB.ts instead.');
  }

  // マインドマップを取得
  async getMindMap(id: string): Promise<CachedCloudMindMap | null> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Failed to initialize Cloud IndexedDB');
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

    if (!this.db) {
      throw new Error('Failed to initialize Cloud IndexedDB');
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

  // 同期完了をマーク（読み取り専用 - indexedDB.tsで実装）
  async markSynced(_id: string): Promise<void> {
    console.warn('⚠️ CloudIndexedDB書き込み無効: indexedDB.tsを使用してください');
    throw new Error('CloudIndexedDB write operations disabled. Use indexedDB.ts instead.');
  }

  // 未同期データを取得
  async getDirtyMindMaps(): Promise<CachedCloudMindMap[]> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('Failed to initialize Cloud IndexedDB');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORES.MINDMAPS], 'readonly');
      const store = transaction.objectStore(this.STORES.MINDMAPS);
      const request = store.getAll();

      request.onsuccess = () => {
        const allData = request.result || [];
        // Filter for dirty data manually
        const dirtyData = allData.filter((item: CachedCloudMindMap) => 
          item._metadata && item._metadata.isDirty === true
        );
        console.log('🔄 Cloud IndexedDB: 未同期データ取得', { 
          total: allData.length,
          dirty: dirtyData.length
        });
        resolve(dirtyData);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // マインドマップを削除（読み取り専用 - indexedDB.tsで実装）
  async deleteMindMap(_id: string): Promise<void> {
    console.warn('⚠️ CloudIndexedDB書き込み無効: indexedDB.tsを使用してください');
    throw new Error('CloudIndexedDB write operations disabled. Use indexedDB.ts instead.');
  }

  // データベースクリア（読み取り専用 - indexedDB.tsで実装）
  async clearAll(): Promise<void> {
    console.warn('⚠️ CloudIndexedDB書き込み無効: indexedDB.tsを使用してください');
    throw new Error('CloudIndexedDB write operations disabled. Use indexedDB.ts instead.');
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

export async function saveToCloudIndexedDB(_data: MindMapData, _userId: string): Promise<void> {
  console.warn('⚠️ CloudIndexedDB書き込み無効: indexedDB.tsを使用してください');
  throw new Error('CloudIndexedDB write operations disabled. Use indexedDB.ts instead.');
}

export async function getFromCloudIndexedDB(id: string): Promise<CachedCloudMindMap | null> {
  return cloudIndexedDB.getMindMap(id);
}

export async function getAllFromCloudIndexedDB(userId: string): Promise<CachedCloudMindMap[]> {
  return cloudIndexedDB.getAllMindMaps(userId);
}

export async function markAsCloudSynced(_id: string): Promise<void> {
  console.warn('⚠️ CloudIndexedDB書き込み無効: indexedDB.tsを使用してください');
  throw new Error('CloudIndexedDB write operations disabled. Use indexedDB.ts instead.');
}

export async function getCloudDirtyData(): Promise<CachedCloudMindMap[]> {
  return cloudIndexedDB.getDirtyMindMaps();
}

export async function deleteFromCloudIndexedDB(_id: string): Promise<void> {
  console.warn('⚠️ CloudIndexedDB書き込み無効: indexedDB.tsを使用してください');
  throw new Error('CloudIndexedDB write operations disabled. Use indexedDB.ts instead.');
}

export async function clearCloudIndexedDB(): Promise<void> {
  console.warn('⚠️ CloudIndexedDB書き込み無効: indexedDB.tsを使用してください');
  throw new Error('CloudIndexedDB write operations disabled. Use indexedDB.ts instead.');
}

export type { CachedCloudMindMap, CloudCacheMetadata };