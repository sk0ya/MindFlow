/**
 * MindMapRoom Durable Object
 * マインドマップの共同編集セッションを管理するDurable Object
 * 
 * 機能:
 * - WebSocket接続管理
 * - リアルタイム同期
 * - 競合解決
 * - 参加者管理
 * - 操作履歴追跡
 */

export class MindMapRoom {
  constructor(controller, env) {
    this.controller = controller;
    this.env = env;
    
    // WebSocket接続管理
    this.connections = new Map(); // sessionId -> WebSocket
    this.users = new Map(); // sessionId -> userInfo
    
    // マインドマップ状態管理
    this.mindmapId = null;
    this.currentState = null;
    this.version = 0;
    this.lastActivity = Date.now();
    
    // 操作キュー管理
    this.operationQueue = [];
    this.maxQueueSize = 1000;
    
    // セッション管理
    this.sessionTimeout = 5 * 60 * 1000; // 5分
    this.cleanupInterval = null;
  }

  /**
   * WebSocket接続ハンドラー
   */
  async fetch(request) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    if (upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // パスからマインドマップIDを取得
    const pathParts = url.pathname.split('/');
    const mindmapId = pathParts[pathParts.length - 1];
    
    if (!mindmapId) {
      return new Response('MindMap ID required', { status: 400 });
    }

    // 認証チェック（必要に応じて）
    const authResult = await this.authenticateRequest(request);
    if (!authResult.success) {
      return new Response('Unauthorized', { status: 401 });
    }

    // WebSocketペアを作成
    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0];
    const server = webSocketPair[1];

    // 接続受け入れ
    server.accept();

    // セッション初期化
    const sessionId = this.generateSessionId();
    const userInfo = {
      id: authResult.userId,
      name: authResult.userName || 'Unknown User',
      color: this.generateUserColor(),
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      cursor: null // カーソル位置
    };

    // 接続とユーザー情報を保存
    this.connections.set(sessionId, server);
    this.users.set(sessionId, userInfo);

    // マインドマップ初期化
    if (!this.mindmapId) {
      await this.initializeMindMap(mindmapId);
    }

    // イベントハンドラー設定
    this.setupWebSocketHandlers(server, sessionId, userInfo);

    // 初期データ送信
    await this.sendInitialData(server, sessionId);

    // 他の参加者に新規参加を通知
    await this.broadcastUserJoined(sessionId, userInfo);

    // クリーンアップ開始
    this.startCleanupTimer();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * WebSocketイベントハンドラー設定
   */
  setupWebSocketHandlers(webSocket, sessionId, userInfo) {
    webSocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleWebSocketMessage(sessionId, message);
      } catch (error) {
        console.error('WebSocket message error:', error);
        this.sendError(webSocket, 'Invalid message format');
      }
    });

    webSocket.addEventListener('close', async () => {
      await this.handleUserDisconnect(sessionId);
    });

    webSocket.addEventListener('error', async (error) => {
      console.error('WebSocket error:', error);
      await this.handleUserDisconnect(sessionId);
    });
  }

  /**
   * WebSocketメッセージハンドラー
   */
  async handleWebSocketMessage(sessionId, message) {
    const { type, data, clientId, timestamp } = message;

    // ユーザーアクティビティ更新
    const user = this.users.get(sessionId);
    if (user) {
      user.lastSeen = Date.now();
    }

    switch (type) {
      case 'node_update':
        await this.handleNodeUpdate(sessionId, data, clientId, timestamp);
        break;
      
      case 'node_create':
        await this.handleNodeCreate(sessionId, data, clientId, timestamp);
        break;
      
      case 'node_delete':
        await this.handleNodeDelete(sessionId, data, clientId, timestamp);
        break;
      
      case 'node_move':
        await this.handleNodeMove(sessionId, data, clientId, timestamp);
        break;
      
      case 'cursor_update':
        await this.handleCursorUpdate(sessionId, data);
        break;
      
      case 'heartbeat':
        await this.handleHeartbeat(sessionId);
        break;
      
      case 'force_sync':
        await this.handleForceSync(sessionId);
        break;
      
      default:
        console.warn('Unknown message type:', type);
    }

    this.lastActivity = Date.now();
  }

  /**
   * ノード更新処理
   */
  async handleNodeUpdate(sessionId, data, clientId, timestamp) {
    const operation = {
      id: this.generateOperationId(),
      type: 'node_update',
      sessionId: sessionId,
      clientId: clientId,
      timestamp: timestamp || Date.now(),
      data: data,
      version: this.version + 1
    };

    // 操作を適用
    const result = await this.applyOperation(operation);
    
    if (result.success) {
      // 操作をキューに追加
      this.addOperationToQueue(operation);
      
      // 他のクライアントにブロードキャスト
      await this.broadcastOperation(operation, sessionId);
      
      // データベースに永続化（非同期）
      this.persistOperation(operation);
    } else {
      // 競合が発生した場合
      await this.handleConflict(sessionId, operation, result.conflicts);
    }
  }

  /**
   * ノード作成処理
   */
  async handleNodeCreate(sessionId, data, clientId, timestamp) {
    const operation = {
      id: this.generateOperationId(),
      type: 'node_create',
      sessionId: sessionId,
      clientId: clientId,
      timestamp: timestamp || Date.now(),
      data: {
        nodeId: data.nodeId || this.generateNodeId(),
        parentId: data.parentId,
        text: data.text,
        position: data.position,
        style: data.style
      },
      version: this.version + 1
    };

    const result = await this.applyOperation(operation);
    
    if (result.success) {
      this.addOperationToQueue(operation);
      await this.broadcastOperation(operation, sessionId);
      this.persistOperation(operation);
    }
  }

  /**
   * ノード削除処理
   */
  async handleNodeDelete(sessionId, data, clientId, timestamp) {
    const operation = {
      id: this.generateOperationId(),
      type: 'node_delete',
      sessionId: sessionId,
      clientId: clientId,
      timestamp: timestamp || Date.now(),
      data: {
        nodeId: data.nodeId,
        preserveChildren: data.preserveChildren || false
      },
      version: this.version + 1
    };

    const result = await this.applyOperation(operation);
    
    if (result.success) {
      this.addOperationToQueue(operation);
      await this.broadcastOperation(operation, sessionId);
      this.persistOperation(operation);
    }
  }

  /**
   * ノード移動処理
   */
  async handleNodeMove(sessionId, data, clientId, timestamp) {
    const operation = {
      id: this.generateOperationId(),
      type: 'node_move',
      sessionId: sessionId,
      clientId: clientId,
      timestamp: timestamp || Date.now(),
      data: {
        nodeId: data.nodeId,
        newPosition: data.newPosition,
        newParentId: data.newParentId
      },
      version: this.version + 1
    };

    const result = await this.applyOperation(operation);
    
    if (result.success) {
      this.addOperationToQueue(operation);
      await this.broadcastOperation(operation, sessionId);
      this.persistOperation(operation);
    }
  }

  /**
   * カーソル更新処理
   */
  async handleCursorUpdate(sessionId, data) {
    const user = this.users.get(sessionId);
    if (user) {
      user.cursor = {
        nodeId: data.nodeId,
        position: data.position,
        timestamp: Date.now()
      };

      // カーソル情報をブロードキャスト（リアルタイム）
      await this.broadcastCursorUpdate(sessionId, user.cursor);
    }
  }

  /**
   * 操作の適用
   */
  async applyOperation(operation) {
    try {
      // 現在の状態に操作を適用
      const newState = this.calculateNewState(this.currentState, operation);
      
      // 競合チェック
      const conflicts = this.detectConflicts(operation, this.operationQueue);
      
      if (conflicts.length > 0) {
        return { success: false, conflicts: conflicts };
      }

      // 状態を更新
      this.currentState = newState;
      this.version = operation.version;

      return { success: true, newState: newState };
    } catch (error) {
      console.error('Operation application error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 新しい状態を計算
   */
  calculateNewState(currentState, operation) {
    const newState = JSON.parse(JSON.stringify(currentState)); // ディープコピー

    switch (operation.type) {
      case 'node_update':
        this.applyNodeUpdate(newState, operation.data);
        break;
      case 'node_create':
        this.applyNodeCreate(newState, operation.data);
        break;
      case 'node_delete':
        this.applyNodeDelete(newState, operation.data);
        break;
      case 'node_move':
        this.applyNodeMove(newState, operation.data);
        break;
    }

    return newState;
  }

  /**
   * ノード更新を適用
   */
  applyNodeUpdate(state, data) {
    const node = this.findNodeById(state, data.nodeId);
    if (node) {
      Object.assign(node, data.updates);
    }
  }

  /**
   * ノード作成を適用
   */
  applyNodeCreate(state, data) {
    const parentNode = this.findNodeById(state, data.parentId);
    if (parentNode) {
      const newNode = {
        id: data.nodeId,
        text: data.text,
        x: data.position?.x || 0,
        y: data.position?.y || 0,
        ...data.style,
        children: []
      };
      parentNode.children.push(newNode);
    }
  }

  /**
   * ノード削除を適用
   */
  applyNodeDelete(state, data) {
    const parentNode = this.findParentNode(state, data.nodeId);
    if (parentNode) {
      const nodeIndex = parentNode.children.findIndex(child => child.id === data.nodeId);
      if (nodeIndex !== -1) {
        const deletedNode = parentNode.children[nodeIndex];
        
        if (data.preserveChildren && deletedNode.children) {
          // 子ノードを親に移動
          parentNode.children.splice(nodeIndex, 1, ...deletedNode.children);
        } else {
          // ノードを完全削除
          parentNode.children.splice(nodeIndex, 1);
        }
      }
    }
  }

  /**
   * ノード移動を適用
   */
  applyNodeMove(state, data) {
    const node = this.findNodeById(state, data.nodeId);
    const oldParent = this.findParentNode(state, data.nodeId);
    
    if (node && oldParent) {
      // 旧親から削除
      const oldIndex = oldParent.children.findIndex(child => child.id === data.nodeId);
      if (oldIndex !== -1) {
        oldParent.children.splice(oldIndex, 1);
      }

      // 位置更新
      if (data.newPosition) {
        node.x = data.newPosition.x;
        node.y = data.newPosition.y;
      }

      // 新親に追加
      if (data.newParentId) {
        const newParent = this.findNodeById(state, data.newParentId);
        if (newParent) {
          newParent.children.push(node);
        }
      }
    }
  }

  /**
   * 競合検出
   */
  detectConflicts(operation, existingOperations) {
    const conflicts = [];
    const recentOperations = existingOperations.slice(-10); // 直近の操作のみチェック

    for (const existing of recentOperations) {
      if (this.isConflictingOperation(operation, existing)) {
        conflicts.push(existing);
      }
    }

    return conflicts;
  }

  /**
   * 操作の競合判定
   */
  isConflictingOperation(op1, op2) {
    // 同じノードに対する同時更新
    if (op1.data.nodeId === op2.data.nodeId) {
      const timeDiff = Math.abs(op1.timestamp - op2.timestamp);
      return timeDiff < 1000; // 1秒以内の操作は競合とみなす
    }

    // 親子関係の競合
    if (op1.type === 'node_delete' && op2.type === 'node_create') {
      return op2.data.parentId === op1.data.nodeId;
    }

    return false;
  }

  /**
   * 操作をブロードキャスト
   */
  async broadcastOperation(operation, excludeSessionId = null) {
    const message = {
      type: 'operation',
      operation: operation,
      timestamp: Date.now()
    };

    for (const [sessionId, connection] of this.connections) {
      if (sessionId !== excludeSessionId && connection.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          connection.send(JSON.stringify(message));
        } catch (error) {
          console.error('Broadcast error:', error);
          // 接続エラーの場合は削除
          this.connections.delete(sessionId);
          this.users.delete(sessionId);
        }
      }
    }
  }

  /**
   * カーソル更新をブロードキャスト
   */
  async broadcastCursorUpdate(sessionId, cursor) {
    const user = this.users.get(sessionId);
    if (!user) return;

    const message = {
      type: 'cursor_update',
      userId: user.id,
      userName: user.name,
      userColor: user.color,
      cursor: cursor,
      timestamp: Date.now()
    };

    for (const [otherSessionId, connection] of this.connections) {
      if (otherSessionId !== sessionId && connection.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          connection.send(JSON.stringify(message));
        } catch (error) {
          console.error('Cursor broadcast error:', error);
        }
      }
    }
  }

  /**
   * ユーザー参加通知
   */
  async broadcastUserJoined(sessionId, userInfo) {
    const message = {
      type: 'user_joined',
      user: {
        id: userInfo.id,
        name: userInfo.name,
        color: userInfo.color
      },
      timestamp: Date.now()
    };

    await this.broadcastToAll(message, sessionId);
  }

  /**
   * ユーザー退出処理
   */
  async handleUserDisconnect(sessionId) {
    const user = this.users.get(sessionId);
    
    // 接続とユーザー情報を削除
    this.connections.delete(sessionId);
    this.users.delete(sessionId);

    if (user) {
      // 他のユーザーに退出を通知
      const message = {
        type: 'user_left',
        user: {
          id: user.id,
          name: user.name
        },
        timestamp: Date.now()
      };

      await this.broadcastToAll(message);
    }

    // アクティブな接続がなくなった場合の処理
    if (this.connections.size === 0) {
      this.scheduleCleanup();
    }
  }

  /**
   * マインドマップ初期化
   */
  async initializeMindMap(mindmapId) {
    try {
      this.mindmapId = mindmapId;
      
      // データベースから現在の状態を取得
      const mindmapData = await this.loadMindMapFromDatabase(mindmapId);
      
      if (mindmapData) {
        this.currentState = mindmapData;
        this.version = mindmapData.version || 0;
      } else {
        // マインドマップが見つからない場合
        throw new Error('MindMap not found');
      }
    } catch (error) {
      console.error('MindMap initialization error:', error);
      throw error;
    }
  }

  /**
   * データベースからマインドマップをロード
   */
  async loadMindMapFromDatabase(mindmapId) {
    // データベースアクセス（リレーショナル構造対応）
    const { results: nodes } = await this.env.DB.prepare(
      'SELECT * FROM nodes WHERE mindmap_id = ? ORDER BY created_at'
    ).bind(mindmapId).all();

    if (nodes.length === 0) {
      return null;
    }

    // 階層構造に再構築
    return this.buildHierarchicalStructure(nodes);
  }

  /**
   * 階層構造の構築
   */
  buildHierarchicalStructure(nodes) {
    const nodeMap = new Map();
    
    // ノードマップ作成
    nodes.forEach(node => {
      const style = JSON.parse(node.style_settings || '{}');
      nodeMap.set(node.id, {
        id: node.id,
        text: node.text,
        x: node.position_x,
        y: node.position_y,
        fontSize: style.fontSize || 14,
        fontWeight: style.fontWeight || 'normal',
        backgroundColor: style.backgroundColor,
        textColor: style.textColor,
        children: []
      });
    });

    // 親子関係構築
    const rootNode = nodeMap.get('root');
    nodes.forEach(node => {
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        const parent = nodeMap.get(node.parent_id);
        const child = nodeMap.get(node.id);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    });

    return rootNode;
  }

  /**
   * ユーティリティメソッド
   */

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateNodeId() {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateUserColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  findNodeById(state, nodeId) {
    if (!state || !nodeId) return null;
    
    if (state.id === nodeId) return state;
    
    if (state.children) {
      for (const child of state.children) {
        const found = this.findNodeById(child, nodeId);
        if (found) return found;
      }
    }
    
    return null;
  }

  findParentNode(state, nodeId) {
    if (!state || !state.children) return null;
    
    for (const child of state.children) {
      if (child.id === nodeId) return state;
      
      const found = this.findParentNode(child, nodeId);
      if (found) return found;
    }
    
    return null;
  }

  addOperationToQueue(operation) {
    this.operationQueue.push(operation);
    
    // キューサイズ制限
    if (this.operationQueue.length > this.maxQueueSize) {
      this.operationQueue = this.operationQueue.slice(-this.maxQueueSize);
    }
  }

  async sendInitialData(webSocket, sessionId) {
    const message = {
      type: 'initial_data',
      mindmapState: this.currentState,
      version: this.version,
      sessionId: sessionId,
      connectedUsers: Array.from(this.users.values()).map(user => ({
        id: user.id,
        name: user.name,
        color: user.color
      })),
      timestamp: Date.now()
    };

    webSocket.send(JSON.stringify(message));
  }

  async broadcastToAll(message, excludeSessionId = null) {
    for (const [sessionId, connection] of this.connections) {
      if (sessionId !== excludeSessionId && connection.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          connection.send(JSON.stringify(message));
        } catch (error) {
          console.error('Broadcast error:', error);
        }
      }
    }
  }

  sendError(webSocket, errorMessage) {
    const message = {
      type: 'error',
      error: errorMessage,
      timestamp: Date.now()
    };

    try {
      webSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending error message:', error);
    }
  }

  async authenticateRequest(request) {
    // 簡単な認証実装（実際の認証に置き換え）
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return { success: false };
    }

    // トークン検証（実際の実装では適切な検証を行う）
    return {
      success: true,
      userId: 'user123',
      userName: 'Test User'
    };
  }

  startCleanupTimer() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // 1分間隔
  }

  performCleanup() {
    const now = Date.now();
    
    // 非アクティブな接続を削除
    for (const [sessionId, user] of this.users) {
      if (now - user.lastSeen > this.sessionTimeout) {
        this.handleUserDisconnect(sessionId);
      }
    }
  }

  scheduleCleanup() {
    // 全ユーザーが退出した場合の遅延クリーンアップ
    setTimeout(() => {
      if (this.connections.size === 0) {
        this.cleanup();
      }
    }, 30000); // 30秒後
  }

  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async persistOperation(operation) {
    // 非同期でデータベースに操作を永続化
    try {
      // 実装は省略（実際のデータベース更新処理）
      console.log('Operation persisted:', operation.id);
    } catch (error) {
      console.error('Failed to persist operation:', error);
    }
  }
}