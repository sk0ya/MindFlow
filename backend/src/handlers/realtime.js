import { corsHeaders } from '../utils/cors.js';
import { requireAuth } from '../utils/auth.js';

/**
 * リアルタイム同期APIハンドラー
 * WebSocket接続とDurable Objectsを管理
 */
export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  
  try {
    // ルーティング
    if (url.pathname.endsWith('/connect')) {
      return await handleWebSocketConnect(request, env);
    } else if (url.pathname.includes('/room/')) {
      return await handleRoomOperations(request, env);
    } else {
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders(env.CORS_ORIGIN)
      });
    }
  } catch (error) {
    console.error('Realtime API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
    });
  }
}

/**
 * WebSocket接続ハンドラー
 */
async function handleWebSocketConnect(request, env) {
  const url = new URL(request.url);
  const mindmapId = url.searchParams.get('mindmapId');
  
  if (!mindmapId) {
    return new Response('MindMap ID required', { 
      status: 400,
      headers: corsHeaders(env.CORS_ORIGIN)
    });
  }

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

  // マインドマップへのアクセス権確認
  const mindmap = await env.DB.prepare(
    'SELECT id, title FROM mindmaps WHERE id = ? AND user_id = ?'
  ).bind(mindmapId, userId).first();

  if (!mindmap) {
    return new Response('Access denied', { 
      status: 403,
      headers: corsHeaders(env.CORS_ORIGIN)
    });
  }

  // Durable ObjectのIDを生成
  const roomId = env.MINDMAP_ROOMS.idFromName(mindmapId);
  const roomStub = env.MINDMAP_ROOMS.get(roomId);

  // WebSocket接続をDurable Objectに転送
  return await roomStub.fetch(request);
}

/**
 * ルーム操作ハンドラー
 */
async function handleRoomOperations(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const mindmapId = pathParts[pathParts.indexOf('room') + 1];
  const operation = pathParts[pathParts.indexOf('room') + 2];

  if (!mindmapId) {
    return new Response('MindMap ID required', { 
      status: 400,
      headers: corsHeaders(env.CORS_ORIGIN)
    });
  }

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

  // アクセス権確認
  const mindmap = await env.DB.prepare(
    'SELECT id, title FROM mindmaps WHERE id = ? AND user_id = ?'
  ).bind(mindmapId, userId).first();

  if (!mindmap) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { 
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
    });
  }

  const roomId = env.MINDMAP_ROOMS.idFromName(mindmapId);
  const roomStub = env.MINDMAP_ROOMS.get(roomId);

  switch (operation) {
    case 'status':
      return await getRoomStatus(roomStub, env);
    
    case 'participants':
      return await getRoomParticipants(roomStub, env);
    
    case 'history':
      return await getRoomHistory(roomStub, request, env);
    
    case 'sync':
      return await forceSync(roomStub, request, env);
    
    default:
      return new Response(JSON.stringify({ error: 'Unknown operation' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
      });
  }
}

/**
 * ルーム状態取得
 */
async function getRoomStatus(roomStub, env) {
  try {
    // Durable Objectから状態を取得するためのHTTPリクエスト
    const statusRequest = new Request('http://localhost/status', {
      method: 'GET'
    });

    const response = await roomStub.fetch(statusRequest);
    
    if (response.ok) {
      const status = await response.json();
      return new Response(JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
      });
    } else {
      return new Response(JSON.stringify({ 
        isActive: false,
        participants: 0,
        lastActivity: null 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
      });
    }
  } catch (error) {
    console.error('Room status error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get room status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
    });
  }
}

/**
 * ルーム参加者取得
 */
async function getRoomParticipants(roomStub, env) {
  try {
    const participantsRequest = new Request('http://localhost/participants', {
      method: 'GET'
    });

    const response = await roomStub.fetch(participantsRequest);
    
    if (response.ok) {
      const participants = await response.json();
      return new Response(JSON.stringify(participants), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
      });
    } else {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
      });
    }
  } catch (error) {
    console.error('Room participants error:', error);
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
    });
  }
}

/**
 * ルーム履歴取得
 */
async function getRoomHistory(roomStub, request, env) {
  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '50';
    const since = url.searchParams.get('since');

    const historyRequest = new Request(`http://localhost/history?limit=${limit}${since ? `&since=${since}` : ''}`, {
      method: 'GET'
    });

    const response = await roomStub.fetch(historyRequest);
    
    if (response.ok) {
      const history = await response.json();
      return new Response(JSON.stringify(history), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
      });
    } else {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
      });
    }
  } catch (error) {
    console.error('Room history error:', error);
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
    });
  }
}

/**
 * 強制同期
 */
async function forceSync(roomStub, request, env) {
  try {
    const syncRequest = new Request('http://localhost/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: await request.text()
    });

    const response = await roomStub.fetch(syncRequest);
    
    const result = response.ok ? await response.json() : { success: false };
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
    });
  } catch (error) {
    console.error('Force sync error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env.CORS_ORIGIN) }
    });
  }
}

/**
 * リアルタイム統計情報取得
 */
export async function getRealtimeStats(env) {
  try {
    // 全てのアクティブなマインドマップを取得
    const { results: activeMindmaps } = await env.DB.prepare(
      'SELECT id FROM mindmaps WHERE updated_at > datetime("now", "-1 hour")'
    ).all();

    const stats = {
      totalRooms: activeMindmaps.length,
      activeRooms: 0,
      totalParticipants: 0,
      averageParticipants: 0
    };

    // 各ルームの状態を確認
    for (const mindmap of activeMindmaps) {
      try {
        const roomId = env.MINDMAP_ROOMS.idFromName(mindmap.id);
        const roomStub = env.MINDMAP_ROOMS.get(roomId);
        
        const statusRequest = new Request('http://localhost/status', {
          method: 'GET'
        });

        const response = await roomStub.fetch(statusRequest);
        
        if (response.ok) {
          const roomStatus = await response.json();
          if (roomStatus.isActive) {
            stats.activeRooms++;
            stats.totalParticipants += roomStatus.participants;
          }
        }
      } catch (error) {
        // ルームがアクティブでない場合はスキップ
        console.log(`Room ${mindmap.id} not active`);
      }
    }

    stats.averageParticipants = stats.activeRooms > 0 
      ? Math.round(stats.totalParticipants / stats.activeRooms * 100) / 100 
      : 0;

    return stats;
  } catch (error) {
    console.error('Realtime stats error:', error);
    return {
      totalRooms: 0,
      activeRooms: 0,
      totalParticipants: 0,
      averageParticipants: 0,
      error: error.message
    };
  }
}

/**
 * ルーム一覧取得（管理用）
 */
export async function getAllActiveRooms(env) {
  try {
    const { results: recentMindmaps } = await env.DB.prepare(
      'SELECT id, title, user_id, updated_at FROM mindmaps WHERE updated_at > datetime("now", "-1 day") ORDER BY updated_at DESC'
    ).all();

    const rooms = [];

    for (const mindmap of recentMindmaps) {
      try {
        const roomId = env.MINDMAP_ROOMS.idFromName(mindmap.id);
        const roomStub = env.MINDMAP_ROOMS.get(roomId);
        
        const statusRequest = new Request('http://localhost/status', {
          method: 'GET'
        });

        const response = await roomStub.fetch(statusRequest);
        
        let roomStatus = {
          isActive: false,
          participants: 0,
          lastActivity: null
        };

        if (response.ok) {
          roomStatus = await response.json();
        }

        rooms.push({
          mindmapId: mindmap.id,
          title: mindmap.title,
          userId: mindmap.user_id,
          updatedAt: mindmap.updated_at,
          isActive: roomStatus.isActive,
          participants: roomStatus.participants,
          lastActivity: roomStatus.lastActivity
        });
      } catch (error) {
        // ルームにアクセスできない場合
        rooms.push({
          mindmapId: mindmap.id,
          title: mindmap.title,
          userId: mindmap.user_id,
          updatedAt: mindmap.updated_at,
          isActive: false,
          participants: 0,
          lastActivity: null
        });
      }
    }

    return rooms;
  } catch (error) {
    console.error('Get all active rooms error:', error);
    throw error;
  }
}

/**
 * 非アクティブなルームのクリーンアップ
 */
export async function cleanupInactiveRooms(env) {
  try {
    const allRooms = await getAllActiveRooms(env);
    const inactiveRooms = allRooms.filter(room => 
      !room.isActive && 
      room.lastActivity && 
      Date.now() - new Date(room.lastActivity).getTime() > 24 * 60 * 60 * 1000 // 24時間
    );

    const cleanupResults = [];

    for (const room of inactiveRooms) {
      try {
        const roomId = env.MINDMAP_ROOMS.idFromName(room.mindmapId);
        const roomStub = env.MINDMAP_ROOMS.get(roomId);
        
        const cleanupRequest = new Request('http://localhost/cleanup', {
          method: 'POST'
        });

        const response = await roomStub.fetch(cleanupRequest);
        
        cleanupResults.push({
          mindmapId: room.mindmapId,
          success: response.ok,
          error: response.ok ? null : await response.text()
        });
      } catch (error) {
        cleanupResults.push({
          mindmapId: room.mindmapId,
          success: false,
          error: error.message
        });
      }
    }

    return {
      totalCleaned: cleanupResults.filter(r => r.success).length,
      totalFailed: cleanupResults.filter(r => !r.success).length,
      results: cleanupResults
    };
  } catch (error) {
    console.error('Cleanup inactive rooms error:', error);
    throw error;
  }
}