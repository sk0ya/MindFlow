import { corsHeaders } from '../utils/cors.js';
import { requireAuth } from '../utils/auth.js';

/**
 * ノード管理APIハンドラー
 * リレーショナル構造でのノード操作を提供
 */
export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  
  // 認証チェック
  let userId = 'default-user';
  if (env.ENABLE_AUTH === 'true') {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
      });
    }
    userId = authResult.user.userId;
  }

  const pathParts = url.pathname.split('/');
  const mindmapId = pathParts[3]; // /api/nodes/{mindmapId}
  const nodeId = pathParts[4];    // /api/nodes/{mindmapId}/{nodeId}

  try {
    let response;
    
    switch (method) {
      case 'GET':
        if (nodeId) {
          response = await getNode(env.DB, userId, mindmapId, nodeId);
        } else {
          response = await getAllNodes(env.DB, userId, mindmapId);
        }
        break;
      
      case 'POST':
        const createData = await request.json();
        response = await createNode(env.DB, userId, mindmapId, createData);
        break;
      
      case 'PUT':
        const updateData = await request.json();
        response = await updateNode(env.DB, userId, mindmapId, nodeId, updateData);
        break;
      
      case 'DELETE':
        response = await deleteNode(env.DB, userId, mindmapId, nodeId);
        break;
      
      default:
        throw new Error(`Method ${method} not allowed`);
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
    });

  } catch (error) {
    console.error('Nodes API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
    });
  }
}

/**
 * 指定マインドマップの全ノードとその関連データを取得
 */
async function getAllNodes(db, userId, mindmapId) {
  // マインドマップの所有権確認
  const mindmap = await db.prepare(
    'SELECT id, title, migrated_to_relational FROM mindmaps WHERE id = ? AND user_id = ?'
  ).bind(mindmapId, userId).first();
  
  if (!mindmap) {
    const error = new Error('Mindmap not found');
    error.status = 404;
    throw error;
  }

  // リレーショナル構造に移行済みかチェック
  if (!mindmap.migrated_to_relational) {
    const error = new Error('This mindmap has not been migrated to relational structure');
    error.status = 400;
    throw error;
  }

  // ノード取得
  const { results: nodes } = await db.prepare(
    'SELECT * FROM nodes WHERE mindmap_id = ? ORDER BY created_at'
  ).bind(mindmapId).all();

  // 接続取得
  const { results: connections } = await db.prepare(
    'SELECT * FROM node_connections WHERE mindmap_id = ?'
  ).bind(mindmapId).all();

  // 添付ファイル取得
  const { results: attachments } = await db.prepare(`
    SELECT a.* FROM attachments a 
    JOIN nodes n ON a.node_id = n.id 
    WHERE n.mindmap_id = ?
  `).bind(mindmapId).all();

  // リンク取得
  const { results: links } = await db.prepare(`
    SELECT l.* FROM node_links l 
    JOIN nodes n ON l.node_id = n.id 
    WHERE n.mindmap_id = ?
  `).bind(mindmapId).all();

  return {
    nodes: nodes.map(parseNodeData),
    connections: connections.map(parseConnectionData),
    attachments: attachments.map(parseAttachmentData),
    links: links.map(parseLinkData)
  };
}

/**
 * 特定ノードの詳細情報を取得
 */
async function getNode(db, userId, mindmapId, nodeId) {
  // 所有権確認
  const mindmap = await db.prepare(
    'SELECT id FROM mindmaps WHERE id = ? AND user_id = ?'
  ).bind(mindmapId, userId).first();
  
  if (!mindmap) {
    const error = new Error('Mindmap not found');
    error.status = 404;
    throw error;
  }

  // ノード取得
  const node = await db.prepare(
    'SELECT * FROM nodes WHERE id = ? AND mindmap_id = ?'
  ).bind(nodeId, mindmapId).first();

  if (!node) {
    const error = new Error('Node not found');
    error.status = 404;
    throw error;
  }

  // 関連データ取得
  const { results: attachments } = await db.prepare(
    'SELECT * FROM attachments WHERE node_id = ?'
  ).bind(nodeId).all();

  const { results: links } = await db.prepare(
    'SELECT * FROM node_links WHERE node_id = ?'
  ).bind(nodeId).all();

  return {
    node: parseNodeData(node),
    attachments: attachments.map(parseAttachmentData),
    links: links.map(parseLinkData)
  };
}

/**
 * 安全なID生成 - UNIQUE制約違反を防ぐ
 */
async function generateSafeNodeId(db, maxAttempts = 10) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // タイムスタンプベースの強化されたID生成
    const timestamp = Date.now();
    const randomPart1 = Math.random().toString(36).substr(2, 9);
    const randomPart2 = Math.random().toString(36).substr(2, 9);
    const attemptSuffix = attempt > 1 ? `_retry${attempt}` : '';
    
    const newId = `node_${timestamp}_${randomPart1}${randomPart2}${attemptSuffix}`;
    
    console.log(`🔧 ID生成試行 ${attempt}/${maxAttempts}:`, newId);
    
    // データベースでIDの重複をチェック
    const existingNode = await db.prepare(
      'SELECT id FROM nodes WHERE id = ?'
    ).bind(newId).first();
    
    if (!existingNode) {
      console.log('✅ ユニークID生成成功:', newId);
      return newId;
    }
    
    console.warn(`⚠️ ID重複検出 (試行 ${attempt}):`, newId);
    
    // 少し待機してから次の試行
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  throw new Error(`${maxAttempts}回試行してもユニークIDを生成できませんでした`);
}

/**
 * 新しいノードを作成
 */
async function createNode(db, userId, mindmapId, requestData) {
  console.log('🆕 Creating node:', { mindmapId, requestData });
  
  // 所有権確認
  const mindmap = await db.prepare(
    'SELECT id FROM mindmaps WHERE id = ? AND user_id = ?'
  ).bind(mindmapId, userId).first();
  
  if (!mindmap) {
    const error = new Error('Mindmap not found');
    error.status = 404;
    throw error;
  }

  // クライアント側のデータ形式に対応
  const nodeData = requestData.node || requestData; // node プロパティがある場合はそれを使用
  const parentId = requestData.parentId || nodeData.parent_id;
  
  // リレーショナル構造でのparent_id設定: rootノード自体のみparent_id = NULL
  const dbParentId = (parentId === null || parentId === undefined) ? null : parentId;
  
  // 親ノード存在確認（rootノード以外）
  if (dbParentId !== null && dbParentId !== 'root') {
    const parentNode = await db.prepare(
      'SELECT id FROM nodes WHERE id = ? AND mindmap_id = ?'
    ).bind(dbParentId, mindmapId).first();
    
    if (!parentNode) {
      const error = new Error('Parent node not found');
      error.status = 400;
      throw error;
    }
  }

  // クライアント側のIDをバックアップし、安全なIDを生成
  const originalId = nodeData.id;
  let safeNodeId;
  
  try {
    safeNodeId = await generateSafeNodeId(db);
  } catch (error) {
    console.error('❌ 安全なID生成失敗:', error);
    throw new Error('IDの生成に失敗しました');
  }

  console.log('🔄 ID変更:', {
    original: originalId,
    safe: safeNodeId
  });

  const now = new Date().toISOString();

  try {
    // ノード作成 - クライアント側の座標形式 (x, y) をサーバー側 (position_x, position_y) に変換
    await db.prepare(`
      INSERT INTO nodes 
      (id, mindmap_id, text, type, parent_id, position_x, position_y, 
       style_settings, notes, tags, collapsed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      safeNodeId,
      mindmapId,
      nodeData.text || '',
      (dbParentId === null || dbParentId === 'root') ? 'root' : 'branch',
      (dbParentId === 'root') ? null : dbParentId,
      nodeData.x || nodeData.position_x || 0,  // x → position_x
      nodeData.y || nodeData.position_y || 0,  // y → position_y
      JSON.stringify({
        fontSize: nodeData.fontSize,
        fontWeight: nodeData.fontWeight,
        backgroundColor: nodeData.backgroundColor,
        textColor: nodeData.textColor,
        color: nodeData.color
      }),
      nodeData.notes || '',
      JSON.stringify(nodeData.tags || []),
      nodeData.collapsed || false,
      now,
      now
    ).run();

    // 添付ファイル処理
    if (nodeData.attachments && Array.isArray(nodeData.attachments)) {
      for (const att of nodeData.attachments) {
        const attachmentId = att.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.prepare(
          'INSERT INTO attachments (id, node_id, file_name, original_name, file_size, mime_type, storage_path, attachment_type, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          attachmentId,
          safeNodeId,
          att.name || 'untitled',
          att.name || 'untitled',
          att.size || 0,
          att.type || 'application/octet-stream',
          att.storagePath || `legacy/${attachmentId}`,
          att.isImage ? 'image' : 'file',
          now
        ).run();
      }
    }

    // リンク処理
    if (nodeData.mapLinks && Array.isArray(nodeData.mapLinks)) {
      for (const link of nodeData.mapLinks) {
        const linkId = link.id || `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
          const url = new URL(link.url);
          await db.prepare(
            'INSERT INTO node_links (id, node_id, url, title, description, domain, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            linkId,
            safeNodeId,
            link.url,
            link.title || link.url,
            link.description || '',
            url.hostname,
            now
          ).run();
        } catch (e) {
          console.warn('Invalid URL in mapLinks:', link.url);
        }
      }
    }

    // マインドマップの更新日時を更新
    await db.prepare(
      'UPDATE mindmaps SET updated_at = ? WHERE id = ?'
    ).bind(now, mindmapId).run();

    console.log('✅ Node created:', safeNodeId);
    
    return { 
      id: safeNodeId, 
      originalId: originalId,
      newId: safeNodeId !== originalId ? safeNodeId : undefined,
      created_at: now 
    };

  } catch (error) {
    console.error('❌ ノード作成エラー:', error);
    
    // UNIQUE制約違反の場合は詳細ログ
    if (error.message && error.message.includes('UNIQUE constraint')) {
      console.error('❌ UNIQUE制約違反詳細:', {
        nodeId: safeNodeId,
        originalId: originalId,
        errorMessage: error.message
      });
    }
    
    throw new Error(`ノード作成失敗: ${error.message}`);
  }
}

/**
 * ノードを更新
 */
async function updateNode(db, userId, mindmapId, nodeId, requestData) {
  console.log('🔄 Updating node:', { mindmapId, nodeId, requestData });
  
  // 所有権確認
  const mindmap = await db.prepare(
    'SELECT id FROM mindmaps WHERE id = ? AND user_id = ?'
  ).bind(mindmapId, userId).first();
  
  if (!mindmap) {
    const error = new Error('Mindmap not found');
    error.status = 404;
    throw error;
  }

  // ノード存在確認
  const existingNode = await db.prepare(
    'SELECT id FROM nodes WHERE id = ? AND mindmap_id = ?'
  ).bind(nodeId, mindmapId).first();

  if (!existingNode) {
    const error = new Error('Node not found');
    error.status = 404;
    throw error;
  }

  // クライアント側のデータ形式に対応
  const updateData = requestData.updates || requestData;
  
  const now = new Date().toISOString();
  const updateFields = [];
  const values = [];

  // 更新可能フィールドの構築 - クライアント側の座標形式に対応
  if (updateData.text !== undefined) {
    updateFields.push('text = ?');
    values.push(updateData.text);
  }
  // x → position_x, y → position_y の変換
  if (updateData.x !== undefined) {
    updateFields.push('position_x = ?');
    values.push(updateData.x);
  }
  if (updateData.y !== undefined) {
    updateFields.push('position_y = ?');
    values.push(updateData.y);
  }
  // 従来の形式もサポート
  if (updateData.position_x !== undefined) {
    updateFields.push('position_x = ?');
    values.push(updateData.position_x);
  }
  if (updateData.position_y !== undefined) {
    updateFields.push('position_y = ?');
    values.push(updateData.position_y);
  }
  if (updateData.style_settings !== undefined || updateData.styleSettings !== undefined) {
    updateFields.push('style_settings = ?');
    values.push(JSON.stringify(updateData.style_settings || updateData.styleSettings));
  }
  if (updateData.notes !== undefined) {
    updateFields.push('notes = ?');
    values.push(updateData.notes);
  }
  if (updateData.tags !== undefined) {
    updateFields.push('tags = ?');
    values.push(JSON.stringify(updateData.tags));
  }
  if (updateData.collapsed !== undefined) {
    updateFields.push('collapsed = ?');
    values.push(updateData.collapsed);
  }
  if (updateData.parent_id !== undefined) {
    // 循環参照チェック
    if (await wouldCreateCircularReference(db, nodeId, updateData.parent_id)) {
      const error = new Error('Update would create circular reference');
      error.status = 400;
      throw error;
    }
    updateFields.push('parent_id = ?');
    values.push(updateData.parent_id);
  }

  updateFields.push('updated_at = ?');
  values.push(now);
  values.push(nodeId, mindmapId);

  if (updateFields.length > 1) { // updated_at以外にも更新があるか
    await db.prepare(`
      UPDATE nodes SET ${updateFields.join(', ')} 
      WHERE id = ? AND mindmap_id = ?
    `).bind(...values).run();
  }

  // マインドマップの更新日時を更新
  await db.prepare(
    'UPDATE mindmaps SET updated_at = ? WHERE id = ?'
  ).bind(now, mindmapId).run();

  console.log('✅ Node updated:', nodeId);
  return { updated_at: now };
}

/**
 * ノードを削除
 */
async function deleteNode(db, userId, mindmapId, nodeId) {
  console.log('🗑️ Deleting node:', { mindmapId, nodeId });
  
  // 所有権確認
  const mindmap = await db.prepare(
    'SELECT id FROM mindmaps WHERE id = ? AND user_id = ?'
  ).bind(mindmapId, userId).first();
  
  if (!mindmap) {
    const error = new Error('Mindmap not found');
    error.status = 404;
    throw error;
  }

  // rootノードは削除不可
  const node = await db.prepare(
    'SELECT type FROM nodes WHERE id = ? AND mindmap_id = ?'
  ).bind(nodeId, mindmapId).first();

  if (!node) {
    const error = new Error('Node not found');
    error.status = 404;
    throw error;
  }

  if (node.type === 'root') {
    const error = new Error('Cannot delete root node');
    error.status = 400;
    throw error;
  }

  // 子ノードを親ノードに移動
  await db.prepare(`
    UPDATE nodes SET parent_id = (
      SELECT parent_id FROM nodes WHERE id = ? AND mindmap_id = ?
    ) WHERE parent_id = ? AND mindmap_id = ?
  `).bind(nodeId, mindmapId, nodeId, mindmapId).run();

  // ノード削除（カスケードで添付ファイルとリンクも削除される）
  await db.prepare(
    'DELETE FROM nodes WHERE id = ? AND mindmap_id = ?'
  ).bind(nodeId, mindmapId).run();

  const now = new Date().toISOString();
  await db.prepare(
    'UPDATE mindmaps SET updated_at = ? WHERE id = ?'
  ).bind(now, mindmapId).run();

  console.log('✅ Node deleted:', nodeId);
  return { deleted_at: now };
}

/**
 * 循環参照チェック
 */
async function wouldCreateCircularReference(db, nodeId, newParentId) {
  if (!newParentId || newParentId === nodeId) return false;

  let currentId = newParentId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    if (currentId === nodeId) return true;
    
    visited.add(currentId);
    const parent = await db.prepare(
      'SELECT parent_id FROM nodes WHERE id = ?'
    ).bind(currentId).first();
    
    currentId = parent?.parent_id;
  }

  return false;
}

/**
 * データパーサー関数群
 */
function parseNodeData(node) {
  return {
    ...node,
    style_settings: JSON.parse(node.style_settings || '{}'),
    tags: JSON.parse(node.tags || '[]'),
    collapsed: Boolean(node.collapsed)
  };
}

function parseConnectionData(connection) {
  return {
    ...connection,
    style_settings: JSON.parse(connection.style_settings || '{}')
  };
}

function parseAttachmentData(attachment) {
  return {
    ...attachment,
    file_size: Number(attachment.file_size)
  };
}

function parseLinkData(link) {
  return {
    ...link
  };
}