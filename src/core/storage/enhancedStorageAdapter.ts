/**
 * EnhancedStorageAdapter - 拡張ストレージアダプター
 * 既存のstorageAdapterにクラウド同期機能を追加
 */

import { cloudSyncAdapter } from './cloudSyncAdapter.js';
import { cloudAuthManager } from '../../features/auth/cloudAuthManager.js';

/**
 * ストレージアダプターを拡張してクラウド同期機能を追加
 */
export class EnhancedStorageAdapter {
  private originalAdapter: any;
  private useCloudSync: boolean = false;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(originalAdapter: any) {
    this.originalAdapter = originalAdapter;
    this.initializeCloudSync();
  }

  /**
   * クラウド同期の初期化
   */
  private async initializeCloudSync() {
    // 認証状態の監視
    cloudAuthManager.addEventListener((event) => {
      switch (event.event) {
        case 'login_success':
        case 'oauth_success':
          this.enableCloudSync();
          break;
        case 'logout':
        case 'cloud_logout':
        case 'token_expired':
          this.disableCloudSync();
          break;
      }
    });

    // 初期状態の確認
    if (cloudAuthManager.isCloudAuthEnabled()) {
      this.enableCloudSync();
    }
  }

  /**
   * クラウド同期を有効化
   */
  private enableCloudSync() {
    this.useCloudSync = true;
    this.emitEvent('cloud_sync_enabled', null);
    console.log('🔄 クラウド同期が有効になりました');
  }

  /**
   * クラウド同期を無効化
   */
  private disableCloudSync() {
    this.useCloudSync = false;
    this.emitEvent('cloud_sync_disabled', null);
    console.log('⏹️ クラウド同期が無効になりました');
  }

  // ===== マップ操作（拡張版） =====

  async getAllMaps(): Promise<any[]> {
    if (this.useCloudSync) {
      try {
        const cloudMaps = await cloudSyncAdapter.getAllMaps();
        this.emitEvent('maps_synced', cloudMaps);
        return cloudMaps;
      } catch (error) {
        console.warn('クラウド同期失敗、ローカルデータを使用:', error);
        return await this.originalAdapter.getAllMaps();
      }
    }
    
    return await this.originalAdapter.getAllMaps();
  }

  async getMap(mapId: string): Promise<any> {
    if (this.useCloudSync) {
      try {
        const cloudMap = await cloudSyncAdapter.getMap(mapId);
        this.emitEvent('map_synced', cloudMap);
        return cloudMap;
      } catch (error) {
        console.warn('クラウドマップ取得失敗、ローカルデータを使用:', error);
        return await this.originalAdapter.getMap(mapId);
      }
    }
    
    return await this.originalAdapter.getMap(mapId);
  }

  async createMap(mapData: any): Promise<any> {
    // ローカル作成（即座反映）
    const localResult = await this.originalAdapter.createMap(mapData);
    
    // クラウド同期（非同期）
    if (this.useCloudSync) {
      this.syncMapToCloud('create', mapData).catch(error => {
        console.error('マップ作成のクラウド同期失敗:', error);
        this.emitEvent('sync_error', { operation: 'create', mapId: mapData.id, error });
      });
    }
    
    return localResult;
  }

  async updateMap(mapId: string, mapData: any): Promise<any> {
    // ローカル更新（即座反映）
    const localResult = await this.originalAdapter.updateMap(mapId, mapData);
    
    // クラウド同期（非同期）
    if (this.useCloudSync) {
      this.syncMapToCloud('update', mapData).catch(error => {
        console.error('マップ更新のクラウド同期失敗:', error);
        this.emitEvent('sync_error', { operation: 'update', mapId, error });
      });
    }
    
    return localResult;
  }

  async deleteMap(mapId: string): Promise<any> {
    // ローカル削除（即座反映）
    const localResult = await this.originalAdapter.deleteMap(mapId);
    
    // クラウド同期（非同期）
    if (this.useCloudSync) {
      this.syncMapToCloud('delete', { id: mapId }).catch(error => {
        console.error('マップ削除のクラウド同期失敗:', error);
        this.emitEvent('sync_error', { operation: 'delete', mapId, error });
      });
    }
    
    return localResult;
  }

  // ===== ノード操作（拡張版） =====

  async addNode(mapId: string, nodeData: any, parentId?: string): Promise<any> {
    // ローカル追加（即座反映）
    const localResult = await this.originalAdapter.addNode(mapId, nodeData, parentId);
    
    // クラウド同期（非同期）
    if (this.useCloudSync) {
      this.syncNodeToCloud('create', mapId, nodeData, parentId).catch(error => {
        console.error('ノード追加のクラウド同期失敗:', error);
        this.emitEvent('sync_error', { operation: 'addNode', nodeId: nodeData.id, error });
      });
    }
    
    return localResult;
  }

  async updateNode(mapId: string, nodeId: string, updates: any): Promise<any> {
    // ローカル更新（即座反映）
    const localResult = await this.originalAdapter.updateNode(mapId, nodeId, updates);
    
    // クラウド同期（非同期）
    if (this.useCloudSync) {
      this.syncNodeToCloud('update', mapId, { id: nodeId, ...updates }).catch(error => {
        console.error('ノード更新のクラウド同期失敗:', error);
        this.emitEvent('sync_error', { operation: 'updateNode', nodeId, error });
      });
    }
    
    return localResult;
  }

  async deleteNode(mapId: string, nodeId: string): Promise<any> {
    // ローカル削除（即座反映）
    const localResult = await this.originalAdapter.deleteNode(mapId, nodeId);
    
    // クラウド同期（非同期）
    if (this.useCloudSync) {
      this.syncNodeToCloud('delete', mapId, { id: nodeId }).catch(error => {
        console.error('ノード削除のクラウド同期失敗:', error);
        this.emitEvent('sync_error', { operation: 'deleteNode', nodeId, error });
      });
    }
    
    return localResult;
  }

  async moveNode(mapId: string, nodeId: string, newParentId?: string): Promise<any> {
    // ローカル移動（即座反映）
    const localResult = await this.originalAdapter.moveNode(mapId, nodeId, newParentId);
    
    // クラウド同期（非同期）
    if (this.useCloudSync) {
      this.syncNodeToCloud('move', mapId, { id: nodeId }, newParentId).catch(error => {
        console.error('ノード移動のクラウド同期失敗:', error);
        this.emitEvent('sync_error', { operation: 'moveNode', nodeId, error });
      });
    }
    
    return localResult;
  }

  // ===== 同期ヘルパーメソッド =====

  private async syncMapToCloud(operation: string, mapData: any): Promise<void> {
    switch (operation) {
      case 'create':
        await cloudSyncAdapter.createMap(mapData);
        break;
      case 'update':
        await cloudSyncAdapter.updateMap(mapData.id, mapData);
        break;
      case 'delete':
        await cloudSyncAdapter.deleteMap(mapData.id);
        break;
    }
    
    this.emitEvent('map_sync_completed', { operation, mapId: mapData.id });
  }

  private async syncNodeToCloud(
    operation: string, 
    mapId: string, 
    nodeData: any, 
    parentId?: string
  ): Promise<void> {
    switch (operation) {
      case 'create':
        await cloudSyncAdapter.addNode(mapId, nodeData, parentId);
        break;
      case 'update':
        await cloudSyncAdapter.updateNode(mapId, nodeData.id, nodeData);
        break;
      case 'delete':
        await cloudSyncAdapter.deleteNode(mapId, nodeData.id);
        break;
      case 'move':
        await cloudSyncAdapter.moveNode(mapId, nodeData.id, parentId);
        break;
    }
    
    this.emitEvent('node_sync_completed', { operation, nodeId: nodeData.id });
  }

  // ===== 手動同期制御 =====

  /**
   * 手動で全データを同期
   */
  async manualSync(): Promise<void> {
    if (!this.useCloudSync) {
      throw new Error('クラウド同期が無効です');
    }

    try {
      this.emitEvent('manual_sync_started', null);
      
      // 同期アダプターの手動同期を実行
      await cloudSyncAdapter.manualSync();
      
      // ローカルデータとの整合性チェック
      await this.validateDataConsistency();
      
      this.emitEvent('manual_sync_completed', null);
    } catch (error) {
      this.emitEvent('manual_sync_failed', error);
      throw error;
    }
  }

  /**
   * データ整合性の検証
   */
  private async validateDataConsistency(): Promise<void> {
    try {
      const localMaps = await this.originalAdapter.getAllMaps();
      const cloudMaps = await cloudSyncAdapter.getAllMaps();
      
      const inconsistencies = [];
      
      // ローカルマップとクラウドマップの比較
      for (const localMap of localMaps) {
        const cloudMap = cloudMaps.find(m => m.id === localMap.id);
        
        if (!cloudMap) {
          inconsistencies.push({
            type: 'missing_cloud',
            mapId: localMap.id,
            title: localMap.title
          });
        } else if (localMap.lastModified !== cloudMap.lastModified) {
          inconsistencies.push({
            type: 'timestamp_mismatch',
            mapId: localMap.id,
            localTime: localMap.lastModified,
            cloudTime: cloudMap.lastModified
          });
        }
      }
      
      if (inconsistencies.length > 0) {
        this.emitEvent('data_inconsistency_detected', inconsistencies);
        console.warn('データ整合性の問題が検出されました:', inconsistencies);
      }
      
    } catch (error) {
      console.error('データ整合性検証エラー:', error);
    }
  }

  // ===== 統計・監視 =====

  getSyncStats(): any {
    return {
      isCloudSyncEnabled: this.useCloudSync,
      cloudSyncStats: this.useCloudSync ? cloudSyncAdapter.getStats() : null,
      authStatus: cloudAuthManager.isCloudAuthEnabled()
    };
  }

  getOperationQueue(): any[] {
    return this.useCloudSync ? cloudSyncAdapter.getOperationQueue() : [];
  }

  getConflictQueue(): any[] {
    return this.useCloudSync ? cloudSyncAdapter.getConflictQueue() : [];
  }

  // ===== イベント管理 =====

  addEventListener(event: string, listener: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    // クラウド同期アダプターのイベントも転送
    if (this.useCloudSync) {
      const unsubscribe = cloudSyncAdapter.addEventListener(event, listener);
      return () => {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
          listeners.delete(listener);
        }
        unsubscribe();
      };
    }

    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      });
    }
  }

  // ===== 既存メソッドの委譲 =====

  get name(): string {
    return `${this.originalAdapter.name}${this.useCloudSync ? ' + 同期' : ''}`;
  }

  async debugAuthState(): Promise<any> {
    const originalState = this.originalAdapter.debugAuthState ? 
      await this.originalAdapter.debugAuthState() : {};
    
    return {
      ...originalState,
      cloudSyncEnabled: this.useCloudSync,
      cloudAuthEnabled: cloudAuthManager.isCloudAuthEnabled(),
      cloudUser: cloudAuthManager.getCloudUser()
    };
  }

  // その他の既存メソッドを委譲
  async ensureInitialized(): Promise<void> {
    if (this.originalAdapter.ensureInitialized) {
      await this.originalAdapter.ensureInitialized();
    }
  }

  async initialize(): Promise<void> {
    if (this.originalAdapter.initialize) {
      await this.originalAdapter.initialize();
    }
  }

  // 必要に応じて他のメソッドも委譲
  [key: string]: any;
}

/**
 * 既存のアダプターを拡張
 */
export function enhanceStorageAdapter(originalAdapter: any): EnhancedStorageAdapter {
  return new EnhancedStorageAdapter(originalAdapter);
}