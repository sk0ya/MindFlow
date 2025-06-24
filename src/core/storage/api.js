/**
 * シンプルなAPI通信クライアント
 * マップ単位でのみ操作を行う
 */

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:8787/api'
  : 'https://mindflow-api-production.shigekazukoya.workers.dev/api';

class ApiClient {
  constructor() {
    this.token = null;
    this.email = null;
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
}

export const apiClient = new ApiClient();