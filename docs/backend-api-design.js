// MindFlow Cloud Sync Backend API Design
// Cloudflare Workers + D1 Database + WebSocket対応

// ===== 認証ミドルウェア =====
class AuthMiddleware {
  static async authenticate(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Authorization header required');
    }
    
    const token = authHeader.substring(7);
    try {
      // GitHub OAuth token validation
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!userResponse.ok) {
        throw new Error('Invalid GitHub token');
      }
      
      const userData = await userResponse.json();
      return {
        id: `github_${userData.id}`,
        github_id: userData.id,
        username: userData.login,
        email: userData.email,
        avatar_url: userData.avatar_url
      };
    } catch (error) {
      throw new Error('Authentication failed');
    }
  }
}

// ===== データベースサービス =====
class DatabaseService {
  constructor(db) {
    this.db = db;
  }

  // ユーザー管理
  async upsertUser(userData) {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, github_id, username, email, avatar_url, last_active_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        email = excluded.email,
        avatar_url = excluded.avatar_url,
        last_active_at = CURRENT_TIMESTAMP
    `);
    
    return await stmt.bind(
      userData.id,
      userData.github_id,
      userData.username,
      userData.email,
      userData.avatar_url
    ).run();
  }

  // マインドマップCRUD
  async getMindmaps(userId) {
    const stmt = this.db.prepare(`
      SELECT id, title, description, settings, version, last_modified_at, created_at
      FROM mindmaps 
      WHERE user_id = ? AND is_deleted = FALSE
      ORDER BY last_modified_at DESC
    `);
    return await stmt.bind(userId).all();
  }

  async getMindmapWithNodes(mindmapId, userId) {
    // アクセス権限チェック
    const accessCheck = this.db.prepare(`
      SELECT 1 FROM mindmaps m
      LEFT JOIN mindmap_sharing s ON m.id = s.mindmap_id
      WHERE m.id = ? AND (m.user_id = ? OR s.shared_with_user_id = ?)
    `);
    
    const hasAccess = await accessCheck.bind(mindmapId, userId, userId).first();
    if (!hasAccess) {
      throw new Error('Access denied');
    }

    // マインドマップメタデータ取得
    const mindmapStmt = this.db.prepare(`
      SELECT * FROM mindmaps WHERE id = ? AND is_deleted = FALSE
    `);
    const mindmap = await mindmapStmt.bind(mindmapId).first();
    
    if (!mindmap) {
      throw new Error('Mindmap not found');
    }

    // 全ノード取得
    const nodesStmt = this.db.prepare(`
      SELECT * FROM nodes 
      WHERE mindmap_id = ? AND is_deleted = FALSE
      ORDER BY parent_id, order_index
    `);
    const nodes = await nodesStmt.bind(mindmapId).all();

    // 添付ファイル取得
    const attachmentsStmt = this.db.prepare(`
      SELECT a.* FROM attachments a
      JOIN nodes n ON a.node_id = n.id
      WHERE n.mindmap_id = ?
    `);
    const attachments = await attachmentsStmt.bind(mindmapId).all();

    return {
      ...mindmap,
      settings: JSON.parse(mindmap.settings),
      nodes: this.buildNodeTree(nodes),
      attachments: attachments.reduce((acc, att) => {
        if (!acc[att.node_id]) acc[att.node_id] = [];
        acc[att.node_id].push({
          ...att,
          optimization_metadata: att.optimization_metadata ? JSON.parse(att.optimization_metadata) : null
        });
        return acc;
      }, {})
    };
  }

  buildNodeTree(flatNodes) {
    const nodeMap = new Map();
    const rootNodes = [];

    // まずすべてのノードをMapに登録
    flatNodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    // 親子関係を構築
    flatNodes.forEach(node => {
      if (node.parent_id) {
        const parent = nodeMap.get(node.parent_id);
        if (parent) {
          parent.children.push(nodeMap.get(node.id));
        }
      } else {
        rootNodes.push(nodeMap.get(node.id));
      }
    });

    return rootNodes.length === 1 ? rootNodes[0] : rootNodes;
  }

  async saveMindmap(mindmapData, userId) {
    const transaction = async () => {
      // マインドマップメタデータ保存
      const mindmapStmt = this.db.prepare(`
        INSERT INTO mindmaps (id, user_id, title, description, settings, version)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          settings = excluded.settings,
          version = version + 1,
          last_modified_at = CURRENT_TIMESTAMP
      `);

      await mindmapStmt.bind(
        mindmapData.id,
        userId,
        mindmapData.title,
        mindmapData.description || '',
        JSON.stringify(mindmapData.settings || {})
      ).run();

      // 既存ノードを削除マーク
      const deleteNodesStmt = this.db.prepare(`
        UPDATE nodes SET is_deleted = TRUE WHERE mindmap_id = ?
      `);
      await deleteNodesStmt.bind(mindmapData.id).run();

      // 新しいノード構造を保存
      await this.saveNodesRecursive(mindmapData.rootNode, mindmapData.id, null, 0);
    };

    return await this.db.batch([transaction]);
  }

  async saveNodesRecursive(node, mindmapId, parentId, orderIndex) {
    const nodeStmt = this.db.prepare(`
      INSERT INTO nodes (
        id, mindmap_id, parent_id, text, x, y, 
        font_size, font_weight, color, collapsed, order_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        parent_id = excluded.parent_id,
        text = excluded.text,
        x = excluded.x,
        y = excluded.y,
        font_size = excluded.font_size,
        font_weight = excluded.font_weight,
        color = excluded.color,
        collapsed = excluded.collapsed,
        order_index = excluded.order_index,
        is_deleted = FALSE,
        updated_at = CURRENT_TIMESTAMP
    `);

    await nodeStmt.bind(
      node.id,
      mindmapId,
      parentId,
      node.text,
      node.x,
      node.y,
      node.fontSize || null,
      node.fontWeight || null,
      node.color || null,
      node.collapsed || false,
      orderIndex
    ).run();

    // 子ノードを再帰的に保存
    if (node.children && node.children.length > 0) {
      for (let i = 0; i < node.children.length; i++) {
        await this.saveNodesRecursive(node.children[i], mindmapId, node.id, i);
      }
    }
  }
}

// ===== 同期サービス =====
class SyncService {
  constructor(db, websocketManager) {
    this.db = db;
    this.websocketManager = websocketManager;
  }

  async processOperation(operation, userId) {
    // ベクタークロック検証
    const vectorClock = this.mergeVectorClocks(operation.vector_clock, userId);
    
    // 操作をデータベースに記録
    const operationStmt = this.db.prepare(`
      INSERT INTO operations (
        id, mindmap_id, user_id, operation_type, target_type, target_id, 
        data, vector_clock, applied_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    await operationStmt.bind(
      operation.id,
      operation.mindmap_id,
      userId,
      operation.operation_type,
      operation.target_type,
      operation.target_id,
      JSON.stringify(operation.data),
      JSON.stringify(vectorClock)
    ).run();

    // 実際のデータ変更を適用
    await this.applyOperation(operation);

    // 他のクライアントに変更を通知
    await this.websocketManager.broadcastToMindmap(
      operation.mindmap_id,
      userId,
      {
        type: 'operation',
        operation: {
          ...operation,
          vector_clock: vectorClock,
          applied_at: new Date().toISOString()
        }
      }
    );

    return { success: true, vector_clock: vectorClock };
  }

  async applyOperation(operation) {
    switch (operation.operation_type) {
      case 'create':
        return await this.applyCreateOperation(operation);
      case 'update':
        return await this.applyUpdateOperation(operation);
      case 'delete':
        return await this.applyDeleteOperation(operation);
      case 'move':
        return await this.applyMoveOperation(operation);
      default:
        throw new Error(`Unknown operation type: ${operation.operation_type}`);
    }
  }

  async applyCreateOperation(operation) {
    if (operation.target_type === 'node') {
      const stmt = this.db.prepare(`
        INSERT INTO nodes (
          id, mindmap_id, parent_id, text, x, y, 
          font_size, font_weight, color, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const data = operation.data;
      return await stmt.bind(
        operation.target_id,
        operation.mindmap_id,
        data.parent_id,
        data.text,
        data.x,
        data.y,
        data.font_size || null,
        data.font_weight || null,
        data.color || null,
        data.order_index || 0
      ).run();
    }
  }

  mergeVectorClocks(incomingClock, userId) {
    // 簡単なベクタークロック実装
    const merged = { ...incomingClock };
    merged[`user_${userId}`] = (merged[`user_${userId}`] || 0) + 1;
    return merged;
  }
}

// ===== WebSocket管理 =====
class WebSocketManager {
  constructor() {
    this.connections = new Map(); // mindmapId -> Set of WebSockets
    this.userSessions = new Map(); // userId -> WebSocket
  }

  addConnection(websocket, mindmapId, userId) {
    // マインドマップ別接続管理
    if (!this.connections.has(mindmapId)) {
      this.connections.set(mindmapId, new Set());
    }
    this.connections.get(mindmapId).add(websocket);

    // ユーザー別セッション管理
    this.userSessions.set(userId, websocket);

    websocket.addEventListener('close', () => {
      this.removeConnection(websocket, mindmapId, userId);
    });
  }

  removeConnection(websocket, mindmapId, userId) {
    if (this.connections.has(mindmapId)) {
      this.connections.get(mindmapId).delete(websocket);
      if (this.connections.get(mindmapId).size === 0) {
        this.connections.delete(mindmapId);
      }
    }
    this.userSessions.delete(userId);
  }

  async broadcastToMindmap(mindmapId, excludeUserId, message) {
    const connections = this.connections.get(mindmapId);
    if (!connections) return;

    const messageStr = JSON.stringify(message);
    const promises = [];

    for (const websocket of connections) {
      // 送信者を除外
      if (websocket.userId !== excludeUserId) {
        promises.push(
          websocket.send(messageStr).catch(err => {
            console.error('WebSocket send error:', err);
            this.removeConnection(websocket, mindmapId, websocket.userId);
          })
        );
      }
    }

    await Promise.allSettled(promises);
  }
}

// ===== メインAPIハンドラー =====
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    const db = new DatabaseService(env.DB);
    const websocketManager = new WebSocketManager();
    const syncService = new SyncService(db, websocketManager);

    try {
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      if (method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // WebSocket upgrade handling
      if (request.headers.get('Upgrade') === 'websocket') {
        return await this.handleWebSocket(request, env, websocketManager, db);
      }

      // 認証
      const user = await AuthMiddleware.authenticate(request);
      await db.upsertUser(user);

      // API routing
      switch (true) {
        case path === '/api/mindmaps' && method === 'GET':
          const mindmaps = await db.getMindmaps(user.id);
          return Response.json(mindmaps, { headers: corsHeaders });

        case path.startsWith('/api/mindmaps/') && method === 'GET':
          const mindmapId = path.split('/')[3];
          const mindmap = await db.getMindmapWithNodes(mindmapId, user.id);
          return Response.json(mindmap, { headers: corsHeaders });

        case path === '/api/mindmaps' && method === 'POST':
          const mindmapData = await request.json();
          await db.saveMindmap(mindmapData, user.id);
          return Response.json({ success: true }, { headers: corsHeaders });

        case path === '/api/sync/operation' && method === 'POST':
          const operation = await request.json();
          const result = await syncService.processOperation(operation, user.id);
          return Response.json(result, { headers: corsHeaders });

        default:
          return new Response('Not Found', { status: 404, headers: corsHeaders });
      }

    } catch (error) {
      console.error('API Error:', error);
      return Response.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }
  },

  async handleWebSocket(request, env, websocketManager, db) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const url = new URL(request.url);
    const mindmapId = url.searchParams.get('mindmapId');
    const token = url.searchParams.get('token');

    try {
      // トークン認証
      const user = await AuthMiddleware.authenticate({
        headers: { get: () => `Bearer ${token}` }
      });

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      server.userId = user.id;
      
      websocketManager.addConnection(server, mindmapId, user.id);

      server.addEventListener('message', async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'cursor_update':
              await websocketManager.broadcastToMindmap(mindmapId, user.id, {
                type: 'cursor_update',
                userId: user.id,
                username: user.username,
                cursor: message.cursor
              });
              break;

            case 'editing_start':
              await websocketManager.broadcastToMindmap(mindmapId, user.id, {
                type: 'editing_start',
                userId: user.id,
                username: user.username,
                nodeId: message.nodeId
              });
              break;

            case 'editing_end':
              await websocketManager.broadcastToMindmap(mindmapId, user.id, {
                type: 'editing_end',
                userId: user.id,
                nodeId: message.nodeId
              });
              break;
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });

    } catch (error) {
      return new Response('WebSocket authentication failed', { status: 401 });
    }
  }
};