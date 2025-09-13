/**
 * IndexedDB操作のベースクラス
 * LocalとCloudの共通ロジックを抽象化
 */

import type { MindMapData } from '../../../shared/types';
import { logger } from '../../shared/utils/logger';

export interface IndexedDBMetadata {
  lastModified?: string;
  lastSync?: string;
  version: number;
  isDirty?: boolean;
  userId?: string;
}

export interface CachedMindMap extends MindMapData {
  _metadata: IndexedDBMetadata;
}

export interface StoreDefinition {
  name: string;
  keyPath?: string | string[];
  indexes?: {
    name: string;
    keyPath: string | string[];
    options?: IDBIndexParameters;
  }[];
}

/**
 * IndexedDBの基底クラス
 */
export abstract class IndexedDBBase<T extends CachedMindMap> {
  protected db: IDBDatabase | null = null;
  protected abstract readonly dbName: string;
  protected abstract readonly version: number;
  protected abstract readonly stores: Record<string, StoreDefinition>;

  /**
   * データベースを初期化
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        logger.error(`IndexedDB ${this.dbName}: 初期化エラー`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info(`IndexedDB ${this.dbName}: 初期化完了`);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
        logger.info(`IndexedDB ${this.dbName}: データベース構造作成完了`);
      };
    });
  }

  /**
   * ストア作成（サブクラスでカスタマイズ可能）
   */
  protected createStores(db: IDBDatabase): void {
    for (const [, storeDefinition] of Object.entries(this.stores)) {
      if (!db.objectStoreNames.contains(storeDefinition.name)) {
        const store = db.createObjectStore(
          storeDefinition.name, 
          storeDefinition.keyPath ? { keyPath: storeDefinition.keyPath } : undefined
        );

        // インデックス作成
        if (storeDefinition.indexes) {
          storeDefinition.indexes.forEach(index => {
            store.createIndex(index.name, index.keyPath, index.options);
          });
        }
      }
    }
  }

  /**
   * データベースが初期化されているかチェック
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error(`Failed to initialize IndexedDB: ${this.dbName}`);
    }
  }

  /**
   * 汎用データ保存メソッド
   */
  protected async saveData<T>(storeName: string, data: T, key?: IDBValidKey): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = key !== undefined ? store.put(data, key as IDBValidKey) : store.put(data);

      request.onsuccess = () => {
        logger.debug(`IndexedDB ${this.dbName}: データ保存完了`, { 
          store: storeName,
          id: (data as any)?.id || 'no-id'
        });
        resolve();
      };

      request.onerror = () => {
        logger.error(`IndexedDB ${this.dbName}: データ保存失敗`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 汎用データ取得メソッド
   */
  protected async getData<R>(storeName: string, key?: IDBValidKey): Promise<R | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = key !== undefined ? store.get(key) : store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        logger.debug(`IndexedDB ${this.dbName}: データ取得完了`, { 
          store: storeName,
          found: !!result,
          key
        });
        resolve(result || null);
      };

      request.onerror = () => {
        logger.error(`IndexedDB ${this.dbName}: データ取得失敗`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 汎用データ削除メソッド
   */
  protected async deleteData(storeName: string, key: IDBValidKey): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        logger.debug(`IndexedDB ${this.dbName}: データ削除完了`, { 
          store: storeName, 
          key 
        });
        resolve();
      };

      request.onerror = () => {
        logger.error(`IndexedDB ${this.dbName}: データ削除失敗`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * ストア全体をクリア
   */
  protected async clearStore(storeName: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        logger.debug(`IndexedDB ${this.dbName}: ストアクリア完了`, { store: storeName });
        resolve();
      };

      request.onerror = () => {
        logger.error(`IndexedDB ${this.dbName}: ストアクリア失敗`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * インデックスを使ったデータ取得
   */
  protected async getDataByIndex<R>(storeName: string, indexName: string, value: IDBValidKey): Promise<R[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => {
        const results = request.result || [];
        logger.debug(`IndexedDB ${this.dbName}: インデックス検索完了`, { 
          store: storeName,
          index: indexName,
          value,
          count: results.length
        });
        resolve(results);
      };

      request.onerror = () => {
        logger.error(`IndexedDB ${this.dbName}: インデックス検索失敗`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * データベース全体をクリア
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    const storeNames = Object.values(this.stores).map(store => store.name);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeNames, 'readwrite');
      
      let completedStores = 0;
      const totalStores = storeNames.length;

      const checkCompletion = () => {
        completedStores++;
        if (completedStores === totalStores) {
          logger.debug(`IndexedDB ${this.dbName}: 全データクリア完了`);
          resolve();
        }
      };

      storeNames.forEach(storeName => {
        const clearRequest = transaction.objectStore(storeName).clear();
        clearRequest.onsuccess = checkCompletion;
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      if (totalStores === 0) {
        resolve();
      }
    });
  }

  /**
   * 接続クローズ
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.debug(`IndexedDB ${this.dbName}: 接続クローズ`);
    }
  }

  // 抽象メソッド：サブクラスで実装必須
  abstract createMetadata(data: MindMapData, additionalMetadata?: Partial<IndexedDBMetadata>): T;
}