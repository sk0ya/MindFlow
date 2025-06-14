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
    console.error('API Error:', error);
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
    'SELECT id, title, created_at, updated_at FROM mindmaps WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all();
  
  return { mindmaps: results };
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
  
  const mindmap = results[0];
  return {
    ...mindmap,
    data: JSON.parse(mindmap.data)
  };
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
  
  return { id, title, created_at: now, updated_at: now };
}

async function updateMindMap(db, userId, mindmapId, mindmapData) {
  const title = mindmapData.title || 'Untitled Mind Map';
  const data = JSON.stringify(mindmapData);
  const now = new Date().toISOString();
  
  const result = await db.prepare(
    'UPDATE mindmaps SET title = ?, data = ?, updated_at = ? WHERE user_id = ? AND id = ?'
  ).bind(title, data, now, userId, mindmapId).run();
  
  if (result.changes === 0) {
    const error = new Error('Mind map not found');
    error.status = 404;
    throw error;
  }
  
  return { id: mindmapId, title, updated_at: now };
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