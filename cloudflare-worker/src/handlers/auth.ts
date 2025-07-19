import type { 
  Environment, 
  WorkerRequest, 
  ExecutionContext,
  LoginRequest,
  VerifyTokenRequest,
  AuthResponse,
} from '@/types';
import { LoginRequestSchema, VerifyTokenRequestSchema } from '@/types';
import {
  generateAccessToken,
  generateMagicLinkToken,
  storeMagicLinkToken,
  verifyAndConsumeMagicLinkToken,
  getOrCreateUser,
  cleanupExpiredTokens,
  checkRateLimit,
  requireAuth,
} from '@/utils/auth';
import { corsHeaders, addCORSHeaders } from '@/utils/cors';
import { validateRequestBody, isValidEmail } from '@/utils/validation';
import { sendMagicLinkEmail } from '@/utils/email';

/**
 * セキュアな認証ハンドラー
 * - 適切なバリデーション
 * - レート制限
 * - セキュアなトークン管理
 */

export async function handleAuthRequest(
  request: WorkerRequest,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const origin = request.headers.get('Origin');

  try {
    let response: Response;

    switch (method) {
      case 'POST':
        if (url.pathname === '/api/auth/login') {
          response = await handleLogin(request, env, ctx);
        } else if (url.pathname === '/api/auth/verify') {
          response = await handleVerifyToken(request, env, ctx);
        } else if (url.pathname === '/api/auth/validate') {
          response = await handleValidateToken(request, env, ctx);
        } else if (url.pathname === '/api/auth/logout') {
          response = await handleLogout(request, env, ctx);
        } else {
          response = new Response(
            JSON.stringify({ success: false, error: 'Endpoint not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
        break;

      case 'OPTIONS':
        // プリフライトリクエストの処理は cors.ts で処理
        response = new Response(null, {
          status: 204,
          headers: corsHeaders(env, origin),
        });
        break;

      default:
        response = new Response(
          JSON.stringify({ success: false, error: 'Method not allowed' }),
          { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
    }

    return addCORSHeaders(response, env, origin);
  } catch (error) {
    console.error('Auth handler error:', error);
    const errorResponse = new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        message: 'Authentication service temporarily unavailable'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
    return addCORSHeaders(errorResponse, env, origin);
  }
}

/**
 * ログイン処理（Magic Link送信）
 */
async function handleLogin(
  request: WorkerRequest,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // リクエストボディのバリデーション
    const loginData = await validateRequestBody(request, LoginRequestSchema);
    const { email } = loginData;

    // メールアドレスの詳細バリデーション
    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid email format' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // アクセス許可チェック
    const allowedEmails = env.ALLOWED_EMAILS.split(',').map(e => e.trim());
    if (!allowedEmails.includes(email)) {
      // セキュリティのため、同じメッセージを返す
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'If your email is registered, you will receive a magic link shortly.' 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // レート制限チェック
    const canProceed = await checkRateLimit(env.DB, email, 5, 15);
    if (!canProceed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many login attempts. Please try again later.' 
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ユーザーを取得または作成
    const user = await getOrCreateUser(env.DB, email);

    // Magic Linkトークンを生成
    const token = generateMagicLinkToken();
    await storeMagicLinkToken(env.DB, user.id, token, 10); // 10分間有効

    // Magic Linkを構築
    const magicLink = `${env.FRONTEND_URL}?token=${token}`;

    // メール送信結果をチェック
    const emailResult = await sendMagicLinkEmail(env, email, magicLink);

    // 期限切れトークンのクリーンアップ（バックグラウンドで実行）
    ctx.waitUntil(cleanupExpiredTokens(env.DB));
    
    const response: AuthResponse = {
      success: true,
      message: 'Magic link sent successfully',
      emailSent: emailResult.success,
    };

    // 開発環境または本番環境でもResendが設定されていない場合はMagic Linkを含める
    if (env.NODE_ENV === 'development' || !env.RESEND_KEY) {
      response.magicLink = magicLink;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Login failed',
        message: 'Unable to process login request at this time'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Magic Linkトークン検証
 */
async function handleVerifyToken(
  request: WorkerRequest,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // リクエストボディのバリデーション
    const verifyData = await validateRequestBody(request, VerifyTokenRequestSchema);
    const { token } = verifyData;

    // トークンの形式チェック
    if (token.length < 32) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid token format' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Magic Linkトークンを検証・消費
    let authToken;
    try {
      authToken = await verifyAndConsumeMagicLinkToken(env.DB, token);
    } catch (dbError) {
      console.error('Database error during token verification:', dbError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database error',
          message: 'Unable to verify token due to database error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!authToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token' 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ユーザー情報を取得
    const user = await getOrCreateUser(env.DB, authToken.user_id);

    // JWT アクセストークンを生成
    const accessToken = await generateAccessToken(user.id, user.id, env);

    const response: AuthResponse = {
      success: true,
      message: 'Authentication successful',
      user: {
        id: user.id,
        email: user.id,
      },
      accessToken,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Token verification failed',
        message: 'Unable to verify authentication token'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * トークン検証処理
 */
async function handleValidateToken(
  request: WorkerRequest,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // Authorization ヘッダーからJWTトークンを取得
    const authResult = await requireAuth(request, env);
    
    if (!authResult.authenticated) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token',
          authenticated: false
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response: AuthResponse = {
      success: true,
      message: 'Token is valid',
      user: authResult.user,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Token validation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Token validation failed',
        authenticated: false
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * ログアウト処理
 */
async function handleLogout(
  request: WorkerRequest,
  env: Environment,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // 現在の実装では、クライアント側でトークンを削除するだけ
    // 将来的にはJWTのブラックリスト機能を実装可能

    const response: AuthResponse = {
      success: true,
      message: 'Logout successful',
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Logout error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Logout failed' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}