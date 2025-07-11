// 認証エンドポイントのハンドラー

import { corsHeaders } from '../utils/cors.js';
import { authenticateUser, generateJWT, verifyJWT } from '../utils/auth.js';
import { sendMagicLinkEmail } from '../utils/email.js';
import { createAuthToken, verifyAuthToken, cleanupExpiredTokens } from '../utils/authTokens.js';

export async function handleAuthRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const pathParts = url.pathname.split('/');
  const action = pathParts[3]; // /api/auth/{action}

  try {
    let response;
    
    switch (method) {
      case 'POST':
        if (action === 'login') {
          response = await handleSendMagicLink(request, env);
        } else if (action === 'register') {
          response = await handleSendMagicLink(request, env);
        } else if (action === 'verify') {
          response = await handleVerifyMagicLink(request, env);
        } else if (action === 'refresh') {
          response = await handleRefreshToken(request, env);
        } else {
          throw new Error(`Unknown auth action: ${action}`);
        }
        break;
      
      case 'GET':
        if (action === 'me') {
          response = await handleGetCurrentUser(request, env);
        } else if (action === 'verify') {
          response = await handleVerifyMagicLink(request, env);
        } else if (action === 'google') {
          response = await handleGoogleAuth(request, env);
        } else if (action === 'google-callback') {
          response = await handleGoogleCallback(request, env);
        } else if (action === 'health') {
          response = await handleHealthCheck(request, env);
        } else {
          throw new Error(`Unknown auth action: ${action}`);
        }
        break;
      
      default:
        throw new Error(`Method ${method} not allowed`);
    }

    // responseがすでにResponseオブジェクトの場合はそのまま返す
    if (response instanceof Response) {
      return response;
    }
    
    // そうでない場合はJSONレスポンスとして返す
    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });

  } catch (error) {
    console.error('Auth Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });
  }
}

// Magic Link送信処理（JSONオブジェクトを返す）
async function handleSendMagicLink(request, env) {
  const { email } = await request.json();
  
  console.log('🔍 Magic Link送信開始:', { email });
  
  if (!email) {
    throw new Error('Email is required');
  }

  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  
  try {
    console.log('🔍 認証トークン生成開始');
    // 認証トークンを生成（許可チェック含む）
    const authToken = await createAuthToken(email, request, env);
    console.log('✅ 認証トークン生成完了:', { tokenLength: authToken.token.length });
    
    // Magic Linkを生成
    const magicLink = `${env.FRONTEND_URL}/MindFlow/?token=${authToken.token}&type=magic-link`;
    
    console.log('🔍 メール送信開始');
    // メール送信
    const emailResult = await sendMagicLinkEmail(email, magicLink, env);
    console.log('✅ メール送信完了:', { messageId: emailResult.messageId });
    
    console.log('🔍 期限切れトークンクリーンアップ開始');
    // 期限切れトークンのクリーンアップ
    await cleanupExpiredTokens(env);
    console.log('✅ クリーンアップ完了');
    
    // メッセージを送信結果に応じて調整
    let message;
    if (emailResult.messageId === 'dev-mode' || emailResult.messageId === 'fallback-mode') {
      message = 'Magic Linkを生成しました\n本番環境ではメールが送信されますが、\n現在はテスト環境のためリンクを直接表示しています。';
    } else {
      message = `${email}にログインリンクを送信しました。\nメールを確認してログインしてください。`;
    }
    
    const response = {
      success: true,
      message: message,
      expiresIn: 600, // 10分
      emailSent: emailResult.messageId !== 'dev-mode' && emailResult.messageId !== 'fallback-mode'
    };
    
    // メール送信に失敗した場合のみ Magic Link を返す
    if (!response.emailSent) {
      response.magicLink = magicLink;
    }
    
    return response;
  } catch (error) {
    // 許可されていないメールアドレスの場合
    if (error.message.includes('Access denied')) {
      const registrationError = new Error('このメールアドレスは登録されていません。\nアクセスには事前の承認が必要です。');
      registrationError.status = 403;
      throw registrationError;
    }
    throw error;
  }
}

// Magic Link検証処理
async function handleVerifyMagicLink(request, env) {
  const url = new URL(request.url);
  let token;
  
  console.log('🔍 Magic Link検証開始:', { 
    method: request.method, 
    url: request.url.replace(/token=[^&]+/, 'token=***') 
  });
  
  if (request.method === 'GET') {
    token = url.searchParams.get('token');
  } else {
    const body = await request.json();
    token = body.token;
  }
  
  console.log('🔍 Token抽出:', { 
    hasToken: !!token, 
    tokenStart: token?.substring(0, 10) + '...' 
  });
  
  if (!token) {
    console.error('❌ Token不足');
    throw new Error('Authentication token is required');
  }
  
  try {
    console.log('🔍 Token検証開始 - バックエンド');
    const result = await verifyAuthToken(token, env);
    console.log('✅ Token検証成功:', { 
      success: result.success,
      hasToken: !!result.token,
      hasUser: !!result.user,
      userEmail: result.user?.email
    });
    
    // JSONレスポンスとして返す（修正: Response オブジェクトを作成）
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.CORS_ORIGIN)
      }
    });
  } catch (error) {
    console.error('❌ Magic Link検証エラー:', error);
    throw error;
  }
}


// トークン更新処理
async function handleRefreshToken(request, env) {
  const { token } = await request.json();
  
  if (!token) {
    throw new Error('Refresh token is required');
  }
  
  const verification = await verifyJWT(token);
  if (!verification.valid) {
    const error = new Error('Invalid refresh token');
    error.status = 401;
    throw error;
  }
  
  // 新しいトークンを生成
  const newToken = await generateJWT({
    userId: verification.payload.userId,
    email: verification.payload.email,
    iat: Math.floor(Date.now() / 1000)
  });
  
  return {
    success: true,
    token: newToken
  };
}

// 現在のユーザー情報取得
async function handleGetCurrentUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Authorization header required');
    error.status = 401;
    throw error;
  }
  
  const token = authHeader.substring(7);
  const verification = await verifyJWT(token);
  
  if (!verification.valid) {
    const error = new Error('Invalid token');
    error.status = 401;
    throw error;
  }
  
  const userId = verification.payload.userId;
  const { results } = await env.DB.prepare(
    'SELECT id, created_at FROM users WHERE id = ?'
  ).bind(userId).all();
  
  if (results.length === 0) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  
  return {
    user: {
      id: results[0].id,
      email: results[0].id, // id = email in new schema
      created_at: results[0].created_at
    }
  };
}

// Google OAuth認証（OAuth2フロー開始）
async function handleGoogleAuth(request, env) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = `${env.API_BASE_URL}/api/auth/google-callback`;
  
  if (!clientId) {
    throw new Error('Google OAuth not configured');
  }
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  
  return {
    authUrl
  };
}

// Google OAuth コールバック処理
async function handleGoogleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  
  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }
  
  if (!code) {
    throw new Error('Authorization code not provided');
  }
  
  // アクセストークンを取得
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${env.API_BASE_URL}/api/auth/google-callback`
    })
  });
  
  const tokenData = await tokenResponse.json();
  
  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${tokenData.error_description}`);
  }
  
  // ユーザー情報を取得
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`
    }
  });
  
  const userData = await userResponse.json();
  
  if (!userResponse.ok) {
    throw new Error('Failed to fetch user data');
  }
  
  // 許可されたメールアドレスかチェック
  const allowedEmails = env.ALLOWED_EMAILS ? env.ALLOWED_EMAILS.split(',').map(e => e.trim()) : [];
  if (allowedEmails.length > 0 && !allowedEmails.includes(userData.email)) {
    const error = new Error('Access denied: Email not authorized');
    error.status = 403;
    throw error;
  }
  
  // ユーザーをデータベースに保存/更新（メールアドレスをそのまま使用）
  const userId = userData.email;
  const now = new Date().toISOString();
  
  const { results } = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(userData.email).all();
  
  if (results.length === 0) {
    await env.DB.prepare(
      'INSERT INTO users (id, created_at, updated_at) VALUES (?, ?, ?)'
    ).bind(userId, now, now).run();
  }
  
  // JWTトークンを生成
  const authResult = await authenticateUser(userData.email);
  
  // フロントエンドにリダイレクト（トークンを含む）
  const redirectUrl = `${env.FRONTEND_URL}/auth-callback?token=${authResult.token}`;
  
  return Response.redirect(redirectUrl, 302);
}

// 健全性チェック
async function handleHealthCheck(request, env) {
  try {
    // データベース接続をテスト
    const testQuery = await env.DB.prepare('SELECT 1 as test').first();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: testQuery ? 'connected' : 'disconnected'
    };
  } catch (error) {
    console.error('Health check failed:', error);
    const errorResponse = new Error('Health check failed');
    errorResponse.status = 503;
    throw errorResponse;
  }
}

