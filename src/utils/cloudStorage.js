// Cloudflare Workers APIクライアント

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://mindflow-api-prod.your-domain.workers.dev'
  : 'https://mindflow-api.your-domain.workers.dev';

class CloudStorageClient {
  constructor() {
    this.userId = this.getUserId();
  }

  getUserId() {
    // 簡易的なユーザーID生成（実際の認証システムに置き換え）
    let userId = localStorage.getItem('mindflow_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mindflow_user_id', userId);
    }
    return userId;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': this.userId,
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  // すべてのマインドマップを取得
  async getAllMindMaps() {
    return await this.request('/mindmaps');
  }

  // 特定のマインドマップを取得
  async getMindMap(id) {
    return await this.request(`/mindmaps/${id}`);
  }

  // マインドマップを作成
  async createMindMap(mindmapData) {
    return await this.request('/mindmaps', {
      method: 'POST',
      body: JSON.stringify(mindmapData)
    });
  }

  // マインドマップを更新
  async updateMindMap(id, mindmapData) {
    return await this.request(`/mindmaps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(mindmapData)
    });
  }

  // マインドマップを削除
  async deleteMindMap(id) {
    return await this.request(`/mindmaps/${id}`, {
      method: 'DELETE'
    });
  }

  // 接続テスト
  async testConnection() {
    try {
      await this.getAllMindMaps();
      return true;
    } catch (error) {
      console.error('Cloud storage connection failed:', error);
      return false;
    }
  }
}

export const cloudStorage = new CloudStorageClient();