/**
 * Cloud Mode IndexedDB Manager
 * ベースクラスを使用してクラウドモード専用の実装を提供
 */

import type { MindMapData } from '../../../shared/types';
import { IndexedDBBase, type CachedMindMap, type IndexedDBMetadata, type StoreDefinition } from './indexedDBBase';

interface CloudCacheMetadata extends IndexedDBMetadata {
  lastSync: string;
  version: number;
  isDirty: boolean;
  userId: string;
}

export interface CloudCachedMindMap extends CachedMindMap {
  _metadata: CloudCacheMetadata;
}

/**
 * クラウドモード用IndexedDBマネージャー
 */
class CloudIndexedDBManager extends IndexedDBBase<CloudCachedMindMap> {
  protected readonly dbName = 'MindFlow-Cloud';
  protected readonly version = 1;
  
  protected readonly stores: Record<string, StoreDefinition> = {
    CURRENT_MAP: {
      name: 'currentMap',
      keyPath: undefined // キーを明示的に指定
    },
    ALL_MAPS: {
      name: 'allMaps',
      keyPath: 'id',
      indexes: [
        { name: 'title', keyPath: 'title', options: { unique: false } },
        { name: 'userId', keyPath: '_metadata.userId', options: { unique: false } }
      ]
    }
  };

  /**
   * メタデータ作成
   */
  createMetadata(data: MindMapData, additionalMetadata?: Partial<IndexedDBMetadata>): CloudCachedMindMap {
    return {
      ...data,
      _metadata: {
        lastSync: new Date().toISOString(),
        version: 1,
        isDirty: false,
        userId: '',
        ...additionalMetadata
      } as CloudCacheMetadata
    };
  }

  /**
   * 現在のマップを保存
   */
  async saveCurrentMap(data: CloudCachedMindMap): Promise<void> {
    return this.saveData(this.stores.CURRENT_MAP.name, data, 'currentMap');
  }

  /**
   * 現在のマップを取得
   */
  async getCurrentMap(): Promise<CloudCachedMindMap | null> {
    return this.getData<CloudCachedMindMap>(this.stores.CURRENT_MAP.name, 'currentMap');
  }

  /**
   * マップをリストに保存
   */
  async saveMindMapToList(data: CloudCachedMindMap): Promise<void> {
    return this.saveData(this.stores.ALL_MAPS.name, data);
  }

  /**
   * 全マップを取得
   */
  async getAllMindMaps(): Promise<CloudCachedMindMap[]> {
    const results = await this.getData<CloudCachedMindMap[]>(this.stores.ALL_MAPS.name);
    return Array.isArray(results) ? results : [];
  }

  /**
   * マップをリストから削除
   */
  async removeMindMapFromList(id: string): Promise<void> {
    return this.deleteData(this.stores.ALL_MAPS.name, id);
  }

  /**
   * ユーザー専用のマップを取得
   */
  async getUserMaps(userId: string): Promise<CloudCachedMindMap[]> {
    return this.getDataByIndex<CloudCachedMindMap>(this.stores.ALL_MAPS.name, 'userId', userId);
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