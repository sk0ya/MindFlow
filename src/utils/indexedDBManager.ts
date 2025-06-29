/**
 * IndexedDBManager - ローカルデータストレージとCloud同期のためのIndexedDB管理
 */

export interface MindMapIndexedData {
  id: string;
  title: string;
  rootNode: any;
  settings: {
    autoSave: boolean;
    autoLayout: boolean;
  };
  lastModified: number;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
  cloudVersion?: number;
  localVersion: number;
  userId?: string;
}

export interface SyncOperation {
  id: string;
  mapId: string;
  operation: 'create' | 'update' | 'delete' | 'node_create' | 'node_update' | 'node_delete' | 'node_move';
  data: any;
  timestamp: number;
  retry_count: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

export class IndexedDBManager {
  private dbName = 'mindflow_cloud';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  /**
   * データベースを初期化
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB初期化エラー:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB初期化完了');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // マインドマップデータストア
        if (!db.objectStoreNames.contains('mindmaps')) {
          const mindmapStore = db.createObjectStore('mindmaps', { keyPath: 'id' });
          mindmapStore.createIndex('userId', 'userId', { unique: false });
          mindmapStore.createIndex('lastModified', 'lastModified', { unique: false });
          mindmapStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // 同期待ちオペレーションストア
        if (!db.objectStoreNames.contains('sync_operations')) {
          const syncStore = db.createObjectStore('sync_operations', { keyPath: 'id' });
          syncStore.createIndex('mapId', 'mapId', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('status', 'status', { unique: false });
        }

        // 同期設定・メタデータストア
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', { keyPath: 'key' });
        }

        console.log('🔄 IndexedDBスキーマアップグレード完了');
      };
    });
  }

  /**
   * マインドマップを保存
   */
  async saveMindMap(data: MindMapIndexedData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['mindmaps'], 'readwrite');
      const store = transaction.objectStore('mindmaps');

      const dataToSave = {
        ...data,
        lastModified: Date.now(),
        localVersion: (data.localVersion || 0) + 1
      };

      const request = store.put(dataToSave);

      request.onsuccess = () => {
        console.log(`📝 マインドマップ保存完了: ${data.id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('マインドマップ保存エラー:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * マインドマップを取得
   */
  async getMindMap(id: string): Promise<MindMapIndexedData | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['mindmaps'], 'readonly');
      const store = transaction.objectStore('mindmaps');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('マインドマップ取得エラー:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * ユーザーの全マインドマップを取得
   */
  async getAllMindMaps(userId?: string): Promise<MindMapIndexedData[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['mindmaps'], 'readonly');
      const store = transaction.objectStore('mindmaps');
      
      let request: IDBRequest;
      if (userId) {
        const index = store.index('userId');
        request = index.getAll(userId);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        const results = request.result.sort((a, b) => b.lastModified - a.lastModified);
        resolve(results);
      };

      request.onerror = () => {
        console.error('マインドマップ一覧取得エラー:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * マインドマップを削除
   */
  async deleteMindMap(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['mindmaps'], 'readwrite');
      const store = transaction.objectStore('mindmaps');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`🗑️ マインドマップ削除完了: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('マインドマップ削除エラー:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 同期オペレーションを追加
   */
  async addSyncOperation(operation: Omit<SyncOperation, 'id' | 'retry_count' | 'status'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const syncOp: SyncOperation = {
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retry_count: 0,
      status: 'pending'
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_operations'], 'readwrite');
      const store = transaction.objectStore('sync_operations');
      const request = store.add(syncOp);

      request.onsuccess = () => {
        console.log(`⏳ 同期オペレーション追加: ${syncOp.operation} for ${syncOp.mapId}`);
        resolve();
      };

      request.onerror = () => {
        console.error('同期オペレーション追加エラー:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 未完了の同期オペレーションを取得
   */
  async getPendingSyncOperations(): Promise<SyncOperation[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_operations'], 'readonly');
      const store = transaction.objectStore('sync_operations');
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        const results = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(results);
      };

      request.onerror = () => {
        console.error('未完了同期オペレーション取得エラー:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 同期オペレーションのステータスを更新
   */
  async updateSyncOperation(id: string, updates: Partial<SyncOperation>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_operations'], 'readwrite');
      const store = transaction.objectStore('sync_operations');
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existingOp = getRequest.result;
        if (!existingOp) {
          reject(new Error(`同期オペレーションが見つかりません: ${id}`));
          return;
        }

        const updatedOp = { ...existingOp, ...updates };
        const putRequest = store.put(updatedOp);

        putRequest.onsuccess = () => {
          resolve();
        };

        putRequest.onerror = () => {
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * 完了した同期オペレーションを削除
   */
  async deleteSyncOperation(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_operations'], 'readwrite');
      const store = transaction.objectStore('sync_operations');
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 同期メタデータを保存
   */
  async setSyncMetadata(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_metadata'], 'readwrite');
      const store = transaction.objectStore('sync_metadata');
      const request = store.put({ key, value, updatedAt: Date.now() });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 同期メタデータを取得
   */
  async getSyncMetadata(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sync_metadata'], 'readonly');
      const store = transaction.objectStore('sync_metadata');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 同期待ちのマインドマップを取得
   */
  async getMapsNeedingSync(): Promise<MindMapIndexedData[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['mindmaps'], 'readonly');
      const store = transaction.objectStore('mindmaps');
      const index = store.index('syncStatus');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * データベースをクリア（開発用）
   */
  async clearDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['mindmaps', 'sync_operations', 'sync_metadata'], 'readwrite');
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('mindmaps').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('sync_operations').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('sync_metadata').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);

    console.log('🧹 IndexedDBクリア完了');
  }

  /**
   * データベース接続を閉じる
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔒 IndexedDB接続クローズ');
    }
  }
}

// シングルトンインスタンス
export const indexedDBManager = new IndexedDBManager();