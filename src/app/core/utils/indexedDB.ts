/**
 * Local Mode IndexedDB Manager
 * ベースクラスを使用してローカルモード専用の実装を提供
 */

import type { MindMapData } from '../../../shared/types';
import { IndexedDBBase, type CachedMindMap, type IndexedDBMetadata, type StoreDefinition } from './indexedDBBase';

interface LocalCacheMetadata extends IndexedDBMetadata {
  lastModified: string;
  version: number;
}

export interface CachedLocalMindMap extends CachedMindMap {
  _metadata: LocalCacheMetadata;
}

/**
 * ローカルモード用IndexedDBマネージャー
 */
class LocalIndexedDBManager extends IndexedDBBase<CachedLocalMindMap> {
  protected readonly dbName = 'MindFlow-Local';
  protected readonly version = 1;
  
  protected readonly stores: Record<string, StoreDefinition> = {
    MINDMAPS: {
      name: 'mindmaps',
      keyPath: 'id',
      indexes: [
        { name: 'title', keyPath: 'title', options: { unique: false } },
        { name: 'lastModified', keyPath: '_metadata.lastModified', options: { unique: false } }
      ]
    },
    CURRENT_MAP: {
      name: 'currentMap',
      keyPath: 'key'
    }
  };

  /**
   * メタデータ作成
   */
  createMetadata(data: MindMapData, additionalMetadata?: Partial<IndexedDBMetadata>): CachedLocalMindMap {
    return {
      ...data,
      _metadata: {
        lastModified: new Date().toISOString(),
        version: 1,
        ...additionalMetadata
      } as LocalCacheMetadata
    };
  }

  /**
   * 現在のマインドマップを保存
   */
  async saveCurrentMap(data: MindMapData): Promise<void> {
    const cachedData = this.createMetadata(data);
    return this.saveData(this.stores.CURRENT_MAP.name, { key: 'currentMap', data: cachedData });
  }

  /**
   * 現在のマインドマップを取得
   */
  async getCurrentMap(): Promise<CachedLocalMindMap | null> {
    const result = await this.getData<{ key: string; data: CachedLocalMindMap }>(
      this.stores.CURRENT_MAP.name, 
      'currentMap'
    );
    return result?.data || null;
  }

  /**
   * マインドマップをリストに保存
   */
  async saveMindMapToList(data: MindMapData): Promise<void> {
    const cachedData = this.createMetadata(data);
    return this.saveData(this.stores.MINDMAPS.name, cachedData);
  }

  /**
   * 全マインドマップを取得
   */
  async getAllMindMaps(): Promise<CachedLocalMindMap[]> {
    const results = await this.getData<CachedLocalMindMap[]>(this.stores.MINDMAPS.name);
    return Array.isArray(results) ? results : [];
  }

  /**
   * マインドマップをリストから削除
   */
  async removeMindMapFromList(id: string): Promise<void> {
    return this.deleteData(this.stores.MINDMAPS.name, id);
  }
}

// シングルトンインスタンス
export const localIndexedDB = new LocalIndexedDBManager();

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

export type { LocalCacheMetadata };