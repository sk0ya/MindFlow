// 完全分離：クラウドストレージ専用処理
// Cloudflare Workers APIクライアント

import { authManager } from '../../features/auth/authManager.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api-production.shigekazukoya.workers.dev';

class CloudStorageClient {
  constructor() {
    // ユーザーIDは動的に取得するため、ここでは初期化しない
  }

  async getUserId() {
    // 認証マネージャーから動的にインポート
    try {
      
      // 認証済みの場合は必ずemailをuserIdとして使用（統一化）
      if (authManager.isAuthenticated()) {
        const user = authManager.getCurrentUser();
        console.log('cloudStorage.getUserId - 認証ユーザー情報:', user);
        if (user && user.email) {
          console.log('cloudStorage.getUserId - emailベースuserId:', user.email);
          return user.email;
        }
      }
    } catch (error) {
      console.warn('認証マネージャーの取得に失敗:', error);
    }
    
    // 認証が無効または失敗の場合は従来の方法を維持
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

  // すべてのマインドマップを取得（クラウド専用）
  async getAllMindMapsCloud() {
    console.log('☁️ クラウド: マップ一覧取得開始');
    const result = await this.request('/mindmaps');
    
    const maps = result.mindmaps || [];
    // 基本情報のみのマップリストを作成（詳細データは個別ロード時に取得）
    const basicMaps = maps.map(map => ({
      id: map.id,
      title: map.title || '無題のマップ',
      category: map.category || '未分類',
      updatedAt: map.updatedAt || new Date().toISOString(),
      createdAt: map.createdAt || map.updatedAt || new Date().toISOString(),
      isBasicInfo: true // 基本情報であることを明示
    }));
    
    console.log('☁️ クラウド: マップ一覧取得完了', basicMaps.length, '件');
    return basicMaps;
  }

  // 後方互換性のため
  async getAllMindMaps() {
    return await this.getAllMindMapsCloud();
  }

  // 特定のマインドマップを取得（クラウド専用・データ構造検証付き）
  async getMindMapCloud(id) {
    console.log('☁️ クラウド: マップ取得開始', id);
    const result = await this.request(`/mindmaps/${id}`);
    
    // レスポンス構造を詳細ログ出力
    console.log('📄 クラウドマップ レスポンス構造:', {
      hasResult: !!result,
      resultType: typeof result,
      keys: result ? Object.keys(result) : null,
      hasRootNode: !!(result && result.rootNode),
      rootNodeType: result && result.rootNode ? typeof result.rootNode : null,
      rootNodeKeys: result && result.rootNode && typeof result.rootNode === 'object' ? Object.keys(result.rootNode) : null,
      hasChildren: !!(result && result.rootNode && result.rootNode.children),
      childrenLength: result && result.rootNode && result.rootNode.children ? result.rootNode.children.length : 0,
      sample: result && result.rootNode ? {
        id: result.rootNode.id,
        text: result.rootNode.text,
        childrenCount: result.rootNode.children ? result.rootNode.children.length : 0
      } : null
    });
    
    // 🔧 取得データの詳細確認
    console.log('📥 取得データ詳細分析:', {
      mapId: result?.id,
      title: result?.title,
      rootNodeChildren: result?.rootNode?.children?.length || 0,
      childrenIds: result?.rootNode?.children?.map(c => c.id) || [],
      childrenDetails: result?.rootNode?.children?.map(c => ({
        id: c.id,
        text: c.text,
        hasChildren: c.children?.length > 0,
        childrenCount: c.children?.length || 0
      })) || [],
      totalDataSize: JSON.stringify(result).length
    });
    
    // データ構造の検証と正規化
    if (result && result.rootNode) {
      // rootNodeが文字列の場合はパース
      if (typeof result.rootNode === 'string') {
        try {
          console.log('📦 rootNodeをJSONパース中...');
          result.rootNode = JSON.parse(result.rootNode);
          console.log('✅ rootNodeパース成功');
        } catch (parseError) {
          console.error('❌ rootNodeパース失敗:', parseError);
          throw new Error(`rootNodeのパースに失敗しました: ${parseError.message}`);
        }
      }
      
      // 基本構造の検証
      if (!result.rootNode.id) {
        console.warn('⚠️ rootNode.idが見つかりません');
        result.rootNode.id = 'root';
      }
      
      if (!result.rootNode.children) {
        console.warn('⚠️ rootNode.childrenが見つかりません、空配列で初期化');
        result.rootNode.children = [];
      }
      
      if (!Array.isArray(result.rootNode.children)) {
        console.error('❌ rootNode.childrenが配列ではありません:', typeof result.rootNode.children);
        result.rootNode.children = [];
      }
      
      console.log('✅ クラウドデータ構造検証完了:', {
        rootNodeId: result.rootNode.id,
        childrenCount: result.rootNode.children.length
      });
    } else {
      console.error('❌ クラウドrootNodeが見つかりません:', result);
      throw new Error('クラウドサーバーからのデータにrootNodeが含まれていません');
    }
    
    console.log('☁️ クラウド: マップ取得完了', result.title);
    return result;
  }

  // 後方互換性のため
  async getMindMap(id) {
    return await this.getMindMapCloud(id);
  }

  // マインドマップを作成（クラウド専用）
  async createMindMapCloud(mindmapData) {
    console.log('☁️ クラウド: マップ作成開始', mindmapData.title);
    const result = await this.request('/mindmaps', {
      method: 'POST',
      body: JSON.stringify(mindmapData)
    });
    console.log('☁️ クラウド: マップ作成完了', result.title);
    return result;
  }

  // 後方互換性のため
  async createMindMap(mindmapData) {
    return await this.createMindMapCloud(mindmapData);
  }

  // マインドマップを更新（クラウド専用）
  async updateMindMapCloud(id, mindmapData) {
    console.log('☁️ クラウド: マップ更新開始:', id, mindmapData.title);
    
    // IDの一貫性を保つ - データはそのまま送信
    const dataToSend = {
      ...mindmapData,
      id: id // リクエストURLのIDと一致させる
    };
    
    // 🔧 詳細な送信データログ
    console.log('📤 実際の送信データ詳細:', {
      mapId: dataToSend.id,
      title: dataToSend.title,
      hasRootNode: !!dataToSend.rootNode,
      rootNodeId: dataToSend.rootNode?.id,
      rootNodeChildren: dataToSend.rootNode?.children?.length || 0,
      childrenIds: dataToSend.rootNode?.children?.map(c => c.id) || [],
      childrenDetails: dataToSend.rootNode?.children?.map(c => ({
        id: c.id,
        text: c.text,
        hasChildren: c.children?.length > 0,
        childrenCount: c.children?.length || 0
      })) || [],
      jsonSize: JSON.stringify(dataToSend).length
    });
    
    const result = await this.request(`/mindmaps/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dataToSend)
    });
    
    // 🔧 レスポンスデータの検証
    console.log('📥 サーバーレスポンス詳細:', {
      responseTitle: result.title,
      hasRootNode: !!result.rootNode,
      rootNodeChildren: result.rootNode?.children?.length || 0,
      responseJsonSize: JSON.stringify(result).length
    });
    
    console.log('☁️ クラウド: マップ更新完了:', result.title);
    return result;
  }

  // 後方互換性のため
  async updateMindMap(id, mindmapData) {
    return await this.updateMindMapCloud(id, mindmapData);
  }

  // マインドマップを削除（クラウド専用）
  async deleteMindMapCloud(id) {
    console.log('☁️ クラウド: マップ削除開始', id);
    const result = await this.request(`/mindmaps/${id}`, {
      method: 'DELETE'
    });
    console.log('☁️ クラウド: マップ削除完了');
    return result;
  }

  // 後方互換性のため
  async deleteMindMap(id) {
    return await this.deleteMindMapCloud(id);
  }

  // 接続テスト（クラウド専用）
  async testConnectionCloud() {
    try {
      await this.getAllMindMapsCloud();
      return true;
    } catch (error) {
      console.error('☁️ クラウド接続テスト失敗:', error);
      return false;
    }
  }

  // 後方互換性のため
  async testConnection() {
    return await this.testConnectionCloud();
  }
}

export const cloudStorage = new CloudStorageClient();