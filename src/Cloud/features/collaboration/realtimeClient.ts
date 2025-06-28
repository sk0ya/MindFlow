/**
 * リアルタイム同期クライアント
 * Durable ObjectsのWebSocketと連携するフロントエンドクライアント
 */

export class RealtimeClient {
  constructor(apiBaseUrl, authManager) {
    this.apiBaseUrl = apiBaseUrl;
    this.authManager = authManager;
    
    // WebSocket接続管理
    this.websocket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1秒から開始
    
    // セッション管理
    this.sessionId = null;
    this.mindmapId = null;
    this.userId = null;
    this.currentVersion = 0;
    
    // 操作キュー
    this.pendingOperations = [];
    this.operationHistory = [];
    this.maxHistorySize = 100;
    
    // イベントハンドラー
    this.eventHandlers = new Map();
    
    // 状態管理
    this.connectedUsers = new Map();
    this.cursors = new Map();
    
    // ハートビート
    this.heartbeatInterval = null;
    this.heartbeatTimeout = 30000; // 30秒
    
    // 自動再接続
    this.autoReconnect = true;
    this.reconnectTimer = null;
  }

  /**
   * WebSocket接続を開始
   * @param {string} mindmapId - マインドマップID
   * @returns {Promise<boolean>} 接続成功可否
   */
  async connect(mindmapId) {
    if (this.isConnected && this.mindmapId === mindmapId) {
      return true;
    }

    this.mindmapId = mindmapId;
    
    try {
      // 既存接続をクローズ
      if (this.websocket) {
        this.disconnect();
      }

      // WebSocket URL構築
      const wsUrl = this.buildWebSocketUrl(mindmapId);
      
      // WebSocket接続
      this.websocket = new WebSocket(wsUrl);
      
      // イベントハンドラー設定
      this.setupWebSocketHandlers();
      
      // 接続完了を待機
      return await this.waitForConnection();
      
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.emit('connection_error', { error: error.message });
      
      // 自動再接続を試行
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
      
      return false;
    }
  }

  /**
   * WebSocket URL構築
   */
  buildWebSocketUrl(mindmapId) {
    const protocol = this.apiBaseUrl.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = this.apiBaseUrl.replace(/^https?/, protocol);
    
    let url = `${baseUrl}/api/realtime/connect?mindmapId=${mindmapId}`;
    
    // 認証トークンを追加
    if (this.authManager && this.authManager.isAuthenticated()) {
      const token = this.authManager.getAuthToken();
      if (token) {
        url += `&token=${encodeURIComponent(token)}`;
      }
    }
    
    return url;
  }

  /**
   * WebSocketイベントハンドラー設定
   */
  setupWebSocketHandlers() {
    this.websocket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      
      this.startHeartbeat();
      this.emit('connected');
    };

    this.websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.websocket.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnected = false;
      this.stopHeartbeat();
      
      this.emit('disconnected', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });

      // 自動再接続
      if (this.autoReconnect && !event.wasClean) {
        this.scheduleReconnect();
      }
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', { error });
    };
  }

  /**
   * メッセージハンドラー
   */
  handleMessage(message) {
    const { type, ...data } = message;

    switch (type) {
      case 'initial_data':
        this.handleInitialData(data);
        break;
      
      case 'operation':
        this.handleOperation(data);
        break;
      
      case 'cursor_update':
        this.handleCursorUpdate(data);
        break;
      
      case 'user_joined':
        this.handleUserJoined(data);
        break;
      
      case 'user_left':
        this.handleUserLeft(data);
        break;
      
      case 'error':
        this.handleError(data);
        break;
      
      case 'heartbeat_response':
        // ハートビート応答は特に処理不要
        break;
      
      default:
        console.warn('Unknown message type:', type);
    }
  }

  /**
   * 初期データ処理
   */
  handleInitialData(data) {
    this.sessionId = data.sessionId;
    this.currentVersion = data.version;
    
    // 接続済みユーザー情報を更新
    this.connectedUsers.clear();
    (data.connectedUsers || []).forEach(user => {
      this.connectedUsers.set(user.id, user);
    });

    this.emit('initial_data', {
      mindmapState: data.mindmapState,
      version: data.version,
      connectedUsers: Array.from(this.connectedUsers.values())
    });

    // 保留中の操作があれば送信
    this.processPendingOperations();
  }

  /**
   * 操作処理
   */
  handleOperation(data) {
    const { operation } = data;
    
    // バージョンチェック
    if (operation.version <= this.currentVersion) {
      console.warn('Received old operation, ignoring');
      return;
    }

    this.currentVersion = operation.version;
    this.addToHistory(operation);

    this.emit('operation_received', {
      operation: operation,
      version: this.currentVersion
    });
  }

  /**
   * カーソル更新処理
   */
  handleCursorUpdate(data) {
    const { userId, userName, userColor, cursor } = data;
    
    this.cursors.set(userId, {
      userId,
      userName,
      userColor,
      cursor,
      timestamp: Date.now()
    });

    this.emit('cursor_update', {
      userId,
      userName,
      userColor,
      cursor
    });
  }

  /**
   * ユーザー参加処理
   */
  handleUserJoined(data) {
    const { user } = data;
    this.connectedUsers.set(user.id, user);

    this.emit('user_joined', {
      user,
      connectedUsers: Array.from(this.connectedUsers.values())
    });
  }

  /**
   * ユーザー退出処理
   */
  handleUserLeft(data) {
    const { user } = data;
    this.connectedUsers.delete(user.id);
    this.cursors.delete(user.id);

    this.emit('user_left', {
      user,
      connectedUsers: Array.from(this.connectedUsers.values())
    });
  }

  /**
   * エラー処理
   */
  handleError(data) {
    console.error('Server error:', data.error);
    this.emit('server_error', data);
  }

  /**
   * 操作送信
   * @param {string} type - 操作タイプ
   * @param {Object} data - 操作データ
   * @param {string} clientId - クライアント操作ID
   */
  sendOperation(type, data, clientId = null) {
    const operation = {
      type: type,
      data: data,
      clientId: clientId || this.generateClientId(),
      timestamp: Date.now()
    };

    if (this.isConnected) {
      this.websocket.send(JSON.stringify(operation));
    } else {
      // 未接続時は保留
      this.pendingOperations.push(operation);
      
      // 自動再接続を試行
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    }

    return operation.clientId;
  }

  /**
   * ノード更新送信
   */
  updateNode(nodeId, updates, clientId = null) {
    return this.sendOperation('node_update', {
      nodeId: nodeId,
      updates: updates
    }, clientId);
  }

  /**
   * ノード作成送信
   */
  createNode(parentId, nodeData, clientId = null) {
    return this.sendOperation('node_create', {
      nodeId: nodeData.id || this.generateNodeId(),
      parentId: parentId,
      text: nodeData.text,
      position: nodeData.position,
      style: nodeData.style
    }, clientId);
  }

  /**
   * ノード削除送信
   */
  deleteNode(nodeId, preserveChildren = false, clientId = null) {
    return this.sendOperation('node_delete', {
      nodeId: nodeId,
      preserveChildren: preserveChildren
    }, clientId);
  }

  /**
   * ノード移動送信
   */
  moveNode(nodeId, newPosition, newParentId = null, clientId = null) {
    return this.sendOperation('node_move', {
      nodeId: nodeId,
      newPosition: newPosition,
      newParentId: newParentId
    }, clientId);
  }

  /**
   * カーソル位置更新送信
   */
  updateCursor(nodeId, position) {
    if (this.isConnected) {
      this.websocket.send(JSON.stringify({
        type: 'cursor_update',
        data: {
          nodeId: nodeId,
          position: position
        }
      }));
    }
  }

  /**
   * 強制同期実行
   */
  forceSync() {
    if (this.isConnected) {
      this.websocket.send(JSON.stringify({
        type: 'force_sync'
      }));
    }
  }

  /**
   * 接続待機
   */
  waitForConnection(timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve(true);
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      const onConnected = () => {
        clearTimeout(timeoutId);
        this.off('connected', onConnected);
        this.off('connection_error', onError);
        resolve(true);
      };

      const onError = (data) => {
        clearTimeout(timeoutId);
        this.off('connected', onConnected);
        this.off('connection_error', onError);
        reject(new Error(data.error));
      };

      this.on('connected', onConnected);
      this.on('connection_error', onError);
    });
  }

  /**
   * 保留中操作の処理
   */
  processPendingOperations() {
    if (this.pendingOperations.length === 0) return;

    console.log(`Processing ${this.pendingOperations.length} pending operations`);
    
    for (const operation of this.pendingOperations) {
      if (this.isConnected) {
        this.websocket.send(JSON.stringify(operation));
      } else {
        break; // 接続が切れた場合は中断
      }
    }

    this.pendingOperations = [];
  }

  /**
   * ハートビート開始
   */
  startHeartbeat() {
    this.stopHeartbeat(); // 既存のタイマーをクリア

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.websocket.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        }));
      }
    }, this.heartbeatTimeout);
  }

  /**
   * ハートビート停止
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 再接続スケジュール
   */
  scheduleReconnect() {
    if (!this.autoReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    console.log(`Scheduling reconnection in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      
      try {
        await this.connect(this.mindmapId);
      } catch (error) {
        console.error('Reconnection failed:', error);
        
        // 指数バックオフで遅延を増加
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // 最大30秒
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  /**
   * 接続切断
   */
  disconnect() {
    this.autoReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.isConnected = false;
    this.sessionId = null;
    this.connectedUsers.clear();
    this.cursors.clear();
  }

  /**
   * イベントハンドラー管理
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data = null) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * ユーティリティメソッド
   */
  
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateNodeId() {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addToHistory(operation) {
    this.operationHistory.push(operation);
    
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory = this.operationHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 状態取得メソッド
   */
  
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      mindmapId: this.mindmapId,
      sessionId: this.sessionId,
      currentVersion: this.currentVersion,
      connectedUsers: Array.from(this.connectedUsers.values()),
      pendingOperations: this.pendingOperations.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.values());
  }

  getUserCursors() {
    return Array.from(this.cursors.values());
  }

  getOperationHistory() {
    return [...this.operationHistory];
  }
}

// グローバルインスタンス管理
let realtimeClientInstance = null;

export const getRealtimeClient = (apiBaseUrl, authManager) => {
  if (!realtimeClientInstance) {
    realtimeClientInstance = new RealtimeClient(apiBaseUrl, authManager);
  }
  return realtimeClientInstance;
};

export default RealtimeClient;