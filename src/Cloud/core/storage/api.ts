/**
 * 統一API通信クライアント
 * ローカルとクラウドの統一インターフェースとして機能
 */

interface RequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}


interface AppSettings {
  storageMode: 'cloud';
  autoSave: boolean;
}

const getAPIBase = (): string => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8787/api';
  }
  return 'https://mindflow-api.shigekazukoya.workers.dev/api';
};

const API_BASE = getAPIBase();

// デフォルト設定（クラウド専用）
const DEFAULT_SETTINGS: AppSettings = {
  storageMode: 'cloud', // クラウド専用
  autoSave: true,
};

class ApiClient {
  private token: string | null;
  private email: string | null;
  private settings: AppSettings;

  constructor() {
    this.token = null;
    this.email = null;
    this.settings = this.getSettings();
  }

  setAuth(token: string, email: string): void {
    this.token = token;
    this.email = email;
  }

  async request(endpoint: string, options: RequestOptions = {}): Promise<Response> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
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
  async getMaps(): Promise<any> {
    return this.request('/maps');
  }

  // 特定マップ取得
  async getMap(mapId: string): Promise<any> {
    return this.request(`/maps/${mapId}`);
  }

  // マップ作成
  async createMap(mapData: any): Promise<any> {
    return this.request('/maps', {
      method: 'POST',
      body: JSON.stringify(mapData),
    });
  }

  // マップ更新
  async updateMap(mapId: string, mapData: any): Promise<any> {
    return this.request(`/maps/${mapId}`, {
      method: 'PUT',
      body: JSON.stringify(mapData),
    });
  }

  // マップ削除
  async deleteMap(mapId: string): Promise<any> {
    return this.request(`/maps/${mapId}`, {
      method: 'DELETE',
    });
  }

  // 設定管理（クラウド専用）
  getSettings(): AppSettings {
    // Cloud mode: settings stored in memory only
    return { ...DEFAULT_SETTINGS };
  }

  setSettings(newSettings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('☁️ Cloud mode: settings updated in memory only');
  }

  // クラウド専用操作（ローカルストレージなし）
  getLocalMaps(): any[] {
    // Cloud mode: no local maps storage
    console.log('☁️ Cloud mode: no local maps available');
    return [];
  }

  setLocalMaps(_maps: any[]): void {
    // Cloud mode: no local maps storage
    console.log('☁️ Cloud mode: local maps not saved');
  }

  // クラウド専用インターフェース
  async getAllMaps(): Promise<any> {
    // Cloud mode: always use cloud storage
    try {
      return await this.getMaps();
    } catch (error: unknown) {
      console.error('☁️ Cloud storage failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getSingleMap(mapId: string): Promise<any> {
    // Cloud mode: always use cloud storage
    try {
      return await this.getMap(mapId);
    } catch (error: unknown) {
      console.error('☁️ Cloud storage failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveMapData(mapData: any): Promise<any> {
    // Cloud mode: save to cloud only
    try {
      const existingMap = await this.getMap(mapData.id).catch(() => null);
      
      if (existingMap) {
        return await this.updateMap(mapData.id, mapData);
      } else {
        return await this.createMap(mapData);
      }
    } catch (error: unknown) {
      console.error('☁️ Cloud save failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async deleteMapData(mapId: string): Promise<any> {
    // Cloud mode: delete from cloud only
    try {
      await this.deleteMap(mapId);
      return true;
    } catch (error: unknown) {
      console.error('☁️ Cloud delete failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

export const apiClient = new ApiClient();
export const storageService = apiClient; // 後方互換性のため