// Mindmaps Handler
import { corsHeaders } from '../utils/cors.js';
import { verifyJWT } from '../utils/auth.js';

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  
  console.log('🗺️ Mindmaps API Request:', { 
    method, 
    pathname: url.pathname,
    hasAuth: !!request.headers.get('Authorization')
  });
  
  // JWT authentication
  let userId;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ 認証ヘッダーなし');
    const error = new Error('Authorization header required');
    error.status = 401;
    throw error;
  }
  
  const token = authHeader.substring(7);
  console.log('🔍 JWT検証開始:', { tokenStart: token.substring(0, 10) + '...' });
  const verification = await verifyJWT(token);
  if (!verification.valid) {
    console.error('❌ 無効なJWTトークン');
    const error = new Error('Invalid token');
    error.status = 401;
    throw error;
  }
  
  userId = verification.payload.userId; // email address
  console.log('✅ 認証成功 - Mindmaps API:', { userId });

  // Extract mindmap ID from path if present
  const pathParts = url.pathname.split('/');
  const mindmapId = pathParts[3]; // /api/mindmaps/{id}

  try {
    let response;
    
    switch (method) {
      case 'GET':
        if (mindmapId) {
          console.log('📋 特定マップ取得:', { mindmapId });
          response = await getMindMap(env.DB, userId, mindmapId);
        } else {
          console.log('📋 全マップ一覧取得:', { userId });
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
  console.log('📋 getAllMindMaps開始:', { userId });
  
  await ensureUser(db, userId);
  console.log('✅ ユーザー確認完了');
  
  console.log('🔍 マップクエリ実行');
  const { results } = await db.prepare(
    'SELECT * FROM mindmaps WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all();
  
  console.log('📋 マップクエリ結果:', { 
    count: results.length,
    maps: results.map(r => ({ id: r.id, title: r.title }))
  });
  
  // dataフィールドをパースして、完全なマインドマップデータを返す
  const mindmaps = results.map(row => {
    const data = JSON.parse(row.data);
    return {
      ...data,
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
  
  console.log('📋 完全なマップデータ:', { 
    count: mindmaps.length,
    firstMap: mindmaps[0] ? { 
      id: mindmaps[0].id, 
      title: mindmaps[0].title,
      hasRootNode: !!mindmaps[0].rootNode 
    } : null
  });
  
  return { mindmaps };
}

async function getMindMap(db, userId, mindmapId) {
  const mindmap = await db.prepare(
    'SELECT * FROM mindmaps WHERE user_id = ? AND id = ?'
  ).bind(userId, mindmapId).first();
  
  if (!mindmap) {
    const error = new Error('Mind map not found');
    error.status = 404;
    throw error;
  }
  
  const data = JSON.parse(mindmap.data);
  return {
    ...data,
    id: mindmap.id,
    createdAt: mindmap.created_at,
    updatedAt: mindmap.updated_at
  };
}

async function createMindMap(db, userId, mindmapData) {
  await ensureUser(db, userId);
  
  const id = mindmapData.id || crypto.randomUUID();
  const now = new Date().toISOString();
  
  await db.prepare(
    'INSERT INTO mindmaps (id, user_id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    userId,
    mindmapData.title || 'Untitled Mind Map',
    JSON.stringify(mindmapData),
    now,
    now
  ).run();
  
  return {
    ...mindmapData,
    id: id,
    createdAt: now,
    updatedAt: now
  };
}

async function updateMindMap(db, userId, mindmapId, mindmapData) {
  const now = new Date().toISOString();
  
  const result = await db.prepare(
    'UPDATE mindmaps SET title = ?, data = ?, updated_at = ? WHERE user_id = ? AND id = ?'
  ).bind(
    mindmapData.title || 'Untitled Mind Map',
    JSON.stringify(mindmapData),
    now,
    userId,
    mindmapId
  ).run();
  
  if (result.changes === 0) {
    const error = new Error('Mind map not found');
    error.status = 404;
    throw error;
  }
  
  return {
    ...mindmapData,
    id: mindmapId,
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
      'INSERT INTO users (id, created_at, updated_at) VALUES (?, ?, ?)'
    ).bind(userId, new Date().toISOString(), new Date().toISOString()).run();
  }
}