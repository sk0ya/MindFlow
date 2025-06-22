// マイグレーション管理エンドポイント

import { corsHeaders } from '../utils/cors.js';
import { requireAuth } from '../utils/auth.js';
import { unifyUserIds, checkMigrationNeeded } from '../migrations/unifyUserIds.js';
import { cleanAllData, cleanR2Storage, getDataSummary } from '../migrations/cleanDatabase.js';

export async function handleMigrationRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const pathParts = url.pathname.split('/');
  const action = pathParts[3]; // /api/migration/{action}

  // 管理者権限チェック（Admin Keyを優先）
  const adminKey = request.headers.get('X-Admin-Key');
  if (adminKey && adminKey === env.ADMIN_KEY) {
    // Admin Keyが正しい場合は認証をスキップ
    console.log('Admin key認証成功');
  } else if (env.ENABLE_AUTH === 'true') {
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
    // 認証が無効でAdminKeyも無い場合はエラー
    return new Response(JSON.stringify({ error: 'Admin key required' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });
  }

  try {
    let response;
    
    switch (method) {
      case 'GET':
        if (action === 'check') {
          response = await checkMigrationNeeded(env);
        } else if (action === 'summary') {
          response = await getDataSummary(env);
        } else {
          throw new Error(`Unknown migration action: ${action}`);
        }
        break;
      
      case 'POST':
        if (action === 'unify-userids') {
          response = await unifyUserIds(env);
        } else if (action === 'clean-database') {
          response = await cleanAllData(env);
        } else if (action === 'clean-r2') {
          response = await cleanR2Storage(env);
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