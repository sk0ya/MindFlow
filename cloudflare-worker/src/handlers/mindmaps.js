import { corsHeaders } from '../utils/cors.js';
import { requireAuth } from '../utils/auth.js';

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  
  // 認証チェック（JWT認証またはX-User-IDを受け入れ）
  let userId = 'default-user';
  
  // JWT認証チェック
  if (env.ENABLE_AUTH === 'true') {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      console.log('認証失敗:', authResult.error);
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN)
        }
      });
    }
    // JWTのuserIdは必ずemail（auth.jsで設定）
    userId = authResult.user.userId;
    console.log('JWT認証成功 - userId:', userId, 'email:', authResult.user.email);
  } else {
    // 認証が無効の場合はX-User-IDを使用
    userId = request.headers.get('X-User-ID') || 'default-user';
    console.log('認証無効モード - userId:', userId);
  }

  // Extract mindmap ID from path if present
  const pathParts = url.pathname.split('/');
  const mindmapId = pathParts[3]; // /api/mindmaps/{id}

  try {
    let response;
    
    switch (method) {
      case 'GET':
        if (mindmapId) {
          response = await getMindMap(env.DB, userId, mindmapId);
        } else {
          response = await getAllMindMaps(env.DB, userId);
        }
        break;
      
      case 'POST':
        response = await createMindMap(env.DB, userId, await request.json());
        break;
      
      case 'PUT':
        if (!mindmapId) {
          throw new Error('Mind map ID required for update');
        }
        response = await updateMindMap(env.DB, userId, mindmapId, await request.json());
        break;
      
      case 'DELETE':
        if (!mindmapId) {
          throw new Error('Mind map ID required for deletion');
        }
        response = await deleteMindMap(env.DB, userId, mindmapId);
        break;
      
      default:
        throw new Error(`Method ${method} not allowed`);
    }

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });

  } catch (error) {
    console.error('=== API ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request method:', method);
    console.error('Request URL:', url.pathname);
    console.error('User ID:', userId);
    console.error('Mindmap ID:', mindmapId);
    console.error('================');
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });
  }
}

async function getAllMindMaps(db, userId) {
  // Ensure user exists
  await ensureUser(db, userId);
  
  const { results } = await db.prepare(
    'SELECT id, title, category, theme, node_count, created_at, updated_at FROM mindmaps WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all();
  
  // 軽量な一覧形式で返す
  const mindmaps = results.map(row => ({
    id: row.id,
    title: row.title,
    category: row.category || '未分類',
    theme: row.theme || 'default',
    nodeCount: row.node_count || 1,
    updatedAt: row.updated_at,
    createdAt: row.created_at
  }));
  
  return { mindmaps };
}

// ノード数をカウントするヘルパー関数
function countNodesInData(data) {
  if (!data.rootNode) return 1;
  
  function countNodes(node) {
    let count = 1;
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        count += countNodes(child);
      });
    }
    return count;
  }
  
  return countNodes(data.rootNode);
}

async function getMindMap(db, userId, mindmapId) {
  // リレーショナル形式から直接読み込み
  return await getMindMapRelational(db, userId, mindmapId);
}

// リレーショナル形式からの読み込み
async function getMindMapRelational(db, userId, mindmapId) {
  // マインドマップ基本情報取得
  const mindmap = await db.prepare(
    'SELECT * FROM mindmaps WHERE user_id = ? AND id = ?'
  ).bind(userId, mindmapId).first();
  
  if (!mindmap) {
    const error = new Error('Mind map not found');
    error.status = 404;
    throw error;
  }
  
  // ノード取得
  const { results: nodes } = await db.prepare(
    'SELECT * FROM nodes WHERE mindmap_id = ? ORDER BY created_at'
  ).bind(mindmapId).all();
  
  // 添付ファイル取得
  const { results: attachments } = await db.prepare(
    'SELECT * FROM attachments WHERE node_id IN (SELECT id FROM nodes WHERE mindmap_id = ?)'
  ).bind(mindmapId).all();
  
  // リンク取得
  const { results: links } = await db.prepare(
    'SELECT * FROM node_links WHERE node_id IN (SELECT id FROM nodes WHERE mindmap_id = ?)'
  ).bind(mindmapId).all();
  
  // 階層構造を再構築
  const rootNode = buildHierarchicalStructure(nodes, attachments, links, mindmapId);
  
  return {
    id: mindmap.id,
    title: mindmap.title,
    category: mindmap.category || '未分類',
    theme: mindmap.theme || 'default',
    rootNode: rootNode,
    settings: JSON.parse(mindmap.settings || '{}'),
    createdAt: mindmap.created_at,
    updatedAt: mindmap.updated_at,
  };
}

// リレーショナルデータから階層構造を再構築
function buildHierarchicalStructure(nodes, attachments, links, mindmapId = null) {
  const nodeMap = new Map();
  const attachmentMap = new Map();
  const linkMap = new Map();
  
  // 添付ファイルをノードIDでグループ化
  attachments.forEach(att => {
    if (!attachmentMap.has(att.node_id)) {
      attachmentMap.set(att.node_id, []);
    }
    attachmentMap.get(att.node_id).push({
      id: att.id,
      name: att.file_name,
      type: att.mime_type,
      size: att.file_size,
      dataURL: null, // R2ストレージではdataURLは使用しない
      isImage: att.attachment_type === 'image',
      // R2ストレージのメタデータ
      isR2Storage: true,
      r2FileId: att.id,
      nodeId: att.node_id, // nodeIdを明示的に追加
      storagePath: att.storage_path,
      downloadUrl: mindmapId ? `/api/files/${mindmapId}/${att.node_id}/${att.id}?type=download` : null
    });
  });
  
  // リンクをノードIDでグループ化
  links.forEach(link => {
    if (!linkMap.has(link.node_id)) {
      linkMap.set(link.node_id, []);
    }
    linkMap.get(link.node_id).push({
      id: link.id,
      url: link.url,
      title: link.title,
      description: link.description
    });
  });
  
  // ノードを階層構造に変換
  nodes.forEach(node => {
    const styleSettings = JSON.parse(node.style_settings || '{}');
    
    const hierarchicalNode = {
      id: node.id,
      text: node.text,
      x: node.position_x,
      y: node.position_y,
      fontSize: styleSettings.fontSize,
      fontWeight: styleSettings.fontWeight,
      backgroundColor: styleSettings.backgroundColor,
      textColor: styleSettings.textColor,
      color: styleSettings.color,
      notes: node.notes,
      tags: JSON.parse(node.tags || '[]'),
      collapsed: node.collapsed,
      children: [],
      attachments: attachmentMap.get(node.id) || [],
      mapLinks: linkMap.get(node.id) || []
    };
    
    nodeMap.set(node.id, hierarchicalNode);
  });
  
  // 親子関係を構築
  let rootNode = null;
  nodes.forEach(node => {
    const hierarchicalNode = nodeMap.get(node.id);
    
    if (node.parent_id) {
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        parent.children.push(hierarchicalNode);
      }
    } else {
      rootNode = hierarchicalNode;
    }
  });
  
  return rootNode || {
    id: 'root',
    text: 'メイントピック',
    x: 400,
    y: 300,
    children: []
  };
}

// リレーショナル形式での新規作成
async function createMindMapRelational(db, userId, mindmapId, mindmapData, now) {
  const statements = [];
  
  // マインドマップ作成（重複時は置換）
  statements.push(
    db.prepare(
      'INSERT OR REPLACE INTO mindmaps (id, user_id, title, category, theme, settings, node_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      mindmapId,
      userId,
      mindmapData.title || 'Untitled Mind Map',
      mindmapData.category || 'general',
      mindmapData.theme || 'default',
      JSON.stringify(mindmapData.settings || {}),
      countNodesInData(mindmapData),
      now,
      now
    )
  );
  
  // ノード作成
  if (mindmapData.rootNode) {
    const nodeStatements = createNodeStatements(db, mindmapData.rootNode, mindmapId, null, now);
    statements.push(...nodeStatements);
  }
  
  // 一括実行
  await db.batch(statements);
}

// リレーショナル形式での更新
async function updateMindMapRelational(db, userId, mindmapId, mindmapData, now) {
  console.log('updateMindMapRelational 開始:', mindmapId);
  
  try {
    // 既存ノードの削除を個別に実行
    console.log('既存ノード削除開始');
    const deleteResult = await db.prepare('DELETE FROM nodes WHERE mindmap_id = ?').bind(mindmapId).run();
    console.log('ノード削除結果:', deleteResult.changes, 'rows deleted');
    
    const statements = [];
    
    // マインドマップ更新
    statements.push(
      db.prepare(
        'UPDATE mindmaps SET title = ?, category = ?, theme = ?, settings = ?, node_count = ?, updated_at = ? WHERE id = ?'
      ).bind(
        mindmapData.title || 'Untitled Mind Map',
        mindmapData.category || 'general',
        mindmapData.theme || 'default',
        JSON.stringify(mindmapData.settings || {}),
        countNodesInData(mindmapData),
        now,
        mindmapId
      )
    );
    
    // 新しいノードを作成
    if (mindmapData.rootNode) {
      console.log('新しいノード作成開始');
      const nodeStatements = createNodeStatements(db, mindmapData.rootNode, mindmapId, null, now);
      console.log('作成するノード文の数:', nodeStatements.length);
      statements.push(...nodeStatements);
    }
    
    // 一括実行
    console.log('バッチ実行開始');
    await db.batch(statements);
    console.log('updateMindMapRelational 完了');
  } catch (error) {
    console.error('updateMindMapRelational エラー:', error);
    throw error;
  }
}

// ノード作成文を再帰的に生成
function createNodeStatements(db, node, mindmapId, parentId, now) {
  const statements = [];
  
  // ノード作成（重複時は置換）
  statements.push(
    db.prepare(
      'INSERT OR REPLACE INTO nodes (id, mindmap_id, parent_id, text, type, position_x, position_y, style_settings, notes, tags, collapsed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      node.id,
      mindmapId,
      parentId,
      node.text || '',
      parentId ? 'branch' : 'root',
      node.x || 0,
      node.y || 0,
      JSON.stringify({
        fontSize: node.fontSize,
        fontWeight: node.fontWeight,
        backgroundColor: node.backgroundColor,
        textColor: node.textColor,
        color: node.color
      }),
      node.notes || '',
      JSON.stringify(node.tags || []),
      node.collapsed || false,
      now,
      now
    )
  );
  
  // 添付ファイル
  if (node.attachments && Array.isArray(node.attachments)) {
    node.attachments.forEach(att => {
      const attachmentId = att.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      statements.push(
        db.prepare(
          'INSERT OR REPLACE INTO attachments (id, node_id, file_name, original_name, file_size, mime_type, storage_path, attachment_type, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          attachmentId,
          node.id,
          att.name || 'untitled',
          att.name || 'untitled',
          att.size || 0,
          att.type || 'application/octet-stream',
          att.storagePath || `legacy/${attachmentId}`,
          att.isImage ? 'image' : 'file',
          now
        )
      );
    });
  }
  
  // リンク
  if (node.mapLinks && Array.isArray(node.mapLinks)) {
    node.mapLinks.forEach(link => {
      const linkId = link.id || `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      try {
        const url = new URL(link.url);
        statements.push(
          db.prepare(
            'INSERT OR REPLACE INTO node_links (id, node_id, url, title, description, domain, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            linkId,
            node.id,
            link.url,
            link.title || link.url,
            link.description || '',
            url.hostname,
            now
          )
        );
      } catch (e) {
        console.warn('Invalid URL in mapLinks:', link.url);
      }
    });
  }
  
  // 子ノード処理
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(child => {
      const childStatements = createNodeStatements(db, child, mindmapId, node.id, now);
      statements.push(...childStatements);
    });
  }
  
  return statements;
}

async function createMindMap(db, userId, mindmapData) {
  // Ensure user exists
  await ensureUser(db, userId);
  
  const id = mindmapData.id || crypto.randomUUID();
  const now = new Date().toISOString();
  
  // 直接リレーショナル形式で保存
  await createMindMapRelational(db, userId, id, mindmapData, now);
  
  // ローカル形式で返す
  return {
    ...mindmapData,
    id: id,
    createdAt: now,
    updatedAt: now
  };
}

async function updateMindMap(db, userId, mindmapId, mindmapData) {
  console.log('updateMindMap 開始 - 受信データ:', JSON.stringify({
    userId, 
    mindmapId, 
    title: mindmapData.title,
    hasRootNode: !!mindmapData.rootNode
  }, null, 2));
  
  console.log('=== ユーザーID確認 ===');
  console.log('使用中のuserId:', userId);
  console.log('mindmapId:', mindmapId);
  
  const now = new Date().toISOString();
  
  // 既存レコードを確認
  const existingRecord = await db.prepare(
    'SELECT id FROM mindmaps WHERE user_id = ? AND id = ?'
  ).bind(userId, mindmapId).first();
  
  console.log('既存レコード確認:', existingRecord ? 'あり' : 'なし');
  
  if (existingRecord) {
    // 既存レコードを更新
    await updateMindMapRelational(db, userId, mindmapId, mindmapData, now);
    console.log('UPDATE結果: リレーショナル形式で更新完了');
  } else {
    // 新規作成
    console.log('新規レコード作成:', mindmapId);
    await ensureUser(db, userId);
    await createMindMapRelational(db, userId, mindmapId, mindmapData, now);
    console.log('INSERT結果: リレーショナル形式で作成完了');
  }
  
  // 完全なマインドマップオブジェクトを返す
  const response = {
    ...mindmapData,
    updatedAt: now,
    ...(existingRecord ? {} : { createdAt: now })
  };
  
  console.log('updateMindMap 最終レスポンス:', JSON.stringify(response, null, 2));
  return response;
}


async function deleteMindMap(db, userId, mindmapId) {
  const result = await db.prepare(
    'DELETE FROM mindmaps WHERE user_id = ? AND id = ?'
  ).bind(userId, mindmapId).run();
  
  if (result.changes === 0) {
    const error = new Error('Mind map not found');
    error.status = 404;
    throw error;
  }
  
  return { success: true };
}

async function ensureUser(db, userId) {
  const { results } = await db.prepare(
    'SELECT id FROM users WHERE id = ?'
  ).bind(userId).all();
  
  if (results.length === 0) {
    await db.prepare(
      'INSERT INTO users (id, email) VALUES (?, ?)'
    ).bind(userId, `${userId}@temp.com`).run();
  }
}