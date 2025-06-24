/**
 * シンプルなストレージサービス
 * ローカルとクラウドを統一インターフェースで管理
 */

import { apiClient } from './api.js';

const STORAGE_KEY = 'mindflow_maps';
const SETTINGS_KEY = 'mindflow_settings';

// デフォルト設定
const DEFAULT_SETTINGS = {
  storageMode: 'local', // 'local' | 'cloud'
  autoSave: true,
};

class StorageService {
  constructor() {
    this.settings = this.getSettings();
  }

  // 設定管理
  getSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  setSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  // ローカルストレージ操作
  getLocalMaps() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  setLocalMaps(maps) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
  }

  // 統一インターフェース
  async getMaps() {
    if (this.settings.storageMode === 'cloud') {
      try {
        return await apiClient.getMaps();
      } catch (error) {
        console.warn('Cloud storage failed, falling back to local:', error.message);
        return this.getLocalMaps();
      }
    }
    return this.getLocalMaps();
  }

  async getMap(mapId) {
    if (this.settings.storageMode === 'cloud') {
      try {
        return await apiClient.getMap(mapId);
      } catch (error) {
        console.warn('Cloud storage failed, falling back to local:', error.message);
        const maps = this.getLocalMaps();
        return maps.find(m => m.id === mapId) || null;
      }
    }
    
    const maps = this.getLocalMaps();
    return maps.find(m => m.id === mapId) || null;
  }

  async saveMap(mapData) {
    // ローカルに必ず保存（バックアップとして）
    const localMaps = this.getLocalMaps();
    const existingIndex = localMaps.findIndex(m => m.id === mapData.id);
    
    if (existingIndex >= 0) {
      localMaps[existingIndex] = mapData;
    } else {
      localMaps.push(mapData);
    }
    
    this.setLocalMaps(localMaps);

    // クラウドにも保存（可能な場合）
    if (this.settings.storageMode === 'cloud') {
      try {
        const existingMap = await apiClient.getMap(mapData.id).catch(() => null);
        
        if (existingMap) {
          return await apiClient.updateMap(mapData.id, mapData);
        } else {
          return await apiClient.createMap(mapData);
        }
      } catch (error) {
        console.warn('Cloud save failed, saved locally only:', error.message);
        return mapData;
      }
    }

    return mapData;
  }

  async deleteMap(mapId) {
    // ローカルから削除
    const localMaps = this.getLocalMaps();
    const filteredMaps = localMaps.filter(m => m.id !== mapId);
    this.setLocalMaps(filteredMaps);

    // クラウドからも削除
    if (this.settings.storageMode === 'cloud') {
      try {
        await apiClient.deleteMap(mapId);
      } catch (error) {
        console.warn('Cloud delete failed:', error.message);
      }
    }

    return true;
  }

  // 認証設定
  setAuth(token, email) {
    apiClient.setAuth(token, email);
  }
}

export const storageService = new StorageService();
export { StorageService };