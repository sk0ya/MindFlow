/**
 * 新しいマインドマップAPIハンドラー - IndexedDBベース同期対応
 */

import { requireAuth } from '../utils/auth.js';
import { corsHeaders } from '../utils/cors.js';

export async function handleMindMapsRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  console.log(`🗺️ MindMaps API: ${method} ${path}`);

  try {
    // 認証が必要な全エンドポイント
    const authResult = await requireAuth(request, env);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const userId = authResult.user.userId;

    // ルーティング
    if (path === '/api/mindmaps' && method === 'GET') {
      return await getAllMindMaps(request, env, userId);
    }

    if (path === '/api/mindmaps' && method === 'POST') {
      return await createMindMap(request, env, userId);
    }

    if (path.match(/^\/api\/mindmaps\/([^\/]+)$/) && method === 'GET') {
      const mindmapId = path.split('/').pop();
      return await getMindMap(request, env, userId, mindmapId);
    }

    if (path.match(/^\/api\/mindmaps\/([^\/]+)$/) && method === 'PUT') {
      const mindmapId = path.split('/').pop();
      return await updateMindMap(request, env, userId, mindmapId);
    }

    if (path.match(/^\/api\/mindmaps\/([^\/]+)$/) && method === 'DELETE') {
      const mindmapId = path.split('/').pop();
      return await deleteMindMap(request, env, userId, mindmapId);
    }

    if (path.match(/^\/api\/mindmaps\/([^\/]+)\/sync$/) && method === 'GET') {
      const mindmapId = path.split('/')[3];
      return await getSyncInfo(request, env, userId, mindmapId);
    }

    return new Response(JSON.stringify({
      error: 'MindMaps endpoint not found',
      path: path
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('❌ MindMaps API Error:', error);
    
    return new Response(JSON.stringify({
      error: 'MindMaps operation failed',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 全マインドマップ取得
 */
async function getAllMindMaps(request, env, userId) {
  console.log(`📋 Getting all mindmaps for user: ${userId}`);

  const { results } = await env.DB.prepare(`
    SELECT 
      m.id,
      m.title,
      m.version,
      m.created_at,
      m.updated_at,
      sm.sync_status,
      sm.local_version,
      sm.server_version,
      sm.last_sync_at
    FROM mindmaps m
    LEFT JOIN sync_metadata sm ON m.id = sm.mindmap_id AND m.user_id = sm.user_id
    WHERE m.user_id = ?
    ORDER BY m.updated_at DESC
  `).bind(userId).all();

  console.log(`✅ Found ${results.length} mindmaps for user ${userId}`);

  return new Response(JSON.stringify({
    mindmaps: results,
    count: results.length
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

/**
 * マインドマップ作成
 */
async function createMindMap(request, env, userId) {
  const data = await request.json();
  const { id, title, rootNode, settings } = data;

  if (!id || !title || !rootNode) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: id, title, rootNode'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  console.log(`➕ Creating mindmap: ${title} (${id}) for user ${userId}`);

  // 重複チェック
  const existing = await env.DB.prepare(`
    SELECT id FROM mindmaps WHERE id = ? AND user_id = ?
  `).bind(id, userId).first();

  if (existing) {
    return new Response(JSON.stringify({
      error: 'Mindmap with this ID already exists',
      id: id
    }), {
      status: 409,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  const mindmapData = JSON.stringify({
    id,
    title,
    rootNode,
    settings: settings || { autoSave: true, autoLayout: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // トランザクション処理
  try {
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

    const result = {
      id,
      title,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced'
    };

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error(`❌ Failed to create mindmap ${id}:`, error);
    
    return new Response(JSON.stringify({
      error: 'Failed to create mindmap',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 特定マインドマップ取得
 */
async function getMindMap(request, env, userId, mindmapId) {
  console.log(`📖 Getting mindmap: ${mindmapId} for user ${userId}`);

  const mindmap = await env.DB.prepare(`
    SELECT 
      m.id,
      m.title,
      m.data,
      m.version,
      m.created_at,
      m.updated_at,
      sm.sync_status,
      sm.local_version,
      sm.server_version,
      sm.last_sync_at
    FROM mindmaps m
    LEFT JOIN sync_metadata sm ON m.id = sm.mindmap_id AND m.user_id = sm.user_id
    WHERE m.id = ? AND m.user_id = ?
  `).bind(mindmapId, userId).first();

  if (!mindmap) {
    return new Response(JSON.stringify({
      error: 'Mindmap not found',
      id: mindmapId
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  // JSONデータをパース
  let parsedData;
  try {
    parsedData = JSON.parse(mindmap.data);
  } catch (error) {
    console.error(`❌ Failed to parse mindmap data for ${mindmapId}:`, error);
    return new Response(JSON.stringify({
      error: 'Invalid mindmap data format'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  const result = {
    ...parsedData,
    version: mindmap.version,
    syncStatus: mindmap.sync_status || 'synced',
    localVersion: mindmap.local_version,
    serverVersion: mindmap.server_version,
    lastSyncAt: mindmap.last_sync_at
  };

  console.log(`✅ Retrieved mindmap: ${mindmap.title} (${mindmapId})`);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

/**
 * マインドマップ更新
 */
async function updateMindMap(request, env, userId, mindmapId) {
  const data = await request.json();
  const { title, rootNode, settings } = data;

  console.log(`📝 Updating mindmap: ${mindmapId} for user ${userId}`);

  // 既存のマインドマップを取得
  const existing = await env.DB.prepare(`
    SELECT data, version FROM mindmaps 
    WHERE id = ? AND user_id = ?
  `).bind(mindmapId, userId).first();

  if (!existing) {
    return new Response(JSON.stringify({
      error: 'Mindmap not found',
      id: mindmapId
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  let existingData;
  try {
    existingData = JSON.parse(existing.data);
  } catch (error) {
    console.error(`❌ Failed to parse existing mindmap data:`, error);
    return new Response(JSON.stringify({
      error: 'Invalid existing mindmap data format'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  const newVersion = existing.version + 1;

  const updatedData = JSON.stringify({
    ...existingData,
    title: title || existingData.title,
    rootNode: rootNode || existingData.rootNode,
    settings: settings || existingData.settings,
    updatedAt: new Date().toISOString()
  });

  try {
    // マインドマップを更新
    await env.DB.prepare(`
      UPDATE mindmaps 
      SET title = ?, data = ?, version = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(title || existingData.title, updatedData, newVersion, mindmapId, userId).run();

    // 同期メタデータを更新
    await env.DB.prepare(`
      INSERT OR REPLACE INTO sync_metadata (user_id, mindmap_id, last_sync_at, local_version, server_version, sync_status)
      VALUES (?, ?, datetime('now'), ?, ?, 'synced')
    `).bind(userId, mindmapId, newVersion, newVersion).run();

    console.log(`✅ Updated mindmap: ${mindmapId} (version ${newVersion})`);

    const result = {
      id: mindmapId,
      title: title || existingData.title,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced'
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error(`❌ Failed to update mindmap ${mindmapId}:`, error);
    
    return new Response(JSON.stringify({
      error: 'Failed to update mindmap',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * マインドマップ削除
 */
async function deleteMindMap(request, env, userId, mindmapId) {
  console.log(`🗑️ Deleting mindmap: ${mindmapId} for user ${userId}`);

  // マインドマップの存在確認
  const existing = await env.DB.prepare(`
    SELECT id, title FROM mindmaps 
    WHERE id = ? AND user_id = ?
  `).bind(mindmapId, userId).first();

  if (!existing) {
    console.log(`⚠️ Mindmap already deleted or not found: ${mindmapId}`);
    return new Response(JSON.stringify({
      message: 'Mindmap already deleted or not found',
      id: mindmapId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  try {
    // 同期メタデータを削除
    await env.DB.prepare(`
      DELETE FROM sync_metadata 
      WHERE user_id = ? AND mindmap_id = ?
    `).bind(userId, mindmapId).run();

    // 関連する同期オペレーションを削除
    await env.DB.prepare(`
      DELETE FROM sync_operations 
      WHERE user_id = ? AND mindmap_id = ?
    `).bind(userId, mindmapId).run();

    // マインドマップを削除
    await env.DB.prepare(`
      DELETE FROM mindmaps 
      WHERE id = ? AND user_id = ?
    `).bind(mindmapId, userId).run();

    console.log(`✅ Deleted mindmap: ${existing.title} (${mindmapId})`);

    return new Response(JSON.stringify({
      message: 'Mindmap deleted successfully',
      id: mindmapId,
      title: existing.title
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error(`❌ Failed to delete mindmap ${mindmapId}:`, error);
    
    return new Response(JSON.stringify({
      error: 'Failed to delete mindmap',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 同期情報取得
 */
async function getSyncInfo(request, env, userId, mindmapId) {
  console.log(`🔄 Getting sync info for mindmap: ${mindmapId}`);

  const syncInfo = await env.DB.prepare(`
    SELECT 
      sm.*,
      m.version as current_version,
      m.updated_at as last_updated
    FROM sync_metadata sm
    JOIN mindmaps m ON sm.mindmap_id = m.id AND sm.user_id = m.user_id
    WHERE sm.user_id = ? AND sm.mindmap_id = ?
  `).bind(userId, mindmapId).first();

  if (!syncInfo) {
    return new Response(JSON.stringify({
      error: 'Sync info not found',
      mindmapId: mindmapId
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  return new Response(JSON.stringify(syncInfo), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}