import type { Environment, WorkerRequest, ExecutionContext } from '@/types';
import { handleAuthRequest } from '@/handlers/auth';
import { handleFilesRequest } from '@/handlers/files';
import { handleMindmapsRequest } from '@/handlers/mindmaps';
import { handlePreflight, corsHeaders, addCORSHeaders, securityHeaders } from '@/utils/cors';

/**
 * MindFlow API - セキュアなCloudflare Worker
 * 
 * セキュリティ機能:
 * - TypeScript による型安全性
 * - 厳密なバリデーション
 * - セキュアなJWT認証
 * - 適切なCORS設定
 * - セキュリティヘッダー
 * - レート制限
 * - 入力サニタイゼーション
 */

export default {
  async fetch(
    request: WorkerRequest,
    env: Environment,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    try {
      // セキュリティヘッダーをすべてのレスポンスに追加
      const addSecurityHeaders = (response: Response): Response => {
        const headers = new Headers(response.headers);
        Object.entries(securityHeaders()).forEach(([key, value]) => {
          headers.set(key, value);
        });
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      };

      // プリフライトリクエストの処理
      if (request.method === 'OPTIONS') {
        return addSecurityHeaders(handlePreflight(env, request));
      }

      // API エンドポイントのルーティング
      if (url.pathname.startsWith('/api/')) {
        let response: Response;

        if (url.pathname.startsWith('/api/auth/')) {
          response = await handleAuthRequest(request, env, ctx);
        } else if (url.pathname.startsWith('/api/files/')) {
          response = await handleFilesRequest(request, env, ctx);
        } else if (url.pathname.startsWith('/api/mindmaps/')) {
          response = await handleMindmapsRequest(request, env, ctx);
        } else if (url.pathname === '/api/health') {
          response = await handleHealthCheck(env);
        } else if (url.pathname === '/api/info') {
          response = await handleApiInfo(env);
        } else {
          response = new Response(
            JSON.stringify({
              success: false,
              error: 'API endpoint not found',
              message: 'The requested API endpoint does not exist'
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        return addSecurityHeaders(addCORSHeaders(response, env, origin));
      }

      // APIでないパスへのリクエスト
      const notFoundResponse = new Response(
        JSON.stringify({
          success: false,
          error: 'Not Found',
          message: 'This is an API server. Use /api/ endpoints.',
          endpoints: [
            '/api/auth/login',
            '/api/auth/verify', 
            '/api/auth/logout',
            '/api/mindmaps',
            '/api/files',
            '/api/health',
            '/api/info'
          ]
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return addSecurityHeaders(addCORSHeaders(notFoundResponse, env, origin));

    } catch (error) {
      // グローバルエラーハンドラー
      console.error('Global error handler:', error);
      
      const errorResponse = new Response(
        JSON.stringify({
          success: false,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred. Please try again later.',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return addCORSHeaders(errorResponse, env, origin);
    }
  },
};

/**
 * ヘルスチェックエンドポイント
 */
async function handleHealthCheck(env: Environment): Promise<Response> {
  try {
    // データベース接続テスト
    const dbTest = await env.DB.prepare('SELECT 1 as test').first();
    
    // R2接続テスト（軽量な操作）
    const r2Test = await env.FILES.head('health-check-test');
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbTest ? 'operational' : 'error',
        storage: 'operational', // R2は頭出しだけなので基本的にOK
        authentication: env.JWT_SECRET ? 'configured' : 'not_configured',
        email: env.RESEND_KEY ? 'configured' : 'not_configured',
      },
      environment: env.NODE_ENV,
    };

    return new Response(JSON.stringify(health), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service check failed',
      environment: env.NODE_ENV,
    };

    return new Response(JSON.stringify(health), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * API情報エンドポイント
 */
async function handleApiInfo(env: Environment): Promise<Response> {
  const info = {
    name: 'MindFlow API',
    description: 'Secure API for MindFlow mindmap application',
    version: '2.0.0',
    environment: env.NODE_ENV,
    features: {
      authentication: 'Magic Link + JWT',
      storage: 'Cloudflare R2',
      database: 'D1 (SQLite)',
      security: 'TypeScript + Zod validation',
    },
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        verify: 'POST /api/auth/verify',
        logout: 'POST /api/auth/logout',
      },
      mindmaps: {
        list: 'GET /api/mindmaps',
        get: 'GET /api/mindmaps/{id}',
        create: 'POST /api/mindmaps',
        update: 'PUT /api/mindmaps/{id}',
        delete: 'DELETE /api/mindmaps/{id}',
      },
      files: {
        upload: 'POST /api/files/{mindmapId}/{nodeId}',
        download: 'GET /api/files/{mindmapId}/{nodeId}/{fileId}?type=download',
        info: 'GET /api/files/{mindmapId}/{nodeId}/{fileId}',
        list_node: 'GET /api/files/{mindmapId}/{nodeId}',
        list_mindmap: 'GET /api/files/{mindmapId}',
        update: 'PUT /api/files/{mindmapId}/{nodeId}/{fileId}',
        delete: 'DELETE /api/files/{mindmapId}/{nodeId}/{fileId}',
      },
      system: {
        health: 'GET /api/health',
        info: 'GET /api/info',
      },
    },
    security: {
      authentication: env.ENABLE_AUTH === 'true' ? 'enabled' : 'disabled',
      cors_origins: env.CORS_ORIGIN.split(',').length,
      rate_limiting: 'enabled',
      file_upload_limit: '10MB',
      supported_file_types: [
        'image/*', 'application/pdf', 'text/*', 
        'video/mp4', 'video/webm', 'audio/*'
      ],
    },
  };

  return new Response(JSON.stringify(info, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}