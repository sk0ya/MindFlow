/**
 * リアルタイム同期クライアント
 * Durable ObjectsのWebSocketと連携するフロントエンドクライアント
 */

// ===== TYPE DEFINITIONS =====

// Authentication types
interface AuthManager {
  isAuthenticated(): boolean;
  getAuthToken(): string | null;
  getUserId?(): string | null;
}

// WebSocket Message Types
interface BaseMessage {
  type: string;
  timestamp?: number;
}

interface InitialDataMessage extends BaseMessage {
  type: 'initial_data';
  sessionId: string;
  version: number;
  mindmapState: any;
  connectedUsers: ConnectedUser[];
}

interface OperationMessage extends BaseMessage {
  type: 'operation';
  operation: Operation;
}

interface CursorUpdateMessage extends BaseMessage {
  type: 'cursor_update';
  userId: string;
  userName: string;
  userColor: string;
  cursor: CursorPosition;
}

interface UserJoinedMessage extends BaseMessage {
  type: 'user_joined';
  user: ConnectedUser;
}

interface UserLeftMessage extends BaseMessage {
  type: 'user_left';
  user: ConnectedUser;
}

interface ErrorMessage extends BaseMessage {
  type: 'error';
  error: string;
  details?: any;
}

interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
}

interface HeartbeatResponseMessage extends BaseMessage {
  type: 'heartbeat_response';
}

type WebSocketMessage = 
  | InitialDataMessage 
  | OperationMessage 
  | CursorUpdateMessage 
  | UserJoinedMessage 
  | UserLeftMessage 
  | ErrorMessage 
  | HeartbeatMessage 
  | HeartbeatResponseMessage;

// Operation Types
interface BaseOperation {
  type: string;
  clientId: string;
  timestamp: number;
  version?: number;
}

interface NodeUpdateOperation extends BaseOperation {
  type: 'node_update';
  data: {
    nodeId: string;
    updates: NodeUpdates;
  };
}

interface NodeCreateOperation extends BaseOperation {
  type: 'node_create';
  data: {
    nodeId: string;
    parentId: string;
    text: string;
    position: Position;
    style?: NodeStyle;
  };
}

interface NodeDeleteOperation extends BaseOperation {
  type: 'node_delete';
  data: {
    nodeId: string;
    preserveChildren: boolean;
  };
}

interface NodeMoveOperation extends BaseOperation {
  type: 'node_move';
  data: {
    nodeId: string;
    newPosition: Position;
    newParentId?: string;
  };
}

interface CursorUpdateOperation extends BaseOperation {
  type: 'cursor_update';
  data: {
    nodeId: string;
    position: CursorPosition;
  };
}

interface ForceSyncOperation extends BaseOperation {
  type: 'force_sync';
}

type Operation = 
  | NodeUpdateOperation 
  | NodeCreateOperation 
  | NodeDeleteOperation 
  | NodeMoveOperation 
  | CursorUpdateOperation 
  | ForceSyncOperation;

// Data Types
interface Position {
  x: number;
  y: number;
}

interface CursorPosition {
  nodeId?: string;
  x?: number;
  y?: number;
  selectionStart?: number;
  selectionEnd?: number;
}

interface NodeStyle {
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
}

interface NodeUpdates {
  text?: string;
  position?: Position;
  style?: Partial<NodeStyle>;
  collapsed?: boolean;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
}

interface NodeData {
  id?: string;
  text: string;
  position: Position;
  style?: NodeStyle;
}

interface ConnectedUser {
  id: string;
  name: string;
  email?: string;
  color: string;
  avatar?: string;
  joinedAt: number;
}

interface UserCursor {
  userId: string;
  userName: string;
  userColor: string;
  cursor: CursorPosition;
  timestamp: number;
}

// Event Types
interface ConnectionState {
  isConnected: boolean;
  mindmapId: string | null;
  sessionId: string | null;
  currentVersion: number;
  connectedUsers: ConnectedUser[];
  pendingOperations: number;
  reconnectAttempts: number;
}

interface DisconnectedEventData {
  code: number;
  reason: string;
  wasClean: boolean;
}

interface ConnectionErrorEventData {
  error: string;
}

interface InitialDataEventData {
  mindmapState: any;
  version: number;
  connectedUsers: ConnectedUser[];
}

interface OperationReceivedEventData {
  operation: Operation;
  version: number;
}

interface CursorUpdateEventData {
  userId: string;
  userName: string;
  userColor: string;
  cursor: CursorPosition;
}

interface UserJoinedEventData {
  user: ConnectedUser;
  connectedUsers: ConnectedUser[];
}

interface UserLeftEventData {
  user: ConnectedUser;
  connectedUsers: ConnectedUser[];
}

interface ServerErrorEventData {
  error: string;
  details?: any;
}

interface ErrorEventData {
  error: Error;
}

// Event Handler Types
type EventHandler<T = any> = (data: T) => void;

interface EventHandlerMap {
  'connected': EventHandler<void>;
  'disconnected': EventHandler<DisconnectedEventData>;
  'connection_error': EventHandler<ConnectionErrorEventData>;
  'initial_data': EventHandler<InitialDataEventData>;
  'operation_received': EventHandler<OperationReceivedEventData>;
  'cursor_update': EventHandler<CursorUpdateEventData>;
  'user_joined': EventHandler<UserJoinedEventData>;
  'user_left': EventHandler<UserLeftEventData>;
  'server_error': EventHandler<ServerErrorEventData>;
  'error': EventHandler<ErrorEventData>;
  'reconnect_failed': EventHandler<void>;
}

type EventName = keyof EventHandlerMap;

// Removed unused RealtimeClientConfig interface

// Class Property Types
interface RealtimeClientState {
  websocket: WebSocket | null;
  isConnected: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  sessionId: string | null;
  mindmapId: string | null;
  userId: string | null;
  currentVersion: number;
  pendingOperations: Operation[];
  operationHistory: Operation[];
  maxHistorySize: number;
  eventHandlers: Map<string, EventHandler[]>;
  connectedUsers: Map<string, ConnectedUser>;
  cursors: Map<string, UserCursor>;
  heartbeatInterval: NodeJS.Timeout | null;
  heartbeatTimeout: number;
  autoReconnect: boolean;
  reconnectTimer: NodeJS.Timeout | null;
}

// ===== CLASS IMPLEMENTATION =====

export class RealtimeClient implements RealtimeClientState {
  // Core properties
  public readonly apiBaseUrl: string;
  public readonly authManager: AuthManager;
  
  // WebSocket connection management
  public websocket: WebSocket | null;
  public isConnected: boolean;
  public reconnectAttempts: number;
  public maxReconnectAttempts: number;
  public reconnectDelay: number;
  
  // Session management
  public sessionId: string | null;
  public mindmapId: string | null;
  public userId: string | null;
  public currentVersion: number;
  
  // Operation management
  public pendingOperations: Operation[];
  public operationHistory: Operation[];
  public maxHistorySize: number;
  
  // Event handling
  public eventHandlers: Map<string, EventHandler[]>;
  
  // State management
  public connectedUsers: Map<string, ConnectedUser>;
  public cursors: Map<string, UserCursor>;
  
  // Heartbeat management
  public heartbeatInterval: NodeJS.Timeout | null;
  public heartbeatTimeout: number;
  
  // Auto-reconnection
  public autoReconnect: boolean;
  public reconnectTimer: NodeJS.Timeout | null;

  constructor(apiBaseUrl: string, authManager: AuthManager) {
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
   * @param mindmapId - マインドマップID
   * @returns 接続成功可否
   */
  async connect(mindmapId: string): Promise<boolean> {
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
      this.emit('connection_error', { error: (error as Error).message });
      
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
  buildWebSocketUrl(mindmapId: string): string {
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
  setupWebSocketHandlers(): void {
    this.websocket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      
      this.startHeartbeat();
      this.emit('connected');
    };

    this.websocket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.websocket.onclose = (event: CloseEvent) => {
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

    this.websocket.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
      this.emit('error', { error: new Error('WebSocket error') });
    };
  }

  /**
   * メッセージハンドラー
   */
  handleMessage(message: WebSocketMessage): void {
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
  handleInitialData(data: Omit<InitialDataMessage, 'type'>): void {
    this.sessionId = data.sessionId;
    this.currentVersion = data.version;
    
    // 接続済みユーザー情報を更新
    this.connectedUsers.clear();
    (data.connectedUsers || []).forEach((user: ConnectedUser) => {
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
  handleOperation(data: Omit<OperationMessage, 'type'>): void {
    const { operation } = data;
    
    // バージョンチェック
    if (operation.version && operation.version <= this.currentVersion) {
      console.warn('Received old operation, ignoring');
      return;
    }

    this.currentVersion = operation.version || this.currentVersion + 1;
    this.addToHistory(operation);

    this.emit('operation_received', {
      operation: operation,
      version: this.currentVersion
    });
  }

  /**
   * カーソル更新処理
   */
  handleCursorUpdate(data: Omit<CursorUpdateMessage, 'type'>): void {
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
  handleUserJoined(data: Omit<UserJoinedMessage, 'type'>): void {
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
  handleUserLeft(data: Omit<UserLeftMessage, 'type'>): void {
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
  handleError(data: Omit<ErrorMessage, 'type'>): void {
    console.error('Server error:', data.error);
    this.emit('server_error', data);
  }

  /**
   * 操作送信
   * @param type - 操作タイプ
   * @param data - 操作データ
   * @param clientId - クライアント操作ID
   */
  sendOperation(type: string, data: any, clientId: string | null = null): string {
    const operation: Operation = {
      type: type as any,
      data: data,
      clientId: clientId || this.generateClientId(),
      timestamp: Date.now()
    };

    if (this.isConnected && this.websocket) {
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
  updateNode(nodeId: string, updates: NodeUpdates, clientId: string | null = null): string {
    return this.sendOperation('node_update', {
      nodeId: nodeId,
      updates: updates
    }, clientId);
  }

  /**
   * ノード作成送信
   */
  createNode(parentId: string, nodeData: NodeData, clientId: string | null = null): string {
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
  deleteNode(nodeId: string, preserveChildren: boolean = false, clientId: string | null = null): string {
    return this.sendOperation('node_delete', {
      nodeId: nodeId,
      preserveChildren: preserveChildren
    }, clientId);
  }

  /**
   * ノード移動送信
   */
  moveNode(nodeId: string, newPosition: Position, newParentId: string | null = null, clientId: string | null = null): string {
    return this.sendOperation('node_move', {
      nodeId: nodeId,
      newPosition: newPosition,
      newParentId: newParentId
    }, clientId);
  }

  /**
   * カーソル位置更新送信
   */
  updateCursor(nodeId: string, position: CursorPosition): void {
    if (this.isConnected && this.websocket) {
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
  forceSync(): void {
    if (this.isConnected && this.websocket) {
      this.websocket.send(JSON.stringify({
        type: 'force_sync'
      }));
    }
  }

  /**
   * 接続待機
   */
  waitForConnection(timeout: number = 10000): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve(true);
        return;
      }

      const timeoutId: NodeJS.Timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      const onConnected = (): void => {
        clearTimeout(timeoutId);
        this.off('connected', onConnected);
        this.off('connection_error', onError);
        resolve(true);
      };

      const onError = (data: ConnectionErrorEventData): void => {
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
  processPendingOperations(): void {
    if (this.pendingOperations.length === 0) return;

    console.log(`Processing ${this.pendingOperations.length} pending operations`);
    
    for (const operation of this.pendingOperations) {
      if (this.isConnected && this.websocket) {
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
  startHeartbeat(): void {
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
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 再接続スケジュール
   */
  scheduleReconnect(): void {
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
  disconnect(): void {
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
  on<T extends EventName>(event: T, handler: EventHandlerMap[T]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off<T extends EventName>(event: T, handler: EventHandlerMap[T]): void {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit<T extends EventName>(event: T, data: Parameters<EventHandlerMap[T]>[0] = undefined as any): void {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event)!.forEach((handler: EventHandler) => {
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
  
  generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addToHistory(operation: Operation): void {
    this.operationHistory.push(operation);
    
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory = this.operationHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 状態取得メソッド
   */
  
  getConnectionState(): ConnectionState {
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

  getConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values());
  }

  getUserCursors(): UserCursor[] {
    return Array.from(this.cursors.values());
  }

  getOperationHistory(): Operation[] {
    return [...this.operationHistory];
  }
}

// グローバルインスタンス管理
let realtimeClientInstance: RealtimeClient | null = null;

export const getRealtimeClient = (apiBaseUrl: string, authManager: AuthManager): RealtimeClient => {
  if (!realtimeClientInstance) {
    realtimeClientInstance = new RealtimeClient(apiBaseUrl, authManager);
  }
  return realtimeClientInstance;
};

export default RealtimeClient;