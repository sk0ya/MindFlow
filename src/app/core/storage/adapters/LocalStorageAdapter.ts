// Local storage adapter - wraps IndexedDB functionality for unified interface
import type { MindMapData } from '@shared/types';
import type { StorageAdapter } from '../types';
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
      console.log('✅ LocalStorageAdapter: IndexedDB initialized');
    } catch (error) {
      console.error('❌ LocalStorageAdapter: Initialization failed:', error);
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
      const savedData = await getCurrentMapFromIndexedDB();
      if (savedData && this.isValidMindMapData(savedData)) {
        console.log('📋 LocalStorageAdapter: Loaded saved data:', savedData.title);
        return savedData;
      }
    } catch (error) {
      console.error('❌ LocalStorageAdapter: Failed to load initial data:', error);
    }

    // デフォルトデータを作成
    const initialData = createInitialData();
    console.log('🆕 LocalStorageAdapter: Created initial data:', initialData.title);
    return initialData;
  }

  /**
   * データを保存
   */
  async saveData(data: MindMapData): Promise<void> {
    if (!this._isInitialized) {
      console.warn('LocalStorageAdapter: Not initialized, skipping save');
      return;
    }

    try {
      await saveCurrentMapToIndexedDB(data);
      console.log('💾 LocalStorageAdapter: Data saved:', data.title);
    } catch (error) {
      console.error('❌ LocalStorageAdapter: Failed to save data:', error);
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
        console.log(`📋 LocalStorageAdapter: Loaded ${cleanMaps.length} maps`);
        return cleanMaps;
      }

      console.log('📋 LocalStorageAdapter: No saved maps found');
      return [];
    } catch (error) {
      console.error('❌ LocalStorageAdapter: Failed to load maps:', error);
      return [];
    }
  }

  /**
   * 全マップを保存（個別保存の集合）
   */
  async saveAllMaps(maps: MindMapData[]): Promise<void> {
    if (!this._isInitialized) {
      console.warn('LocalStorageAdapter: Not initialized, skipping save all maps');
      return;
    }

    try {
      // 各マップを個別にIndexedDBに保存
      await Promise.all(maps.map(map => saveMindMapToIndexedDB(map)));
      console.log(`💾 LocalStorageAdapter: Saved ${maps.length} maps`);
    } catch (error) {
      console.error('❌ LocalStorageAdapter: Failed to save maps:', error);
      throw error;
    }
  }

  /**
   * マップをリストに追加
   */
  async addMapToList(map: MindMapData): Promise<void> {
    if (!this._isInitialized) {
      console.warn('LocalStorageAdapter: Not initialized, skipping add map');
      return;
    }

    try {
      await saveMindMapToIndexedDB(map);
      console.log('📋 LocalStorageAdapter: Added map to list:', map.title);
    } catch (error) {
      console.error('❌ LocalStorageAdapter: Failed to add map:', error);
      throw error;
    }
  }

  /**
   * マップをリストから削除
   */
  async removeMapFromList(mapId: string): Promise<void> {
    if (!this._isInitialized) {
      console.warn('LocalStorageAdapter: Not initialized, skipping remove map');
      return;
    }

    try {
      await removeMindMapFromIndexedDB(mapId);
      console.log('🗑️ LocalStorageAdapter: Removed map from list:', mapId);
    } catch (error) {
      console.error('❌ LocalStorageAdapter: Failed to remove map:', error);
      throw error;
    }
  }

  /**
   * マップをリストで更新
   */
  async updateMapInList(map: MindMapData): Promise<void> {
    if (!this._isInitialized) {
      console.warn('LocalStorageAdapter: Not initialized, skipping update map');
      return;
    }

    try {
      await saveMindMapToIndexedDB(map);
      console.log('📋 LocalStorageAdapter: Updated map in list:', map.title);
    } catch (error) {
      console.error('❌ LocalStorageAdapter: Failed to update map:', error);
      throw error;
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    // IndexedDBの接続はブラウザが管理するので、特別なクリーンアップは不要
    console.log('🧹 LocalStorageAdapter: Cleanup completed');
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