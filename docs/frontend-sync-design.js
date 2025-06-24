// MindFlow Frontend Cloud Sync Architecture
// リアルタイム同期、競合解決、オフライン対応の統合設計

// ===== 同期状態管理 =====
class SyncStateManager {
  constructor() {
    this.state = {
      isOnline: navigator.onLine,
      isConnected: false,
      isSyncing: false,
      lastSyncTime: null,
      pendingOperations: [],
      vectorClock: {},
      conflictQueue: [],
      connectionRetryCount: 0
    };
    
    this.listeners = new Set();
    this.setupNetworkListeners();
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.updateState({ isOnline: true });
      this.reconnectIfNeeded();
    });

    window.addEventListener('offline', () => {
      this.updateState({ isOnline: false, isConnected: false });
    });
  }

  updateState(updates) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners(this.state);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(state) {
    this.listeners.forEach(listener => listener(state));
  }

  async reconnectIfNeeded() {
    if (this.state.isOnline && !this.state.isConnected) {
      await this.attemptReconnection();
    }
  }

  async attemptReconnection() {
    const maxRetries = 5;
    const baseDelay = 1000;
    
    while (this.state.connectionRetryCount < maxRetries && this.state.isOnline) {
      try {
        await this.testConnection();
        this.updateState({ isConnected: true, connectionRetryCount: 0 });
        await this.processPendingOperations();
        return;
      } catch (error) {
        this.updateState({ 
          connectionRetryCount: this.state.connectionRetryCount + 1 
        });
        
        const delay = baseDelay * Math.pow(2, this.state.connectionRetryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async testConnection() {
    const response = await fetch('/api/health', {
      method: 'HEAD',
      headers: { 'Authorization': `Bearer ${this.getAuthToken()}` }
    });
    
    if (!response.ok) {
      throw new Error('Connection test failed');
    }
  }

  getAuthToken() {
    return localStorage.getItem('auth_token');
  }
}

// ===== 操作キュー管理 =====
class OperationQueue {
  constructor(syncStateManager) {
    this.syncState = syncStateManager;
    this.queue = [];
    this.processing = false;
  }

  addOperation(operation) {
    // ベクタークロックを更新
    const userId = this.getCurrentUserId();
    const vectorClock = { ...this.syncState.state.vectorClock };
    vectorClock[`user_${userId}`] = (vectorClock[`user_${userId}`] || 0) + 1;

    const enhancedOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: new Date().toISOString(),
      vector_clock: vectorClock,
      retry_count: 0,
      status: 'pending'
    };

    this.queue.push(enhancedOperation);
    this.syncState.updateState({ 
      vectorClock,
      pendingOperations: [...this.queue] 
    });

    // オンラインの場合は即座に処理開始
    if (this.syncState.state.isConnected) {
      this.processQueue();
    }

    return enhancedOperation.id;
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    this.syncState.updateState({ isSyncing: true });

    try {
      while (this.queue.length > 0 && this.syncState.state.isConnected) {
        const operation = this.queue[0];
        
        try {
          await this.sendOperation(operation);
          this.queue.shift(); // 成功した操作を削除
          operation.status = 'completed';
        } catch (error) {
          operation.retry_count++;
          operation.status = 'failed';
          operation.error = error.message;

          if (operation.retry_count >= 3) {
            // 最大リトライ回数に達した場合は競合キューに移動
            this.syncState.state.conflictQueue.push(operation);
            this.queue.shift();
          } else {
            // リトライ待機
            await new Promise(resolve => setTimeout(resolve, 1000 * operation.retry_count));
          }
        }
      }
    } finally {
      this.processing = false;
      this.syncState.updateState({ 
        isSyncing: false,
        pendingOperations: [...this.queue],
        lastSyncTime: new Date().toISOString()
      });
    }
  }

  async sendOperation(operation) {
    const response = await fetch('/api/sync/operation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.syncState.getAuthToken()}`
      },
      body: JSON.stringify(operation)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Sync operation failed');
    }

    const result = await response.json();
    
    // サーバーからのベクタークロックで更新
    this.syncState.updateState({
      vectorClock: result.vector_clock
    });

    return result;
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getCurrentUserId() {
    return localStorage.getItem('user_id');
  }
}

// ===== WebSocket接続管理 =====
class WebSocketManager {
  constructor(syncStateManager, conflictResolver) {
    this.syncState = syncStateManager;
    this.conflictResolver = conflictResolver;
    this.websocket = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.listeners = new Map();
  }

  async connect(mindmapId) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      return;
    }

    const token = this.syncState.getAuthToken();
    const wsUrl = `wss://api.mindflow.com/ws?mindmapId=${mindmapId}&token=${token}`;

    try {
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected');
        this.syncState.updateState({ isConnected: true });
        this.startHeartbeat();
        clearTimeout(this.reconnectTimer);
      };

      this.websocket.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.websocket.onclose = () => {
        console.log('WebSocket disconnected');
        this.syncState.updateState({ isConnected: false });
        this.stopHeartbeat();
        this.scheduleReconnect(mindmapId);
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.scheduleReconnect(mindmapId);
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'operation':
        this.handleRemoteOperation(message.operation);
        break;
      case 'cursor_update':
        this.notifyListeners('cursor_update', message);
        break;
      case 'editing_start':
        this.notifyListeners('editing_start', message);
        break;
      case 'editing_end':
        this.notifyListeners('editing_end', message);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  async handleRemoteOperation(operation) {
    // ベクタークロック比較で競合検出
    const conflict = this.conflictResolver.detectConflict(
      operation.vector_clock,
      this.syncState.state.vectorClock
    );

    if (conflict) {
      // 競合が検出された場合は解決処理
      await this.conflictResolver.resolveConflict(operation);
    } else {
      // 競合なしの場合は直接適用
      await this.applyRemoteOperation(operation);
    }

    // ベクタークロックを更新
    this.syncState.updateState({
      vectorClock: this.conflictResolver.mergeVectorClocks(
        this.syncState.state.vectorClock,
        operation.vector_clock
      )
    });
  }

  async applyRemoteOperation(operation) {
    // リモート操作をローカルデータに適用
    const event = new CustomEvent('remote_operation', {
      detail: operation
    });
    document.dispatchEvent(event);
  }

  sendMessage(message) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect(mindmapId) {
    const delay = Math.min(1000 * Math.pow(2, this.syncState.state.connectionRetryCount), 30000);
    
    this.reconnectTimer = setTimeout(() => {
      if (this.syncState.state.isOnline) {
        this.connect(mindmapId);
      }
    }, delay);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  notifyListeners(type, data) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.stopHeartbeat();
    clearTimeout(this.reconnectTimer);
  }
}

// ===== 統合同期サービス =====
class CloudSyncService {
  constructor() {
    this.syncState = new SyncStateManager();
    this.conflictResolver = new ConflictResolver();
    this.operationQueue = new OperationQueue(this.syncState);
    this.websocketManager = new WebSocketManager(this.syncState, this.conflictResolver);
    this.currentMindmapId = null;
  }

  async initialize(mindmapId) {
    this.currentMindmapId = mindmapId;
    
    // WebSocket接続開始
    if (this.syncState.state.isOnline) {
      await this.websocketManager.connect(mindmapId);
    }

    // 定期同期の設定
    this.setupPeriodicSync();
    
    // 未送信操作の処理
    await this.operationQueue.processQueue();
  }

  setupPeriodicSync() {
    // 30秒ごとに同期状態をチェック
    setInterval(() => {
      if (this.syncState.state.isOnline && !this.syncState.state.isSyncing) {
        this.operationQueue.processQueue();
      }
    }, 30000);
  }

  // ===== パブリックAPI =====
  
  async createNode(nodeData) {
    const operationId = this.operationQueue.addOperation({
      operation_type: 'create',
      target_type: 'node',
      target_id: nodeData.id,
      mindmap_id: this.currentMindmapId,
      data: nodeData
    });

    return operationId;
  }

  async updateNode(nodeId, updates) {
    const operationId = this.operationQueue.addOperation({
      operation_type: 'update',
      target_type: 'node',
      target_id: nodeId,
      mindmap_id: this.currentMindmapId,
      data: updates
    });

    return operationId;
  }

  async deleteNode(nodeId) {
    const operationId = this.operationQueue.addOperation({
      operation_type: 'delete',
      target_type: 'node',
      target_id: nodeId,
      mindmap_id: this.currentMindmapId,
      data: {}
    });

    return operationId;
  }

  async moveNode(nodeId, newPosition) {
    const operationId = this.operationQueue.addOperation({
      operation_type: 'move',
      target_type: 'node',
      target_id: nodeId,
      mindmap_id: this.currentMindmapId,
      data: newPosition
    });

    return operationId;
  }

  // カーソル位置の共有
  updateCursor(cursorData) {
    this.websocketManager.sendMessage({
      type: 'cursor_update',
      cursor: cursorData
    });
  }

  // 編集状態の共有
  startEditing(nodeId) {
    this.websocketManager.sendMessage({
      type: 'editing_start',
      nodeId: nodeId
    });
  }

  endEditing(nodeId) {
    this.websocketManager.sendMessage({
      type: 'editing_end',
      nodeId: nodeId
    });
  }

  // 状態監視
  onSyncStateChange(listener) {
    return this.syncState.subscribe(listener);
  }

  onRemoteUpdate(listener) {
    this.websocketManager.addEventListener('remote_operation', listener);
  }

  onCursorUpdate(listener) {
    this.websocketManager.addEventListener('cursor_update', listener);
  }

  onEditingStateChange(listener) {
    this.websocketManager.addEventListener('editing_start', listener);
    this.websocketManager.addEventListener('editing_end', listener);
  }

  // 手動同期
  async forcSync() {
    if (this.syncState.state.isOnline) {
      await this.operationQueue.processQueue();
    }
  }

  // クリーンアップ
  cleanup() {
    this.websocketManager.disconnect();
  }

  // 同期状態の取得
  getSyncState() {
    return { ...this.syncState.state };
  }
}

// ===== Reactフック統合 =====
function useCloudSync(mindmapId) {
  const [syncService] = useState(() => new CloudSyncService());
  const [syncState, setSyncState] = useState(syncService.getSyncState());

  useEffect(() => {
    if (mindmapId) {
      syncService.initialize(mindmapId);
    }

    const unsubscribe = syncService.onSyncStateChange(setSyncState);
    
    return () => {
      unsubscribe();
      syncService.cleanup();
    };
  }, [mindmapId, syncService]);

  return {
    syncState,
    createNode: useCallback((nodeData) => syncService.createNode(nodeData), [syncService]),
    updateNode: useCallback((nodeId, updates) => syncService.updateNode(nodeId, updates), [syncService]),
    deleteNode: useCallback((nodeId) => syncService.deleteNode(nodeId), [syncService]),
    moveNode: useCallback((nodeId, position) => syncService.moveNode(nodeId, position), [syncService]),
    updateCursor: useCallback((cursor) => syncService.updateCursor(cursor), [syncService]),
    startEditing: useCallback((nodeId) => syncService.startEditing(nodeId), [syncService]),
    endEditing: useCallback((nodeId) => syncService.endEditing(nodeId), [syncService]),
    forceSync: useCallback(() => syncService.forcSync(), [syncService])
  };
}

export { CloudSyncService, useCloudSync };