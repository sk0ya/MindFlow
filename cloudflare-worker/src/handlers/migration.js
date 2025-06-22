// マイグレーション管理エンドポイント

import { corsHeaders } from '../utils/cors.js';
import { requireAuth } from '../utils/auth.js';
import { unifyUserIds, checkMigrationNeeded } from '../migrations/unifyUserIds.js';

export async function handleMigrationRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const pathParts = url.pathname.split('/');
  const action = pathParts[3]; // /api/migration/{action}

  // 管理者権限チェック（簡易版）
  if (env.ENABLE_AUTH === 'true') {
    const authResult = await requireAuth(request);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN)
        }
      });
    }
    
    // 管理者メールアドレスのチェック（環境変数で設定）
    const adminEmails = env.ADMIN_EMAILS ? env.ADMIN_EMAILS.split(',').map(e => e.trim()) : [];
    if (adminEmails.length > 0 && !adminEmails.includes(authResult.user.email)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN)
        }
      });
    }
  } else {
    // 認証が無効の場合は特別なヘッダーで管理者確認
    const adminKey = request.headers.get('X-Admin-Key');
    if (!adminKey || adminKey !== env.ADMIN_KEY) {
      return new Response(JSON.stringify({ error: 'Admin key required' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(env.CORS_ORIGIN)
        }
      });
    }
  }

  try {
    let response;
    
    switch (method) {
      case 'GET':
        if (action === 'check') {
          response = await checkMigrationNeeded(env);
        } else {
          throw new Error(`Unknown migration action: ${action}`);
        }
        break;
      
      case 'POST':
        if (action === 'unify-userids') {
          response = await unifyUserIds(env);
        } else {
          throw new Error(`Unknown migration action: ${action}`);
        }
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
    console.error('Migration Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });
  }
}