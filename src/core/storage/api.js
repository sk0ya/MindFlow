/**
 * 統一API通信クライアント
 * ローカルとクラウドの統一インターフェースとして機能
 */

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:8787/api'
  : 'https://mindflow-api-production.shigekazukoya.workers.dev/api';

const STORAGE_KEY = 'mindflow_maps';
const SETTINGS_KEY = 'mindflow_settings';

// デフォルト設定
const DEFAULT_SETTINGS = {
  storageMode: 'local', // 'local' | 'cloud'
  autoSave: true,
};

class ApiClient {
  constructor() {
    this.token = null;
    this.email = null;
    this.settings = this.getSettings();
  }

  setAuth(token, email) {
    this.token = token;
    this.email = email;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      headers['X-User-ID'] = this.email || 'unknown';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error ${response.status}: ${error}`);
    }

    return response.json();
  }

  // マップ一覧取得
  async getMaps() {
    return this.request('/maps');
  }

  // 特定マップ取得
  async getMap(mapId) {
    return this.request(`/maps/${mapId}`);
  }

  // マップ作成
  async createMap(mapData) {
    return this.request('/maps', {
      method: 'POST',
      body: JSON.stringify(mapData),
    });
  }

  // マップ更新
  async updateMap(mapId, mapData) {
    return this.request(`/maps/${mapId}`, {
      method: 'PUT',
      body: JSON.stringify(mapData),
    });
  }

  // マップ削除
  async deleteMap(mapId) {
    return this.request(`/maps/${mapId}`, {
      method: 'DELETE',
    });
  }

  // 設定管理（統合）
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

  // ローカルストレージ操作（統合）
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
  async getAllMaps() {
    if (this.settings.storageMode === 'cloud') {
      try {
        return await this.getMaps();
      } catch (error) {
        console.warn('Cloud storage failed, falling back to local:', error.message);
        return this.getLocalMaps();
      }
    }
    return this.getLocalMaps();
  }

  async getSingleMap(mapId) {
    if (this.settings.storageMode === 'cloud') {
      try {
        return await this.getMap(mapId);
      } catch (error) {
        console.warn('Cloud storage failed, falling back to local:', error.message);
        const maps = this.getLocalMaps();
        return maps.find(m => m.id === mapId) || null;
      }
    }
    
    const maps = this.getLocalMaps();
    return maps.find(m => m.id === mapId) || null;
  }

  async saveMapData(mapData) {
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
        const existingMap = await this.getMap(mapData.id).catch(() => null);
        
        if (existingMap) {
          return await this.updateMap(mapData.id, mapData);
        } else {
          return await this.createMap(mapData);
        }
      } catch (error) {
        console.warn('Cloud save failed, saved locally only:', error.message);
        return mapData;
      }
    }

    return mapData;
  }

  async deleteMapData(mapId) {
    // ローカルから削除
    const localMaps = this.getLocalMaps();
    const filteredMaps = localMaps.filter(m => m.id !== mapId);
    this.setLocalMaps(filteredMaps);

    // クラウドからも削除
    if (this.settings.storageMode === 'cloud') {
      try {
        await this.deleteMap(mapId);
      } catch (error) {
        console.warn('Cloud delete failed:', error.message);
      }
    }

    return true;
  }
}

export const apiClient = new ApiClient();
export const storageService = apiClient; // 後方互換性のため