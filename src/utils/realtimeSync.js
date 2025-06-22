// リアルタイム同期システム - 操作ベースの即座DB反映
import { getAppSettings } from './storage.js';
import { authManager } from './authManager.js';

class RealtimeSync {
  constructor() {
    this.isEnabled = false;
    this.baseUrl = '';
    this.pendingOperations = new Map(); // 失敗時のリトライ用
  }

  // 初期化
  initialize() {
    const settings = getAppSettings();
    this.isEnabled = settings.storageMode === 'cloud' && authManager.isAuthenticated();
    
    if (this.isEnabled) {
      // 正しいAPIエンドポイントを使用
      this.baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:8787/api' 
        : 'https://mindflow-api-production.shigekazukoya.workers.dev/api';
      
      console.log('🔄 リアルタイム同期を有効化:', this.baseUrl);
    } else {
      console.log('🏠 ローカルモード or 未認証: リアルタイム同期は無効');
      console.log('  - ストレージモード:', settings.storageMode);
      console.log('  - 認証状態:', authManager.isAuthenticated());
    }
  }

  // 認証状態変更時の再初期化
  reinitialize() {
    console.log('🔄 リアルタイム同期の再初期化');
    this.initialize();
  }

  // 認証ヘッダーを取得
  getAuthHeaders() {
    if (!authManager.isAuthenticated()) {
      throw new Error('認証が必要です');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authManager.getAuthToken()}`,
      'X-User-ID': authManager.getCurrentUser()?.email || 'unknown'
    };
  }

  // === ノード操作 ===

  // ノード追加の即座反映
  async addNode(mapId, nodeData, parentId = null) {
    if (!this.isEnabled) return { success: true, local: true };

    try {
      console.log('🆕 ノード追加をDB反映:', nodeData.id, nodeData.text);
      
      const response = await fetch(`${this.baseUrl}/nodes`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          mapId,
          node: nodeData,
          parentId,
          operation: 'add'
        })
      });

      if (!response.ok) {
        throw new Error(`ノード追加失敗: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ ノード追加成功:', result);
      return { success: true, result };

    } catch (error) {
      console.error('❌ ノード追加エラー:', error);
      // 失敗した操作をキューに追加（後でリトライ）
      this.pendingOperations.set(`add_${nodeData.id}`, {
        type: 'add',
        mapId,
        nodeData,
        parentId,
        timestamp: Date.now()
      });
      return { success: false, error: error.message };
    }
  }

  // ノード更新の即座反映
  async updateNode(mapId, nodeId, updates) {
    if (!this.isEnabled) return { success: true, local: true };

    try {
      console.log('📝 ノード更新をDB反映:', nodeId, updates);
      
      const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          mapId,
          updates,
          operation: 'update'
        })
      });

      if (!response.ok) {
        throw new Error(`ノード更新失敗: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ ノード更新成功:', result);
      return { success: true, result };

    } catch (error) {
      console.error('❌ ノード更新エラー:', error);
      this.pendingOperations.set(`update_${nodeId}`, {
        type: 'update',
        mapId,
        nodeId,
        updates,
        timestamp: Date.now()
      });
      return { success: false, error: error.message };
    }
  }

  // ノード削除の即座反映
  async deleteNode(mapId, nodeId) {
    if (!this.isEnabled) return { success: true, local: true };

    try {
      console.log('🗑️ ノード削除をDB反映:', nodeId);
      
      const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          mapId,
          operation: 'delete'
        })
      });

      if (!response.ok) {
        throw new Error(`ノード削除失敗: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ ノード削除成功:', result);
      return { success: true, result };

    } catch (error) {
      console.error('❌ ノード削除エラー:', error);
      this.pendingOperations.set(`delete_${nodeId}`, {
        type: 'delete',
        mapId,
        nodeId,
        timestamp: Date.now()
      });
      return { success: false, error: error.message };
    }
  }

  // ノード移動（親変更）の即座反映
  async moveNode(mapId, nodeId, newParentId) {
    if (!this.isEnabled) return { success: true, local: true };

    try {
      console.log('🔄 ノード移動をDB反映:', nodeId, '->', newParentId);
      
      const response = await fetch(`${this.baseUrl}/nodes/${nodeId}/move`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          mapId,
          newParentId,
          operation: 'move'
        })
      });

      if (!response.ok) {
        throw new Error(`ノード移動失敗: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ ノード移動成功:', result);
      return { success: true, result };

    } catch (error) {
      console.error('❌ ノード移動エラー:', error);
      this.pendingOperations.set(`move_${nodeId}`, {
        type: 'move',
        mapId,
        nodeId,
        newParentId,
        timestamp: Date.now()
      });
      return { success: false, error: error.message };
    }
  }

  // === マップ操作 ===

  // マップ読み取り（純粋な取得操作）
  async loadMap(mapId) {
    if (!this.isEnabled) {
      throw new Error('クラウドモードが無効です');
    }

    try {
      console.log('📖 マップ読み取り:', mapId);
      
      const response = await fetch(`${this.baseUrl}/mindmaps/${mapId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`マップ読み取り失敗: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ マップ読み取り成功:', result.title);
      return result;

    } catch (error) {
      console.error('❌ マップ読み取りエラー:', error);
      throw error;
    }
  }

  // マップ一覧取得（基本情報のみ）
  async loadMapList() {
    if (!this.isEnabled) {
      throw new Error('クラウドモードが無効です');
    }

    try {
      console.log('📋 マップ一覧取得');
      
      const response = await fetch(`${this.baseUrl}/mindmaps`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`マップ一覧取得失敗: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ マップ一覧取得成功:', result.mindmaps?.length || 0, '件');
      return result.mindmaps || [];

    } catch (error) {
      console.error('❌ マップ一覧取得エラー:', error);
      throw error;
    }
  }

  // マップ作成
  async createMap(mapData) {
    if (!this.isEnabled) return { success: true, local: true };

    try {
      console.log('🆕 マップ作成をDB反映:', mapData.title);
      
      const response = await fetch(`${this.baseUrl}/mindmaps`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(mapData)
      });

      if (!response.ok) {
        throw new Error(`マップ作成失敗: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ マップ作成成功:', result);
      return { success: true, result };

    } catch (error) {
      console.error('❌ マップ作成エラー:', error);
      return { success: false, error: error.message };
    }
  }

  // マップ削除
  async deleteMap(mapId) {
    if (!this.isEnabled) return { success: true, local: true };

    try {
      console.log('🗑️ マップ削除をDB反映:', mapId);
      
      const response = await fetch(`${this.baseUrl}/mindmaps/${mapId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`マップ削除失敗: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ マップ削除成功:', result);
      return { success: true, result };

    } catch (error) {
      console.error('❌ マップ削除エラー:', error);
      return { success: false, error: error.message };
    }
  }

  // === リトライ機能 ===

  // 失敗した操作のリトライ
  async retryPendingOperations() {
    if (this.pendingOperations.size === 0) return;

    console.log('🔄 失敗操作のリトライ開始:', this.pendingOperations.size, '件');

    for (const [key, operation] of this.pendingOperations.entries()) {
      try {
        // 古い操作（5分以上前）は破棄
        if (Date.now() - operation.timestamp > 5 * 60 * 1000) {
          console.log('⏰ 古い操作を破棄:', key);
          this.pendingOperations.delete(key);
          continue;
        }

        let result;
        switch (operation.type) {
          case 'add':
            result = await this.addNode(operation.mapId, operation.nodeData, operation.parentId);
            break;
          case 'update':
            result = await this.updateNode(operation.mapId, operation.nodeId, operation.updates);
            break;
          case 'delete':
            result = await this.deleteNode(operation.mapId, operation.nodeId);
            break;
          case 'move':
            result = await this.moveNode(operation.mapId, operation.nodeId, operation.newParentId);
            break;
        }

        if (result?.success) {
          console.log('✅ リトライ成功:', key);
          this.pendingOperations.delete(key);
        }

      } catch (error) {
        console.warn('❌ リトライ失敗:', key, error.message);
        // リトライ失敗は保持（次回再試行）
      }
    }
  }

  // 同期状態の取得
  getSyncStatus() {
    return {
      isEnabled: this.isEnabled,
      pendingCount: this.pendingOperations.size,
      isOnline: navigator.onLine,
      lastSync: this.lastSyncTime || null
    };
  }
}

// シングルトンインスタンス
export const realtimeSync = new RealtimeSync();

// 自動初期化
realtimeSync.initialize();

// 定期的なリトライ（30秒間隔）
setInterval(() => {
  if (realtimeSync.isEnabled && navigator.onLine) {
    realtimeSync.retryPendingOperations();
  }
}, 30000);