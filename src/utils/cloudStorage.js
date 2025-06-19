// Cloudflare Workers APIクライアント

const API_BASE = 'https://mindflow-api-production.shigekazukoya.workers.dev';

class CloudStorageClient {
  constructor() {
    // ユーザーIDは動的に取得するため、ここでは初期化しない
  }

  async getUserId() {
    // 認証マネージャーから動的にインポート
    try {
      const { authManager } = await import('./authManager.js');
      
      // 認証済みの場合は認証ユーザーIDを使用
      if (authManager.isAuthenticated()) {
        const user = authManager.getCurrentUser();
        if (user && (user.userId || user.email || user.id)) {
          return user.userId || user.email || user.id;
        }
      }
    } catch (error) {
      console.warn('認証マネージャーの取得に失敗:', error);
    }
    
    // 認証が無効または失敗の場合は従来の方法
    let userId = localStorage.getItem('mindflow_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mindflow_user_id', userId);
    }
    return userId;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    
    // 認証マネージャーを動的にインポート（循環依存回避）
    try {
      const { authManager } = await import('./authManager.js');
      
      // 認証が有効な場合は認証済みリクエストを使用
      if (authManager.isAuthenticated()) {
        try {
          const response = await authManager.authenticatedFetch(url, {
            headers: {
              'Content-Type': 'application/json',
              ...options.headers
            },
            ...options
          });
          
          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Network error' }));
            throw new Error(error.error || `HTTP ${response.status}`);
          }
          
          return await response.json();
        } catch (error) {
          if (error.message === 'Authentication expired' || error.message === 'Not authenticated') {
            // 認証期限切れまたは未認証の場合は従来の方法にフォールバック
            console.log('認証エラー、X-User-IDでフォールバック:', error.message);
            return await this.legacyRequest(endpoint, options);
          }
          throw error;
        }
      } else {
        // 認証が無効な場合は従来の方法を使用
        return await this.legacyRequest(endpoint, options);
      }
    } catch (importError) {
      // 認証マネージャーのインポートに失敗した場合は従来の方法を使用
      return await this.legacyRequest(endpoint, options);
    }
  }

  async legacyRequest(endpoint, options = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    
    // 動的にユーザーIDを取得
    const userId = await this.getUserId();
    
    // 認証が無効な場合でも適切なヘッダーを設定
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
        ...options.headers
      },
      ...options
    };

    // リトライ機能付きのリクエスト
    return await this.retryRequest(url, config, 3);
  }

  async retryRequest(url, config, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Network error' }));
          lastError = new Error(error.error || `HTTP ${response.status}`);
          
          // リトライ可能なエラーかチェック
          if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
            // 4xx エラー（リトライ不可）
            throw lastError;
          }
          
          if (attempt === maxRetries - 1) {
            throw lastError;
          }
          
          // 指数バックオフで待機
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
          continue;
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        
        // ネットワークエラーの場合はリトライ
        if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
          if (attempt === maxRetries - 1) {
            throw new Error('ネットワークエラー: サーバーに接続できません');
          }
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }

  // すべてのマインドマップを取得
  async getAllMindMaps() {
    console.log('cloudStorage.getAllMindMaps() 開始');
    const result = await this.request('/mindmaps');
    console.log('cloudStorage.getAllMindMaps() 結果:', result);
    return result;
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
    console.log('cloudStorage.updateMindMap() 開始:', id, mindmapData.title);
    console.log('送信データ:', JSON.stringify(mindmapData, null, 2));
    const result = await this.request(`/mindmaps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(mindmapData)
    });
    console.log('cloudStorage.updateMindMap() 結果:', result);
    console.log('結果の詳細:', JSON.stringify(result, null, 2));
    return result;
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