// Local storage adapter - wraps IndexedDB functionality for unified interface
import type { MindMapData } from '@shared/types';
import type { StorageAdapter } from '../types';
import { logger } from '../../../shared/utils/logger';
import {
  initLocalIndexedDB,
  saveCurrentMapToIndexedDB,
  getCurrentMapFromIndexedDB,
  saveMindMapToIndexedDB,
  getAllMindMapsFromIndexedDB,
  removeMindMapFromIndexedDB
} from '../../utils/indexedDB';
import { createInitialData } from '../../../shared/types/dataTypes';

/**
 * ローカルストレージアダプター
 * IndexedDBを使用してローカルにデータを保存
 */
export class LocalStorageAdapter implements StorageAdapter {
  private _isInitialized = false;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * IndexedDBを初期化
   */
  async initialize(): Promise<void> {
    try {
      await initLocalIndexedDB();
      this._isInitialized = true;
      logger.debug('✅ LocalStorageAdapter: IndexedDB initialized');
    } catch (error) {
      logger.error('❌ LocalStorageAdapter: Initialization failed:', error);
      this._isInitialized = true; // 失敗でも初期化完了扱いにして処理を続行
      throw error;
    }
  }

  /**
   * 初期データを読み込み
   */
  async loadInitialData(): Promise<MindMapData> {
    if (!this._isInitialized) {
      await this.initialize();
    }

    try {
      // まず利用可能なマップ一覧を取得
      const allMaps = await getAllMindMapsFromIndexedDB();
      
      if (allMaps.length > 0) {
        // 最初のマップを取得
        const firstMap = allMaps[0];
        logger.debug('📋 LocalStorageAdapter: Loading first available map:', firstMap.title);
        return firstMap;
      }
      
      // 利用可能なマップがない場合は現在のマップを試す
      const savedData = await getCurrentMapFromIndexedDB();
      if (savedData && this.isValidMindMapData(savedData)) {
        logger.debug('📋 LocalStorageAdapter: Loaded current map:', savedData.title);
        return savedData;
      }
    } catch (error) {
      logger.error('❌ LocalStorageAdapter: Failed to load initial data:', error);
    }

    // デフォルトデータを作成
    const initialData = createInitialData();
    logger.debug('🆕 LocalStorageAdapter: Created initial data:', initialData.title);
    return initialData;
  }

  /**
   * データを保存
   */
  async saveData(data: MindMapData): Promise<void> {
    if (!this._isInitialized) {
      logger.warn('LocalStorageAdapter: Not initialized, skipping save');
      return;
    }

    try {
      await saveCurrentMapToIndexedDB(data);
      logger.debug('💾 LocalStorageAdapter: Data saved:', data.title);
    } catch (error) {
      logger.error('❌ LocalStorageAdapter: Failed to save data:', error);
      throw error;
    }
  }

  /**
   * 全マップを読み込み
   */
  async loadAllMaps(): Promise<MindMapData[]> {
    if (!this._isInitialized) {
      await this.initialize();
    }

    try {
      const savedMaps = await getAllMindMapsFromIndexedDB();
      if (savedMaps && savedMaps.length > 0) {
        // _metadataを除去してMindMapData[]に変換
        const cleanMaps: MindMapData[] = savedMaps.map(({ _metadata, ...map }) => map);
        logger.debug(`📋 LocalStorageAdapter: Loaded ${cleanMaps.length} maps`);
        return cleanMaps;
      }

      logger.debug('📋 LocalStorageAdapter: No saved maps found');
      return [];
    } catch (error) {
      logger.error('❌ LocalStorageAdapter: Failed to load maps:', error);
      return [];
    }
  }

  /**
   * 全マップを保存（個別保存の集合）
   */
  async saveAllMaps(maps: MindMapData[]): Promise<void> {
    if (!this._isInitialized) {
      logger.warn('LocalStorageAdapter: Not initialized, skipping save all maps');
      return;
    }

    try {
      // 各マップを個別にIndexedDBに保存
      await Promise.all(maps.map(map => saveMindMapToIndexedDB(map)));
      logger.debug(`💾 LocalStorageAdapter: Saved ${maps.length} maps`);
    } catch (error) {
      logger.error('❌ LocalStorageAdapter: Failed to save maps:', error);
      throw error;
    }
  }

  /**
   * マップをリストに追加
   */
  async addMapToList(map: MindMapData): Promise<void> {
    if (!this._isInitialized) {
      logger.warn('LocalStorageAdapter: Not initialized, skipping add map');
      return;
    }

    try {
      await saveMindMapToIndexedDB(map);
      logger.debug('📋 LocalStorageAdapter: Added map to list:', map.title);
    } catch (error) {
      logger.error('❌ LocalStorageAdapter: Failed to add map:', error);
      throw error;
    }
  }

  /**
   * マップをリストから削除
   */
  async removeMapFromList(mapId: string): Promise<void> {
    if (!this._isInitialized) {
      logger.warn('LocalStorageAdapter: Not initialized, skipping remove map');
      return;
    }

    try {
      await removeMindMapFromIndexedDB(mapId);
      logger.debug('🗑️ LocalStorageAdapter: Removed map from list:', mapId);
    } catch (error) {
      logger.error('❌ LocalStorageAdapter: Failed to remove map:', error);
      throw error;
    }
  }

  /**
   * マップをリストで更新
   */
  async updateMapInList(map: MindMapData): Promise<void> {
    if (!this._isInitialized) {
      logger.warn('LocalStorageAdapter: Not initialized, skipping update map');
      return;
    }

    try {
      await saveMindMapToIndexedDB(map);
      logger.debug('📋 LocalStorageAdapter: Updated map in list:', map.title);
    } catch (error) {
      logger.error('❌ LocalStorageAdapter: Failed to update map:', error);
      throw error;
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    // IndexedDBの接続はブラウザが管理するので、特別なクリーンアップは不要
    logger.debug('🧹 LocalStorageAdapter: Cleanup completed');
  }

  /**
   * データの型検証
   */
  private isValidMindMapData(data: unknown): data is MindMapData {
    return (
      typeof data === 'object' &&
      data !== null &&
      'id' in data &&
      'title' in data &&
      'rootNode' in data &&
      typeof (data as { id: unknown; title: unknown }).id === 'string' &&
      typeof (data as { id: unknown; title: unknown }).title === 'string'
    );
  }
}