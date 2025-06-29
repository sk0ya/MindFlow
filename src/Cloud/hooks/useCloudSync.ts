import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncStateManager } from '../utils/SyncStateManager.js';
import { OperationQueue } from '../utils/OperationQueue.js';
import { RealtimeCommunication } from '../utils/RealtimeCommunication.js';
import { ConflictResolver } from '../utils/ConflictResolver.js';

// ===== TYPE DEFINITIONS =====

/**
 * Vector Clock type for conflict resolution
 */
export interface VectorClock {
  [userId: string]: number;
}

/**
 * Node position data
 */
export interface NodePosition {
  x: number;
  y: number;
  parent_id?: string;
}

/**
 * Node data structure
 */
export interface NodeData {
  id: string;
  text: string;
  x: number;
  y: number;
  parent_id?: string;
  children?: NodeData[];
  fontSize?: number;
  fontWeight?: string;
  collapsed?: boolean;
  attachments?: any[];
  mapLinks?: any[];
  color?: string;
}

/**
 * Operation types for cloud sync
 */
export type OperationType = 'create' | 'update' | 'delete' | 'move';
export type TargetType = 'node' | 'mindmap' | 'edge';

/**
 * Sync operation structure
 */
export interface SyncOperation {
  id?: string;
  operation_type: OperationType;
  target_type: TargetType;
  target_id: string;
  mindmap_id: string;
  data: any;
  user_id?: string;
  timestamp?: string;
  vector_clock?: VectorClock;
  retry_count?: number;
}

/**
 * Cursor position data for real-time collaboration
 */
export interface CursorData {
  nodeId?: string;
  x: number;
  y: number;
  userId: string;
  timestamp: string;
}

/**
 * User presence information
 */
export interface PresenceData {
  userId: string;
  name?: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
  currentNode?: string;
}

/**
 * Connection quality levels
 */
export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'bad' | 'unknown';

/**
 * Sync state interface
 */
export interface SyncState {
  // Connection status
  isOnline: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  connectionQuality: ConnectionQuality;
  lastSyncTime: string | null;
  lastPingTime: string | null;
  pingLatency: number | null;
  
  // Operation management
  pendingOperations: SyncOperation[];
  vectorClock: VectorClock;
  operationHistory: SyncOperation[];
  conflictQueue: any[];
  
  // Active users
  activeUsers: Map<string, PresenceData>;
  userPresences: Map<string, PresenceData>;
  
  // Editing state
  editingUsers: Map<string, Set<string>>; // nodeId -> Set<userId>
  cursorPositions: Map<string, CursorData>; // userId -> CursorPosition
  
  // Error management
  connectionRetryCount: number;
  lastError: Error | null;
  errors: Error[];
  
  // Performance metrics
  messageCount: number;
  messageRate: number;
  bandwidthUsage: number;
  
  // Configuration
  autoSyncInterval: number;
  maxRetryAttempts: number;
  operationHistoryLimit: number;
}

/**
 * Configuration for CloudSyncService initialization
 */
export interface CloudSyncConfig {
  apiBaseUrl?: string;
  authToken?: string;
  websocketUrl?: string;
  autoSyncInterval?: number;
  maxRetryAttempts?: number;
  batchSize?: number;
  batchTimeout?: number;
}

/**
 * Event data for state changes
 */
export interface StateChangeEvent {
  event: string;
  data: {
    newState?: SyncState;
    oldState?: SyncState;
    [key: string]: any;
  };
}

/**
 * Event data for conflict resolution
 */
export interface ConflictResolutionEvent {
  operation: SyncOperation;
  resolution: 'auto' | 'manual' | 'merge';
  timestamp: string;
}

/**
 * Event data for operation application
 */
export interface OperationAppliedEvent {
  operation: SyncOperation;
  result: 'success' | 'error' | 'conflict';
  error?: Error;
}

/**
 * Event data for local operation updates
 */
export interface LocalOperationUpdateEvent {
  operationId: string;
  updatedOperation: SyncOperation;
}

/**
 * Full sync conflict data
 */
export interface FullSyncConflictData {
  serverData: any;
  localData: any;
}

/**
 * Statistics interface
 */
export interface SyncStats {
  syncState: any;
  operationQueue: any;
  realtimeCommunication: any;
  conflictResolver: any;
}

/**
 * Local data interface
 */
export interface LocalData {
  mindmapId: string | null;
  vectorClock: VectorClock;
  pendingOperations: SyncOperation[];
}

/**
 * HTTP request options
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  [key: string]: any;
}

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * State change listener function type
 */
export type StateChangeListener = (event: StateChangeEvent) => void;

/**
 * Real-time event listener function type
 */
export type RealtimeEventListener = (data: any) => void;

/**
 * Cleanup function type
 */
export type CleanupFunction = () => void;

/**
 * React hook return type for useCloudSync
 */
export interface UseCloudSyncReturn {
  // State
  syncState: SyncState;
  isInitialized: boolean;
  error: Error | null;
  
  // Operation API
  createNode: (nodeData: NodeData) => Promise<string>;
  updateNode: (nodeId: string, updates: Partial<NodeData>) => Promise<string>;
  deleteNode: (nodeId: string) => Promise<string>;
  moveNode: (nodeId: string, position: NodePosition) => Promise<string>;
  
  // Real-time collaboration
  updateCursor: (cursor: CursorData) => void;
  startEditing: (nodeId: string) => void;
  endEditing: (nodeId: string) => void;
  
  // Sync control
  forceSync: () => Promise<any>;
  fullSync: () => Promise<any>;
  
  // State monitoring
  onStateChange: (listener: StateChangeListener) => CleanupFunction;
  onRealtimeEvent: (event: string, listener: RealtimeEventListener) => CleanupFunction;
  
  // Statistics
  getStats: () => SyncStats;
}

/**
 * CloudSyncService - 統合同期サービス
 * 全同期コンポーネントを統合し、Reactフックとして提供
 */
class CloudSyncService {
  private syncStateManager: SyncStateManager;
  private operationQueue: OperationQueue | null;
  private realtimeCommunication: RealtimeCommunication | null;
  private conflictResolver: ConflictResolver;
  private currentMindmapId: string | null;
  private apiClient: APIClient | null;
  private isInitialized: boolean;
  private periodicSyncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.syncStateManager = new SyncStateManager();
    this.operationQueue = null; // APIクライアント設定後に初期化
    this.realtimeCommunication = null;
    this.conflictResolver = new ConflictResolver(this.syncStateManager as any);
    this.currentMindmapId = null;
    this.apiClient = null;
    this.isInitialized = false;
    
    this.setupEventHandlers();
  }

  /**
   * イベントハンドラーを設定
   */
  private setupEventHandlers(): void {
    // リアルタイム通信からの操作適用
    document.addEventListener('operation_applied', this.handleOperationApplied.bind(this));
    
    // 競合解決完了
    document.addEventListener('conflict_resolved', this.handleConflictResolved.bind(this));
    
    // ローカル操作更新
    document.addEventListener('local_operation_updated', this.handleLocalOperationUpdated.bind(this));
  }

  /**
   * サービス初期化
   * @param mindmapId - マインドマップID
   * @param config - 設定
   */
  async initialize(mindmapId: string, config: CloudSyncConfig = {}): Promise<void> {
    if (this.isInitialized && this.currentMindmapId === mindmapId) {
      return;
    }

    this.currentMindmapId = mindmapId;
    
    // API クライアント設定
    this.apiClient = new APIClient(config.apiBaseUrl, config.authToken);
    
    // 操作キュー初期化
    this.operationQueue = new OperationQueue(this.syncStateManager, this.apiClient);
    
    // リアルタイム通信初期化
    if (config.websocketUrl && config.authToken) {
      this.realtimeCommunication = new RealtimeCommunication(
        config.websocketUrl,
        config.authToken
      );
      
      try {
        await this.realtimeCommunication.connect(mindmapId);
      } catch (error) {
        console.warn('Real-time communication failed to connect:', error);
        // リアルタイム通信なしでも動作を継続
      }
    }

    // 定期同期設定
    this.setupPeriodicSync();
    
    // 未送信操作の処理
    if (this.operationQueue) {
      await this.operationQueue.processQueue();
    }

    this.isInitialized = true;
  }

  /**
   * 定期同期を設定
   */
  private setupPeriodicSync(): void {
    // 🔧 修正: 定期同期の頻度を最適化（30秒→60秒）と条件強化
    this.periodicSyncInterval = setInterval(() => {
      // オンライン状態、非同期中、未処理操作の存在をチェック
      if (this.syncStateManager.state.isOnline && 
          !this.syncStateManager.state.isSyncing &&
          this.operationQueue && 
          this.operationQueue.getPendingCount() > 0) { // 未処理操作がある場合のみ実行
        console.log('🔄 定期同期: 未処理操作を処理', {
          pendingCount: this.operationQueue.getPendingCount()
        });
        this.operationQueue.processQueue();
      }
    }, 60000); // 60秒に延長
  }

  // ===== 操作API =====

  /**
   * ノード作成
   * @param nodeData - ノードデータ
   * @returns 操作ID
   */
  async createNode(nodeData: NodeData): Promise<string> {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    const operation = {
      operation_type: 'create',
      target_type: 'node',
      target_id: nodeData.id,
      mindmap_id: this.currentMindmapId,
      data: nodeData
    };

    return await this.operationQueue.addOperation(operation) as string;
  }

  /**
   * ノード更新
   * @param nodeId - ノードID
   * @param updates - 更新データ
   * @returns 操作ID
   */
  async updateNode(nodeId: string, updates: Partial<NodeData>): Promise<string> {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    const operation = {
      operation_type: 'update',
      target_type: 'node',
      target_id: nodeId,
      mindmap_id: this.currentMindmapId,
      data: updates
    };

    return await this.operationQueue.addOperation(operation) as string;
  }

  /**
   * ノード削除
   * @param nodeId - ノードID
   * @returns 操作ID
   */
  async deleteNode(nodeId: string): Promise<string> {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    const operation = {
      operation_type: 'delete',
      target_type: 'node',
      target_id: nodeId,
      mindmap_id: this.currentMindmapId,
      data: {}
    };

    return await this.operationQueue.addOperation(operation) as string;
  }

  /**
   * ノード移動
   * @param nodeId - ノードID
   * @param newPosition - 新しい位置 {x, y, parent_id}
   * @returns 操作ID
   */
  async moveNode(nodeId: string, newPosition: NodePosition): Promise<string> {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    const operation = {
      operation_type: 'move',
      target_type: 'node',
      target_id: nodeId,
      mindmap_id: this.currentMindmapId,
      data: newPosition
    };

    return await this.operationQueue.addOperation(operation) as string;
  }

  // ===== リアルタイム協調編集 =====

  /**
   * カーソル位置更新
   * @param cursorData - カーソルデータ
   */
  updateCursor(cursorData: CursorData): void {
    if (this.realtimeCommunication) {
      this.realtimeCommunication.sendCursorUpdate(cursorData);
    }
  }

  /**
   * 編集開始通知
   * @param nodeId - ノードID
   */
  startEditing(nodeId: string): void {
    if (this.realtimeCommunication) {
      this.realtimeCommunication.sendEditingStart(nodeId);
    }
    this.syncStateManager.startEditing(nodeId, this.getCurrentUserId());
  }

  /**
   * 編集終了通知
   * @param nodeId - ノードID
   */
  endEditing(nodeId: string): void {
    if (this.realtimeCommunication) {
      this.realtimeCommunication.sendEditingEnd(nodeId);
    }
    this.syncStateManager.endEditing(nodeId, this.getCurrentUserId());
  }

  /**
   * プレゼンス更新
   * @param presence - プレゼンス情報
   */
  updatePresence(presence: PresenceData): void {
    if (this.realtimeCommunication) {
      this.realtimeCommunication.sendPresenceUpdate(presence as any);
    }
  }

  // ===== 手動同期 =====

  /**
   * 強制同期
   * @returns 同期結果
   */
  async forceSync(): Promise<any> {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    if (this.syncStateManager.state.isOnline) {
      return await this.operationQueue.processQueue();
    } else {
      throw new Error('Cannot sync while offline');
    }
  }

  /**
   * 完全同期（サーバーからの全データ取得）
   * @returns 同期されたデータ
   */
  async fullSync(): Promise<any> {
    if (!this.apiClient) {
      throw new Error('CloudSyncService not initialized');
    }

    try {
      const response = await this.apiClient.get(`/api/mindmaps/${this.currentMindmapId}`);
      const serverData = await response.json();

      // ローカルデータとの競合をチェック
      await this.resolveFullSyncConflicts(serverData);

      return serverData;
    } catch (error) {
      this.syncStateManager.addError(error instanceof Error ? error : String(error), 'full_sync');
      throw error;
    }
  }

  /**
   * 完全同期時の競合解決
   * @param serverData - サーバーデータ
   */
  private async resolveFullSyncConflicts(serverData: any): Promise<void> {
    // 実装では詳細な競合解決ロジックを適用
    console.log('Resolving full sync conflicts with server data:', serverData);
    
    // ベクタークロック比較
    if (serverData.vector_clock) {
      const hasConflicts = this.conflictResolver.detectConflict(
        serverData.vector_clock,
        this.syncStateManager.state.vectorClock
      );

      if (hasConflicts) {
        // 競合がある場合は手動解決を要求
        this.syncStateManager.notifyListeners('full_sync_conflict', {
          serverData,
          localData: this.getLocalData()
        });
      }
    }
  }

  // ===== イベントハンドラー =====

  /**
   * 操作適用の処理
   * @param event - 操作適用イベント
   */
  private handleOperationApplied(event: CustomEvent<OperationAppliedEvent>): void {
    const operation = event.detail;
    
    // UI更新イベントを発行
    this.syncStateManager.notifyListeners('operation_applied_to_ui', operation);
  }

  /**
   * 競合解決の処理
   * @param event - 競合解決イベント
   */
  private handleConflictResolved(event: CustomEvent<ConflictResolutionEvent>): void {
    const { operation, resolution } = event.detail;
    
    // 競合解決通知
    this.syncStateManager.notifyListeners('conflict_resolved', {
      operation,
      resolution,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * ローカル操作更新の処理
   * @param event - ローカル操作更新イベント
   */
  private handleLocalOperationUpdated(event: CustomEvent<LocalOperationUpdateEvent>): void {
    const { operationId, updatedOperation } = event.detail;
    
    // 必要に応じてUI更新
    this.syncStateManager.notifyListeners('local_operation_updated', {
      operationId,
      updatedOperation
    });
  }

  // ===== 状態取得 =====

  /**
   * 同期状態を取得
   * @returns 同期状態
   */
  getSyncState(): SyncState {
    const state = this.syncStateManager.state;
    return {
      // Connection status
      isOnline: state.isOnline,
      isConnected: state.isConnected,
      isSyncing: state.isSyncing,
      connectionQuality: state.connectionQuality,
      lastSyncTime: state.lastSyncTime,
      lastPingTime: state.lastPingTime,
      pingLatency: state.pingLatency,
      
      // Operation management - map Operation[] to SyncOperation[]
      pendingOperations: state.pendingOperations.map(op => ({
        id: op.id,
        operation_type: op.type as OperationType,
        target_type: 'node' as TargetType,
        target_id: op.id,
        mindmap_id: this.currentMindmapId || 'unknown',
        data: op.data,
        user_id: op.userId,
        timestamp: op.timestamp,
        vector_clock: op.vectorClock as VectorClock,
        retry_count: op.retryCount
      })),
      vectorClock: state.vectorClock,
      operationHistory: state.operationHistory.map(op => ({
        id: op.id,
        operation_type: op.type as OperationType,
        target_type: 'node' as TargetType,
        target_id: op.id,
        mindmap_id: this.currentMindmapId || 'unknown',
        data: op.data,
        user_id: op.userId,
        timestamp: op.timestamp,
        vector_clock: op.vectorClock as VectorClock,
        retry_count: op.retryCount
      })),
      conflictQueue: state.conflictQueue.map(op => ({
        id: op.id,
        operation_type: op.type as OperationType,
        target_type: 'node' as TargetType,
        target_id: op.id,
        mindmap_id: this.currentMindmapId || 'unknown',
        data: op.data,
        user_id: op.userId,
        timestamp: op.timestamp,
        vector_clock: op.vectorClock as VectorClock,
        retry_count: op.retryCount
      })),
      
      // Events and errors
      events: (state as any).events || [],
      errors: (state as any).errors || [],
      
      // User presence
      userSessions: (state as any).userSessions || {},
      currentUser: (state as any).currentUser || null,
      
      // Realtime features
      autoReconnect: (state as any).autoReconnect ?? true,
      maxReconnectAttempts: (state as any).maxReconnectAttempts ?? 5,
      reconnectAttempts: (state as any).reconnectAttempts ?? 0,
      messageBuffer: (state as any).messageBuffer || []
    };
  }

  /**
   * 統計情報を取得
   * @returns 統計情報
   */
  getStats(): SyncStats {
    return {
      syncState: this.syncStateManager.getStats(),
      operationQueue: this.operationQueue?.getStats() || {},
      realtimeCommunication: this.realtimeCommunication?.getPerformanceMetrics() || {},
      conflictResolver: this.conflictResolver.getConflictStats(this.currentMindmapId || undefined)
    };
  }

  /**
   * ローカルデータを取得
   * @returns ローカルデータ
   */
  getLocalData(): LocalData {
    // 実装では実際のローカルデータを返す
    return {
      mindmapId: this.currentMindmapId,
      vectorClock: this.syncStateManager.state.vectorClock,
      pendingOperations: this.syncStateManager.state.pendingOperations.map(op => ({
        id: op.id,
        operation_type: op.type as OperationType,
        target_type: 'node' as TargetType,
        target_id: op.id,
        mindmap_id: this.currentMindmapId,
        data: op.data,
        user_id: op.userId,
        timestamp: op.timestamp,
        vector_clock: op.vectorClock,
        retry_count: op.retryCount
      }))
    };
  }

  /**
   * 現在のユーザーID取得（クラウド専用）
   * @returns ユーザーID
   */
  private getCurrentUserId(): string {
    // Cloud mode: get user ID from auth manager or session
    try {
      const authManager = require('../features/auth/authManager.js').authManager;
      const user = authManager.getCurrentUser();
      return user?.id || 'authenticated_user';
    } catch (error) {
      console.warn('Auth manager not available, using fallback ID');
      return 'cloud_user_' + Math.random().toString(36).substr(2, 9);
    }
  }

  // ===== 状態監視 =====

  /**
   * 状態変更リスナーを追加
   * @param listener - リスナー関数
   * @returns リスナー削除関数
   */
  onStateChange(listener: StateChangeListener): CleanupFunction {
    return this.syncStateManager.subscribe(listener as any);
  }

  /**
   * リアルタイムイベントリスナーを追加
   * @param event - イベント名
   * @param listener - リスナー関数
   * @returns リスナー削除関数
   */
  onRealtimeEvent(event: string, listener: RealtimeEventListener): CleanupFunction {
    if (this.realtimeCommunication) {
      return this.realtimeCommunication.addEventListener(event, listener);
    }
    return () => {}; // noop
  }

  // ===== クリーンアップ =====

  /**
   * クリーンアップ
   */
  cleanup(): void {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }

    if (this.realtimeCommunication) {
      this.realtimeCommunication.cleanup();
      this.realtimeCommunication = null;
    }

    if (this.operationQueue) {
      this.operationQueue.cleanup();
      this.operationQueue = null;
    }

    this.syncStateManager.cleanup();
    this.conflictResolver.cleanup();
    
    // イベントリスナー削除
    document.removeEventListener('operation_applied', this.handleOperationApplied);
    document.removeEventListener('conflict_resolved', this.handleConflictResolved);
    document.removeEventListener('local_operation_updated', this.handleLocalOperationUpdated);

    this.isInitialized = false;
  }
}

/**
 * API Client - HTTP API 通信
 */
class APIClient {
  private baseUrl: string;
  private authToken: string | undefined;

  constructor(baseUrl?: string, authToken?: string) {
    this.baseUrl = baseUrl || 'https://mindflow-api-production.shigekazukoya.workers.dev';
    this.authToken = authToken;
  }

  /**
   * GET リクエスト
   * @param path - パス
   * @param options - オプション
   * @returns Fetchレスポンス
   */
  async get(path: string, options: RequestOptions = {}): Promise<Response> {
    return await this.request('GET', path, null, options);
  }

  /**
   * POST リクエスト
   * @param path - パス
   * @param data - データ
   * @param options - オプション
   * @returns Fetchレスポンス
   */
  async post(path: string, data: any, options: RequestOptions = {}): Promise<Response> {
    return await this.request('POST', path, data, options);
  }

  /**
   * PUT リクエスト
   * @param path - パス
   * @param data - データ
   * @param options - オプション
   * @returns Fetchレスポンス
   */
  async put(path: string, data: any, options: RequestOptions = {}): Promise<Response> {
    return await this.request('PUT', path, data, options);
  }

  /**
   * DELETE リクエスト
   * @param path - パス
   * @param options - オプション
   * @returns Fetchレスポンス
   */
  async delete(path: string, options: RequestOptions = {}): Promise<Response> {
    return await this.request('DELETE', path, null, options);
  }

  /**
   * HTTP リクエスト実行
   * @param method - HTTPメソッド
   * @param path - パス
   * @param data - データ
   * @param options - オプション
   * @returns Fetchレスポンス
   */
  private async request(method: HttpMethod, path: string, data: any, options: RequestOptions = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const config: RequestInit = {
      method,
      headers,
      ...options
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }
}

/**
 * useCloudSync - Reactフック
 * @param mindmapId - マインドマップID
 * @param config - 設定
 * @returns 同期API
 */
export function useCloudSync(mindmapId: string, config: CloudSyncConfig = {}): UseCloudSyncReturn {
  const [syncService] = useState(() => new CloudSyncService());
  const [syncState, setSyncState] = useState<SyncState>(syncService.getSyncState());
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const initializeRef = useRef<boolean>(false);

  // 初期化
  useEffect(() => {
    if (mindmapId && !initializeRef.current) {
      initializeRef.current = true;
      
      syncService.initialize(mindmapId, config)
        .then(() => {
          setIsInitialized(true);
          setError(null);
        })
        .catch(err => {
          console.error('CloudSync initialization failed:', err);
          setError(err);
          setIsInitialized(false);
        });
    }

    return () => {
      initializeRef.current = false;
    };
  }, [mindmapId, syncService, config]);

  // 状態監視
  useEffect(() => {
    const unsubscribe = syncService.onStateChange(({ data }) => {
      if (data?.newState) {
        setSyncState(data.newState);
      }
    });
    
    return unsubscribe;
  }, [syncService]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      syncService.cleanup();
    };
  }, [syncService]);

  // API関数をメモ化
  const createNode = useCallback((nodeData: NodeData) => 
    syncService.createNode(nodeData), [syncService]);
  
  const updateNode = useCallback((nodeId: string, updates: Partial<NodeData>) => 
    syncService.updateNode(nodeId, updates), [syncService]);
  
  const deleteNode = useCallback((nodeId: string) => 
    syncService.deleteNode(nodeId), [syncService]);
  
  const moveNode = useCallback((nodeId: string, position: NodePosition) => 
    syncService.moveNode(nodeId, position), [syncService]);
  
  const updateCursor = useCallback((cursor: CursorData) => 
    syncService.updateCursor(cursor), [syncService]);
  
  const startEditing = useCallback((nodeId: string) => 
    syncService.startEditing(nodeId), [syncService]);
  
  const endEditing = useCallback((nodeId: string) => 
    syncService.endEditing(nodeId), [syncService]);
  
  const forceSync = useCallback(() => 
    syncService.forceSync(), [syncService]);
  
  const fullSync = useCallback(() => 
    syncService.fullSync(), [syncService]);

  return {
    // 状態
    syncState,
    isInitialized,
    error,
    
    // 操作API
    createNode,
    updateNode,
    deleteNode,
    moveNode,
    
    // リアルタイム協調編集
    updateCursor,
    startEditing,
    endEditing,
    
    // 同期制御
    forceSync,
    fullSync,
    
    // 状態監視
    onStateChange: useCallback((listener: StateChangeListener) => 
      syncService.onStateChange(listener), [syncService]),
    onRealtimeEvent: useCallback((event: string, listener: RealtimeEventListener) => 
      syncService.onRealtimeEvent(event, listener), [syncService]),
    
    // 統計
    getStats: useCallback(() => 
      syncService.getStats(), [syncService])
  };
}