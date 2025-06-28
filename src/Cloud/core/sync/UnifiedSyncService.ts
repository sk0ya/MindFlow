/**
 * UnifiedSyncService - 統一同期システム
 * 
 * 機能:
 * - ローカル/クラウドモードの統一インターフェース
 * - 編集保護システムとの統合
 * - 効率的な同期処理
 * - 競合解決
 */

import { EditProtectionManager, EditMode, UpdateOptions, EditEventData } from './EditProtectionManager.js';
import { getCurrentMindMap, updateMindMap, getAllMindMaps } from '../storage/StorageManager.js';
import { unifiedAuthManager } from '../../features/auth/UnifiedAuthManager.js';
import type { MindMapData, Node } from '../storage/types.js';
import type { AuthState } from '../../features/auth/types/authTypes.js';

// ===== Type Definitions =====

export type SyncMode = 'local' | 'cloud';

export interface SyncConfiguration {
  apiBaseUrl?: string;
  syncInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableBatchOperations?: boolean;
  enableRealTimeSync?: boolean;
}

export interface SyncEventData {
  data?: MindMapData;
  options?: SyncOptions;
  timestamp?: number;
  error?: Error;
  mode?: SyncMode;
  editingNodes?: string[];
  source?: string;
  nodeId?: string;
  queueSize?: number;
  processedCount?: number;
  remainingQueue?: number;
}

export interface SyncOptions {
  force?: boolean;
  forceUpdate?: boolean;
  source?: string;
  nodeId?: string;
  priority?: 'high' | 'normal' | 'low';
  reason?: string;
}

export interface QueuedSave {
  data: MindMapData;
  options: SyncOptions;
  timestamp: number;
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete' | 'move';
  nodeId?: string;
  data?: Partial<Node> | { x: number; y: number; parentId?: string };
}

export interface BatchOptions {
  stopOnError?: boolean;
}

export interface BatchResult {
  success: boolean;
  total: number;
  processed: number;
  errors: number;
  results: BatchOperationResult[];
  errorDetails?: BatchError[];
}

export interface BatchOperationResult {
  index: number;
  operation: string;
  nodeId?: string;
  success: boolean;
  result: any;
}

export interface BatchError {
  index: number;
  operation: string;
  nodeId?: string;
  error: string;
}

export interface CloudAPIBatchData {
  operations: BatchOperation[];
  version: number;
  stopOnError: boolean;
}

export interface SyncStats {
  mode: SyncMode;
  isSyncing: boolean;
  lastSyncTime: number | null;
  queuedSaves: number;
  editProtection: any;
}

export type SyncEventType = 'sync_start' | 'sync_success' | 'sync_error' | 'mode_changed' | 'full_sync_start' | 'full_sync_success' | 'full_sync_error';
export type SyncEventListener = (data: SyncEventData) => void;
export type SyncEventUnsubscriber = () => void;

export class UnifiedSyncService {
  private mode: SyncMode;
  private editProtection: EditProtectionManager;
  private isSyncing: boolean;
  private syncQueue: QueuedSave[];
  private lastSyncTime: number | null;
  private eventListeners: Map<SyncEventType, SyncEventListener[]>;
  private syncInterval: NodeJS.Timeout | null;
  private apiClient: CloudAPIClient | null;

  constructor() {
    this.mode = 'local';
    this.editProtection = new EditProtectionManager(this.mode);
    this.isSyncing = false;
    this.syncQueue = [];
    this.lastSyncTime = null;
    this.eventListeners = new Map();
    this.syncInterval = null;
    this.apiClient = null;
    
    // 編集保護システムとの統合
    this.setupEditProtectionIntegration();
  }

  // ===== 初期化 =====

  /**
   * サービス初期化
   */
  async initialize(mode: SyncMode = 'local', config: SyncConfiguration = {}): Promise<void> {
    console.log(`🚀 UnifiedSyncService初期化: ${mode}モード`);
    
    this.mode = mode;
    this.editProtection.mode = mode;
    
    if (mode === 'cloud') {
      await this.initializeCloudMode(config);
    } else {
      await this.initializeLocalMode(config);
    }
    
    this.startSyncScheduler();
  }

  /**
   * ローカルモード初期化
   */
  private async initializeLocalMode(config: SyncConfiguration): Promise<void> {
    console.log('📱 ローカルモード初期化');
    // ローカルストレージの整合性チェック
    // 必要に応じて追加設定
  }

  /**
   * クラウドモード初期化
   */
  private async initializeCloudMode(config: SyncConfiguration): Promise<void> {
    console.log('☁️ クラウドモード初期化');
    
    // API クライアント設定
    this.apiClient = new CloudAPIClient(
      config.apiBaseUrl || 'https://mindflow-api-production.shigekazukoya.workers.dev',
      await this.getAuthToken()
    );
    
    // 認証状態の監視
    unifiedAuthManager.onAuthStateChange((authState: AuthState) => {
      if (authState.isAuthenticated && this.apiClient && authState.token) {
        this.apiClient.updateToken(authState.token);
      } else {
        this.switchToLocalMode();
      }
    });
    
    // 初回同期
    await this.performFullSync();
  }

  // ===== モード切り替え =====

  /**
   * ローカルモードに切り替え
   */
  async switchToLocalMode(): Promise<void> {
    console.log('📱 ローカルモードに切り替え');
    
    // 編集中のセッションを保護
    const editingNodes = this.editProtection.getEditingNodes();
    if (editingNodes.length > 0) {
      console.log(`⏸️ 編集中のノード保護: ${editingNodes.join(', ')}`);
    }
    
    this.mode = 'local';
    this.editProtection.mode = 'local';
    this.apiClient = null;
    
    this.emit('mode_changed', { mode: 'local', editingNodes });
  }

  /**
   * クラウドモードに切り替え
   */
  async switchToCloudMode(config: SyncConfiguration = {}): Promise<void> {
    console.log('☁️ クラウドモードに切り替え');
    
    try {
      await this.initializeCloudMode(config);
      this.emit('mode_changed', { mode: 'cloud' });
    } catch (error) {
      console.error('❌ クラウドモード切り替え失敗:', error);
      await this.switchToLocalMode();
      throw error;
    }
  }

  // ===== 編集保護統合 =====

  /**
   * 編集保護システムとの統合設定
   */
  private setupEditProtectionIntegration(): void {
    // 編集確定時の保存処理
    this.editProtection.on('edit_committed', async (eventData: EditEventData) => {
      if (eventData.nodeId && eventData.finalValue !== undefined) {
        await this.saveNodeEdit(eventData.nodeId, eventData.finalValue, eventData.options);
      }
    });

    // 更新適用処理
    this.editProtection.on('update_applied', async (eventData: EditEventData) => {
      if (eventData.nodeId && eventData.data) {
        await this.applyNodeUpdate(eventData.nodeId, eventData.data, eventData.options);
      }
    });

    // 編集開始/終了の通知（クラウドモード用）
    this.editProtection.on('notify_edit_start', (eventData: EditEventData) => {
      if (this.mode === 'cloud' && this.apiClient && eventData.nodeId && eventData.userId) {
        this.apiClient.notifyEditStart(eventData.nodeId, eventData.userId);
      }
    });

    this.editProtection.on('notify_edit_end', (eventData: EditEventData) => {
      if (this.mode === 'cloud' && this.apiClient && eventData.nodeId && eventData.userId) {
        this.apiClient.notifyEditEnd(eventData.nodeId, eventData.userId);
      }
    });
  }

  // ===== データ操作API =====

  /**
   * データ保存（編集保護付き）
   */
  async saveData(data: MindMapData, options: SyncOptions = {}): Promise<void> {
    if (!data || (data as any).isPlaceholder) {
      console.log('⏭️ プレースホルダーデータのため保存をスキップ');
      return;
    }

    // 編集中チェック
    if (this.editProtection.isEditing() && !options.forceUpdate) {
      console.log('✋ 編集中のため保存を延期');
      this.queueSave(data, options);
      return;
    }

    await this.performSave(data, options);
  }

  /**
   * 実際の保存処理
   */
  private async performSave(data: MindMapData, options: SyncOptions = {}): Promise<void> {
    if (this.isSyncing && !options.force) {
      console.log('⏸️ 同期中のため保存をスキップ');
      return;
    }

    try {
      this.isSyncing = true;
      this.emit('sync_start', { data, options });

      if (this.mode === 'cloud' && this.apiClient) {
        await this.apiClient.saveMindMap(data);
      } else {
        await updateMindMap(data);
      }

      this.lastSyncTime = Date.now();
      this.emit('sync_success', { data, options, timestamp: this.lastSyncTime });

      console.log(`💾 保存完了: ${data.title} (${this.mode}モード)`);

    } catch (error) {
      console.error('❌ 保存失敗:', error);
      this.emit('sync_error', { error, data, options });
      
      // クラウドモードで失敗した場合、ローカルに保存
      if (this.mode === 'cloud') {
        console.log('🔄 ローカルバックアップ保存');
        await updateMindMap(data);
      }
      
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 保存をキューに追加
   */
  private queueSave(data: MindMapData, options: SyncOptions): void {
    this.syncQueue.push({ data, options, timestamp: Date.now() });
    console.log(`📋 保存キュー追加: ${data.title}`);
  }

  /**
   * キューされた保存を処理
   */
  private async processQueuedSaves(): Promise<void> {
    if (this.syncQueue.length === 0 || this.editProtection.isEditing()) {
      return;
    }

    // 最新の保存のみを実行
    const latestSave = this.syncQueue.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );

    this.syncQueue = [];

    try {
      await this.performSave(latestSave.data, latestSave.options);
      console.log('🔄 キューされた保存を実行');
    } catch (error) {
      console.error('❌ キューされた保存に失敗:', error);
    }
  }

  /**
   * ノード編集保存
   */
  private async saveNodeEdit(nodeId: string, finalValue: string, options?: UpdateOptions): Promise<void> {
    try {
      // 現在のデータを取得
      const currentData = await getCurrentMindMap();
      if (!currentData) return;

      // ノードを更新
      const updatedData = this.updateNodeInData(currentData, nodeId, { text: finalValue });
      
      // 保存実行
      await this.performSave(updatedData, { 
        ...(options || {}), 
        source: 'node_edit',
        nodeId 
      });

    } catch (error) {
      console.error(`❌ ノード編集保存失敗 [${nodeId}]:`, error);
      throw error;
    }
  }

  /**
   * ノード更新適用
   */
  private async applyNodeUpdate(nodeId: string, updateData: any, options?: UpdateOptions): Promise<void> {
    try {
      // 現在のデータを取得
      const currentData = await getCurrentMindMap();
      if (!currentData) return;

      // ノードを更新
      const updatedData = this.updateNodeInData(currentData, nodeId, updateData);
      
      // 保存実行
      await this.performSave(updatedData, { 
        ...(options || {}), 
        source: 'node_update',
        nodeId 
      });

    } catch (error) {
      console.error(`❌ ノード更新適用失敗 [${nodeId}]:`, error);
      throw error;
    }
  }

  // ===== バッチ操作API =====

  /**
   * バッチ操作実行
   */
  private async executeBatchOperations(operations: BatchOperation[], options: BatchOptions = {}): Promise<BatchResult> {
    if (!this.apiClient) {
      // ローカルモードではバッチ処理をシミュレート
      return await this.executeBatchOperationsLocal(operations, options);
    }

    // クラウドモードでバッチAPI使用
    return await this.executeBatchOperationsCloud(operations, options);
  }

  /**
   * ローカルモードでのバッチ操作シミュレート
   */
  private async executeBatchOperationsLocal(operations: BatchOperation[], options: BatchOptions): Promise<BatchResult> {
    const results: BatchOperationResult[] = [];
    const errors: BatchError[] = [];
    let processedCount = 0;

    try {
      const currentData = await getCurrentMindMap();
      if (!currentData) {
        throw new Error('No current mindmap data');
      }

      let updatedData = JSON.parse(JSON.stringify(currentData));

      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        try {
          switch (operation.type) {
            case 'create':
              const newNode = this.createNodeInData(updatedData, operation.data);
              results.push({
                index: i,
                operation: 'create',
                nodeId: newNode.id,
                success: true,
                result: newNode
              });
              break;
              
            case 'update':
              this.updateNodeInData(updatedData, operation.nodeId, operation.data);
              results.push({
                index: i,
                operation: 'update',
                nodeId: operation.nodeId,
                success: true,
                result: { updated: true }
              });
              break;
              
            case 'delete':
              this.deleteNodeInData(updatedData, operation.nodeId);
              results.push({
                index: i,
                operation: 'delete',
                nodeId: operation.nodeId,
                success: true,
                result: { deleted: true }
              });
              break;
              
            case 'move':
              this.updateNodeInData(updatedData, operation.nodeId, {
                x: operation.data.x,
                y: operation.data.y,
                parentId: operation.data.parentId
              });
              results.push({
                index: i,
                operation: 'move',
                nodeId: operation.nodeId,
                success: true,
                result: { moved: true }
              });
              break;
              
            default:
              throw new Error(`Unsupported operation: ${operation.type}`);
          }
          
          processedCount++;
          
        } catch (operationError) {
          errors.push({
            index: i,
            operation: operation.type,
            nodeId: operation.nodeId,
            error: operationError.message
          });
          
          if (options.stopOnError) {
            break;
          }
        }
      }

      // 変更をまとめて保存
      if (processedCount > 0) {
        await this.performSave(updatedData, {
          ...options,
          source: 'batch_operation'
        });
      }

      return {
        success: errors.length === 0,
        total: operations.length,
        processed: processedCount,
        errors: errors.length,
        results: results,
        errorDetails: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('❌ ローカルバッチ操作失敗:', error);
      throw error;
    }
  }

  /**
   * クラウドモードでのバッチAPI実行
   */
  private async executeBatchOperationsCloud(operations: BatchOperation[], options: BatchOptions): Promise<BatchResult> {
    try {
      const currentData = await getCurrentMindMap();
      if (!currentData) {
        throw new Error('No current mindmap data');
      }

      const response = await this.apiClient.executeBatch(currentData.id, {
        operations: operations,
        version: (currentData as any).version || 1,
        stopOnError: options.stopOnError || false
      });

      // 成功した場合、ローカルデータを更新
      if (response.success && response.processed > 0) {
        // サーバーから最新データを取得
        await this.performFullSync();
      }

      return response;

    } catch (error) {
      console.error('❌ クラウドバッチ操作失敗:', error);
      
      // フォールバック: ローカルで実行
      console.log('🔄 ローカルバッチ操作にフォールバック');
      return await this.executeBatchOperationsLocal(operations, options);
    }
  }

  // ===== データ操作ヘルパー =====

  /**
   * データ内にノードを作成
   */
  private createNodeInData(data: MindMapData, nodeData: Partial<Node> & { parentId?: string }): Node {
    const newNode: Node = {
      id: nodeData.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: nodeData.text || 'New Node',
      x: nodeData.x || 0,
      y: nodeData.y || 0,
      fontSize: nodeData.fontSize || 14,
      fontWeight: nodeData.fontWeight || 'normal',
      color: nodeData.color || '#333333',
      children: []
    };

    // 親ノードに追加
    const parentId = nodeData.parentId || data.rootNode.id;
    const parentNode = this.findNodeInData(data, parentId);
    
    if (parentNode) {
      if (!parentNode.children) {
        parentNode.children = [];
      }
      parentNode.children.push(newNode);
    }

    return newNode;
  }

  /**
   * データ内のノードを削除
   */
  private deleteNodeInData(data: MindMapData, nodeId: string): void {
    const deleteNodeRecursive = (node: Node, parent: Node | null = null): boolean => {
      if (node.id === nodeId) {
        if (parent && parent.children) {
          const index = parent.children.indexOf(node);
          if (index !== -1) {
            parent.children.splice(index, 1);
          }
        }
        return true;
      }
      
      if (node.children) {
        for (const child of node.children) {
          if (deleteNodeRecursive(child, node)) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    // ルートノードは削除不可
    if (nodeId === data.rootNode.id) {
      throw new Error('Cannot delete root node');
    }
    
    deleteNodeRecursive(data.rootNode);
  }

  /**
   * データ内のノードを検索
   */
  private findNodeInData(data: MindMapData, nodeId: string): Node | null {
    const findNodeRecursive = (node: Node): Node | null => {
      if (node.id === nodeId) {
        return node;
      }
      
      if (node.children) {
        for (const child of node.children) {
          const found = findNodeRecursive(child);
          if (found) {
            return found;
          }
        }
      }
      
      return null;
    };
    
    return findNodeRecursive(data.rootNode);
  }

  // ===== ユーティリティ =====

  /**
   * データ内のノードを更新
   */
  private updateNodeInData(data: MindMapData, nodeId: string, updates: Partial<Node>): MindMapData {
    const clonedData = JSON.parse(JSON.stringify(data));
    
    const updateNodeRecursive = (node: Node): boolean => {
      if (node.id === nodeId) {
        Object.assign(node, updates);
        return true;
      }
      
      if (node.children) {
        for (const child of node.children) {
          if (updateNodeRecursive(child)) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    updateNodeRecursive(clonedData.rootNode);
    return clonedData;
  }

  /**
   * 認証トークンを取得
   */
  private async getAuthToken(): Promise<string | null> {
    const authState = unifiedAuthManager.getAuthState();
    return authState.isAuthenticated ? authState.token : null;
  }

  // ===== 同期スケジューラー =====

  /**
   * 同期スケジューラー開始
   */
  private startSyncScheduler(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // インテリジェント同期間隔
    const baseInterval = this.mode === 'cloud' ? 30000 : 60000; // 30秒 or 60秒
    
    this.syncInterval = setInterval(async () => {
      try {
        // キューされた保存を処理
        await this.processQueuedSaves();
        
        // クラウドモードの場合は追加同期チェック
        if (this.mode === 'cloud') {
          await this.performIncrementalSync();
        }
        
      } catch (error) {
        console.error('❌ 定期同期エラー:', error);
      }
    }, baseInterval);

    console.log(`⏰ 同期スケジューラー開始: ${baseInterval}ms間隔`);
  }

  /**
   * 増分同期実行
   */
  private async performIncrementalSync(): Promise<void> {
    if (this.isSyncing || this.editProtection.isEditing()) {
      return;
    }

    try {
      // サーバーから最新の変更をチェック
      if (this.apiClient && this.lastSyncTime !== null) {
        const hasRemoteChanges = await this.apiClient.checkForUpdates(this.lastSyncTime);
        if (hasRemoteChanges) {
          console.log('🔄 リモート変更を検出、増分同期実行');
          await this.performFullSync();
        }
      }
    } catch (error) {
      console.error('❌ 増分同期エラー:', error);
    }
  }

  /**
   * 完全同期実行
   */
  private async performFullSync(): Promise<void> {
    if (!this.apiClient) return;

    try {
      this.isSyncing = true;
      this.emit('full_sync_start');

      const serverData = await this.apiClient.getAllMindMaps();
      const localData = await getAllMindMaps();

      // 競合解決
      const mergedData = await this.resolveConflicts(serverData, localData);
      
      // 統合データを保存
      for (const mindmap of mergedData) {
        await updateMindMap(mindmap);
      }

      this.lastSyncTime = Date.now();
      this.emit('full_sync_success', { timestamp: this.lastSyncTime });
      
      console.log('✅ 完全同期完了');

    } catch (error) {
      console.error('❌ 完全同期エラー:', error);
      this.emit('full_sync_error', { error });
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 競合解決
   */
  private async resolveConflicts(serverData: MindMapData[], localData: MindMapData[]): Promise<MindMapData[]> {
    // シンプルなタイムスタンプベース競合解決
    const merged = new Map();
    
    // ローカルデータを追加
    for (const item of localData) {
      merged.set(item.id, item);
    }
    
    // サーバーデータと比較・統合
    for (const serverItem of serverData) {
      const localItem = merged.get(serverItem.id);
      
      if (!localItem) {
        // ローカルにない場合は追加
        merged.set(serverItem.id, serverItem);
      } else {
        // タイムスタンプで判定（新しい方を採用）
        const serverTime = new Date(serverItem.updatedAt || '1970-01-01').getTime();
        const localTime = new Date(localItem.updatedAt || '1970-01-01').getTime();
        
        if (serverTime > localTime) {
          merged.set(serverItem.id, serverItem);
          console.log(`🔄 競合解決: サーバー版を採用 [${serverItem.id}]`);
        } else {
          console.log(`🔄 競合解決: ローカル版を採用 [${localItem.id}]`);
        }
      }
    }
    
    return Array.from(merged.values());
  }

  // ===== イベント管理 =====

  /**
   * イベントリスナー追加
   */
  on(event: SyncEventType, listener: SyncEventListener): SyncEventUnsubscriber {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
    
    return () => this.off(event, listener);
  }

  /**
   * イベントリスナー削除
   */
  off(event: SyncEventType, listener: SyncEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * イベント発火
   */
  private emit(event: SyncEventType, data?: SyncEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data || {});
        } catch (error) {
          console.error(`同期イベントエラー [${event}]:`, error);
        }
      });
    }
  }

  // ===== 公開API =====

  /**
   * 編集開始
   */
  startEdit(nodeId: string, originalValue: string = ''): any {
    return this.editProtection.startEdit(nodeId, originalValue);
  }

  /**
   * 編集更新
   */
  updateEdit(nodeId: string, currentValue: string): void {
    this.editProtection.updateEdit(nodeId, currentValue);
  }

  /**
   * 編集終了
   */
  finishEdit(nodeId: string, finalValue: string): void {
    this.editProtection.finishEdit(nodeId, finalValue);
  }

  /**
   * 編集中チェック
   */
  isEditing(nodeId?: string): boolean {
    return this.editProtection.isEditing(nodeId);
  }

  /**
   * 強制同期
   */
  async forceSync(): Promise<void> {
    if (this.mode === 'cloud') {
      await this.performFullSync();
    }
  }

  /**
   * 統計情報取得
   */
  getStats(): SyncStats {
    return {
      mode: this.mode,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      queuedSaves: this.syncQueue.length,
      editProtection: this.editProtection.getStats()
    };
  }

  /**
   * バッチ操作実行（公開API）
   */
  async batchExecute(operations: BatchOperation[], options: BatchOptions = {}): Promise<BatchResult> {
    return await this.executeBatchOperations(operations, options);
  }

  /**
   * サーバー統計取得（公開API）
   */
  async getServerStats(): Promise<any> {
    if (this.mode === 'cloud' && this.apiClient) {
      const currentData = await getCurrentMindMap();
      if (currentData) {
        return await this.apiClient.getStats(currentData.id);
      }
    }
    return null;
  }

  // ===== クリーンアップ =====

  /**
   * サービス停止
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.editProtection.destroy();
    this.eventListeners.clear();
    this.syncQueue = [];

    console.log('🧹 UnifiedSyncService destroyed');
  }
}

/**
 * CloudAPIClient - クラウドAPI通信
 */
class CloudAPIClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  updateToken(token: string): void {
    this.authToken = token;
  }

  async saveMindMap(data: MindMapData): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/mindmaps/${data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`保存失敗: ${response.status}`);
    }

    return await response.json();
  }

  async getAllMindMaps(): Promise<MindMapData[]> {
    const response = await fetch(`${this.baseUrl}/api/mindmaps`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`取得失敗: ${response.status}`);
    }

    return await response.json();
  }

  async checkForUpdates(lastSync: number): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/mindmaps/changes?since=${lastSync}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      return false;
    }

    const changes = await response.json();
    return changes.length > 0;
  }

  async notifyEditStart(nodeId: string, userId: string): Promise<void> {
    // WebSocket実装時に追加
  }

  async notifyEditEnd(nodeId: string, userId: string): Promise<void> {
    // WebSocket実装時に追加
  }

  async executeBatch(mindmapId: string, batchData: CloudAPIBatchData): Promise<BatchResult> {
    const response = await fetch(`${this.baseUrl}/api/nodes/${mindmapId}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify(batchData)
    });

    if (!response.ok) {
      throw new Error(`バッチ操作失敗: ${response.status}`);
    }

    return await response.json();
  }

  async getStats(mindmapId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/nodes/${mindmapId}/stats`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`統計取得失敗: ${response.status}`);
    }

    return await response.json();
  }
}

// シングルトンインスタンス
export const unifiedSyncService = new UnifiedSyncService();

export default UnifiedSyncService;