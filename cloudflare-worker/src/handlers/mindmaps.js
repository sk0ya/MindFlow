import { corsHeaders } from '../utils/cors.js';
import { requireAuth } from '../utils/auth.js';

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  
  // 認証チェック（環境変数でON/OFF切り替え可能）
  let userId = 'default-user';
  if (env.ENABLE_AUTH === 'true') {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN)
        }
      });
    }
    userId = authResult.user.userId;
  } else {
    // 認証が無効の場合は従来の方法を使用
    userId = request.headers.get('X-User-ID') || 'default-user';
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
    'SELECT * FROM mindmaps WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all();
  
  // データ構造をローカル形式に統一
  const mindmaps = results.map(row => {
    try {
      const data = JSON.parse(row.data);
      return {
        ...data,
        // クラウド固有のフィールドをローカル形式に統一
        updatedAt: row.updated_at,
        createdAt: row.created_at
      };
    } catch (error) {
      console.error('Failed to parse mindmap data:', error);
      // パースに失敗した場合は基本情報のみ返す
      return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        category: '未分類',
        theme: 'default',
        rootNode: {
          id: 'root',
          text: 'メイントピック',
          x: 400,
          y: 300,
          children: []
        },
        settings: {
          autoSave: true,
          autoLayout: true
        }
      };
    }
  });
  
  return { mindmaps };
}

async function getMindMap(db, userId, mindmapId) {
  const { results } = await db.prepare(
    'SELECT * FROM mindmaps WHERE user_id = ? AND id = ?'
  ).bind(userId, mindmapId).all();
  
  if (results.length === 0) {
    const error = new Error('Mind map not found');
    error.status = 404;
    throw error;
  }
  
  const row = results[0];
  try {
    const data = JSON.parse(row.data);
    return {
      ...data,
      // クラウド固有のフィールドをローカル形式に統一
      updatedAt: row.updated_at,
      createdAt: row.created_at
    };
  } catch (error) {
    console.error('Failed to parse mindmap data:', error);
    // パースに失敗した場合は基本情報のみ返す
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      category: '未分類',
      theme: 'default',
      rootNode: {
        id: 'root',
        text: 'メイントピック',
        x: 400,
        y: 300,
        children: []
      },
      settings: {
        autoSave: true,
        autoLayout: true
      }
    };
  }
}

async function createMindMap(db, userId, mindmapData) {
  // Ensure user exists
  await ensureUser(db, userId);
  
  const id = mindmapData.id || crypto.randomUUID();
  const title = mindmapData.title || 'Untitled Mind Map';
  const data = JSON.stringify(mindmapData);
  const now = new Date().toISOString();
  
  await db.prepare(
    'INSERT INTO mindmaps (id, user_id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, title, data, now, now).run();
  
  // ローカル形式で返す
  return {
    ...mindmapData,
    createdAt: now,
    updatedAt: now
  };
}

async function updateMindMap(db, userId, mindmapId, mindmapData) {
  const title = mindmapData.title || 'Untitled Mind Map';
  const data = JSON.stringify(mindmapData);
  const now = new Date().toISOString();
  
  console.log('updateMindMap 実行:', { userId, mindmapId, title });
  
  const result = await db.prepare(
    'UPDATE mindmaps SET title = ?, data = ?, updated_at = ? WHERE user_id = ? AND id = ?'
  ).bind(title, data, now, userId, mindmapId).run();
  
  console.log('UPDATE結果:', result);
  console.log('result.changes:', result.changes, 'typeof:', typeof result.changes);
  console.log('result.meta.changes:', result.meta?.changes, 'typeof:', typeof result.meta?.changes);
  
  const changesCount = result.changes ?? result.meta?.changes ?? 0;
  console.log('実際のchanges値:', changesCount);
  
  if (changesCount === 0) {
    // 更新対象が見つからない場合は新規作成
    console.log('マインドマップが見つからないため新規作成:', mindmapId);
    
    // Ensure user exists
    await ensureUser(db, userId);
    
    const insertResult = await db.prepare(
      'INSERT INTO mindmaps (id, user_id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(mindmapId, userId, title, data, now, now).run();
    
    console.log('INSERT結果:', insertResult);
    
    // ローカル形式で返す
    return {
      ...mindmapData,
      createdAt: now,
      updatedAt: now
    };
  }
  
  // ローカル形式で返す
  return {
    ...mindmapData,
    updatedAt: now
  };
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