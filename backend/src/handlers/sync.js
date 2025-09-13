/**
 * 同期専用APIハンドラー - IndexedDBベースのバックグラウンド同期
 */

import { requireAuth } from '../utils/auth.js';
import { corsHeaders } from '../utils/cors.js';

export async function handleSyncRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  console.log(`🔄 Sync API: ${method} ${path}`);

  try {
    // 認証が必要な全エンドポイント
    const authResult = await requireAuth(request, env);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN)
        }
      });
    }

    const userId = authResult.user.userId;

    // ルーティング
    if (path === '/api/sync/operations' && method === 'POST') {
      return await handleBatchOperations(request, env, userId);
    }

    if (path === '/api/sync/operations' && method === 'GET') {
      return await getPendingOperations(request, env, userId);
    }

    if (path.match(/^\/api\/sync\/operations\/([^\/]+)$/) && method === 'PUT') {
      const operationId = path.split('/').pop();
      return await updateOperationStatus(request, env, userId, operationId);
    }

    if (path === '/api/sync/status' && method === 'GET') {
      return await getSyncStatus(request, env, userId);
    }

    if (path === '/api/sync/conflicts' && method === 'GET') {
      return await getConflicts(request, env, userId);
    }

    if (path.match(/^\/api\/sync\/conflicts\/([^\/]+)\/resolve$/) && method === 'POST') {
      const mindmapId = path.split('/')[4];
      return await resolveConflict(request, env, userId, mindmapId);
    }

    return new Response(JSON.stringify({
      error: 'Sync endpoint not found',
      path: path
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });

  } catch (error) {
    console.error('❌ Sync API Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Sync operation failed',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });
  }
}

/**
 * バッチオペレーション処理
 */
async function handleBatchOperations(request, env, userId) {
  const operations = await request.json();
  
  if (!Array.isArray(operations)) {
    return new Response(JSON.stringify({
      error: 'Operations must be an array'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });
  }

  console.log(`📦 Processing ${operations.length} batch operations for user ${userId}`);

  const results = [];
  const errors = [];

  for (const operation of operations) {
    try {
      const result = await processOperation(env, userId, operation);
      results.push({
        operationId: operation.id,
        success: true,
        result: result
      });
    } catch (error) {
      console.error(`❌ Operation ${operation.id} failed:`, error);
      errors.push({
        operationId: operation.id,
        error: error.message
      });
    }
  }

  return new Response(JSON.stringify({
    processed: results.length,
    errorCount: errors.length,
    results: results,
    errors: errors
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env.CORS_ORIGIN)
    }
  });
}

/**
 * 個別オペレーション処理
 */
async function processOperation(env, userId, operation) {
  const { id, mapId, operation: op, data, timestamp } = operation;

  console.log(`🔄 Processing operation: ${op} for map ${mapId}`);

  switch (op) {
    case 'create':
      return await createMindMap(env, userId, data);

    case 'update':
      return await updateMindMap(env, userId, mapId, data);

    case 'delete':
      return await deleteMindMap(env, userId, mapId);

    case 'node_create':
    case 'node_update':
    case 'node_delete':
    case 'node_move':
      return await updateMindMapWithNodeOperation(env, userId, mapId, op, data);

    default:
      throw new Error(`Unknown operation: ${op}`);
  }
}

/**
 * マインドマップ作成
 */
async function createMindMap(env, userId, data) {
  const { id, title, rootNode, settings } = data;

  const mindmapData = JSON.stringify({
    id,
    title,
    rootNode,
    settings: settings || { autoSave: true, autoLayout: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // マインドマップを作成
  await env.DB.prepare(`
    INSERT INTO mindmaps (id, user_id, title, data, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `).bind(id, userId, title, mindmapData).run();

  // 同期メタデータを作成
  await env.DB.prepare(`
    INSERT INTO sync_metadata (user_id, mindmap_id, last_sync_at, local_version, server_version, sync_status)
    VALUES (?, ?, datetime('now'), 1, 1, 'synced')
  `).bind(userId, id).run();

  console.log(`✅ Created mindmap: ${title} (${id})`);

  return { id, title, version: 1 };
}

/**
 * マインドマップ更新
 */
async function updateMindMap(env, userId, mapId, data) {
  const { title, rootNode, settings } = data;

  // 既存のマインドマップを取得
  const existing = await env.DB.prepare(`
    SELECT data, version FROM mindmaps 
    WHERE id = ? AND user_id = ?
  `).bind(mapId, userId).first();

  if (!existing) {
    throw new Error(`Mindmap not found: ${mapId}`);
  }

  const existingData = JSON.parse(existing.data);
  const newVersion = existing.version + 1;

  const updatedData = JSON.stringify({
    ...existingData,
    title: title || existingData.title,
    rootNode: rootNode || existingData.rootNode,
    settings: settings || existingData.settings,
    updatedAt: new Date().toISOString()
  });

  // マインドマップを更新
  await env.DB.prepare(`
    UPDATE mindmaps 
    SET title = ?, data = ?, version = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(title || existingData.title, updatedData, newVersion, mapId, userId).run();

  // 同期メタデータを更新
  await env.DB.prepare(`
    UPDATE sync_metadata 
    SET last_sync_at = datetime('now'), server_version = ?, sync_status = 'synced'
    WHERE user_id = ? AND mindmap_id = ?
  `).bind(newVersion, userId, mapId).run();

  console.log(`✅ Updated mindmap: ${mapId} (version ${newVersion})`);

  return { id: mapId, version: newVersion };
}

/**
 * マインドマップ削除
 */
async function deleteMindMap(env, userId, mapId) {
  // マインドマップの存在確認
  const existing = await env.DB.prepare(`
    SELECT id FROM mindmaps 
    WHERE id = ? AND user_id = ?
  `).bind(mapId, userId).first();

  if (!existing) {
    console.log(`⚠️ Mindmap already deleted or not found: ${mapId}`);
    return { id: mapId, deleted: true };
  }

  // 同期メタデータを削除
  await env.DB.prepare(`
    DELETE FROM sync_metadata 
    WHERE user_id = ? AND mindmap_id = ?
  `).bind(userId, mapId).run();

  // マインドマップを削除
  await env.DB.prepare(`
    DELETE FROM mindmaps 
    WHERE id = ? AND user_id = ?
  `).bind(mapId, userId).run();

  console.log(`🗑️ Deleted mindmap: ${mapId}`);

  return { id: mapId, deleted: true };
}

/**
 * ノード操作でマインドマップ更新
 */
async function updateMindMapWithNodeOperation(env, userId, mapId, operation, data) {
  // 既存のマインドマップを取得
  const existing = await env.DB.prepare(`
    SELECT data, version FROM mindmaps 
    WHERE id = ? AND user_id = ?
  `).bind(mapId, userId).first();

  if (!existing) {
    throw new Error(`Mindmap not found: ${mapId}`);
  }

  const mindmapData = JSON.parse(existing.data);
  const newVersion = existing.version + 1;

  // ノード操作を適用（フロントエンドから受信したデータをそのまま保存）
  mindmapData.rootNode = data.rootNode || mindmapData.rootNode;
  mindmapData.updatedAt = new Date().toISOString();

  const updatedDataString = JSON.stringify(mindmapData);

  // マインドマップを更新
  await env.DB.prepare(`
    UPDATE mindmaps 
    SET data = ?, version = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(updatedDataString, newVersion, mapId, userId).run();

  // 同期メタデータを更新
  await env.DB.prepare(`
    UPDATE sync_metadata 
    SET last_sync_at = datetime('now'), server_version = ?, sync_status = 'synced'
    WHERE user_id = ? AND mindmap_id = ?
  `).bind(newVersion, userId, mapId).run();

  console.log(`✅ Updated mindmap with ${operation}: ${mapId} (version ${newVersion})`);

  return { id: mapId, operation, version: newVersion };
}

/**
 * 未処理オペレーション取得
 */
async function getPendingOperations(request, env, userId) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM sync_operations 
    WHERE user_id = ? AND status = 'pending'
    ORDER BY created_at ASC
  `).bind(userId).all();

  return new Response(JSON.stringify({
    operations: results,
    count: results.length
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env.CORS_ORIGIN)
    }
  });
}

/**
 * オペレーション状態更新
 */
async function updateOperationStatus(request, env, userId, operationId) {
  const { status, error_message } = await request.json();

  await env.DB.prepare(`
    UPDATE sync_operations 
    SET status = ?, error_message = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(status, error_message || null, operationId, userId).run();

  return new Response(JSON.stringify({
    operationId,
    status: status
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env.CORS_ORIGIN)
    }
  });
}

/**
 * 同期状態取得
 */
async function getSyncStatus(request, env, userId) {
  const pendingOps = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM sync_operations 
    WHERE user_id = ? AND status = 'pending'
  `).bind(userId).first();

  const conflictCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM sync_metadata 
    WHERE user_id = ? AND sync_status = 'conflict'
  `).bind(userId).first();

  return new Response(JSON.stringify({
    pendingOperations: pendingOps.count,
    conflicts: conflictCount.count,
    lastSyncAt: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env.CORS_ORIGIN)
    }
  });
}

/**
 * 競合取得
 */
async function getConflicts(request, env, userId) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM sync_metadata 
    WHERE user_id = ? AND sync_status = 'conflict'
  `).bind(userId).all();

  return new Response(JSON.stringify({
    conflicts: results
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env.CORS_ORIGIN)
    }
  });
}

/**
 * 競合解決
 */
async function resolveConflict(request, env, userId, mindmapId) {
  const { resolution, data } = await request.json();

  if (resolution === 'accept_local') {
    // ローカル版を採用
    await updateMindMap(env, userId, mindmapId, data);
  } else if (resolution === 'accept_server') {
    // サーバー版を採用（何もしない）
  }

  // 競合状態を解決
  await env.DB.prepare(`
    UPDATE sync_metadata 
    SET sync_status = 'synced', conflict_data = NULL, last_sync_at = datetime('now')
    WHERE user_id = ? AND mindmap_id = ?
  `).bind(userId, mindmapId).run();

  return new Response(JSON.stringify({
    mindmapId,
    resolution,
    resolved: true
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env.CORS_ORIGIN)
    }
  });
}