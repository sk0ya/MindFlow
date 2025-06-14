// 認証エンドポイントのハンドラー

import { corsHeaders } from '../utils/cors.js';
import { authenticateUser, generateJWT, verifyJWT } from '../utils/auth.js';

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
          response = await handleLogin(request, env);
        } else if (action === 'register') {
          response = await handleRegister(request, env);
        } else if (action === 'refresh') {
          response = await handleRefreshToken(request, env);
        } else {
          throw new Error(`Unknown auth action: ${action}`);
        }
        break;
      
      case 'GET':
        if (action === 'me') {
          response = await handleGetCurrentUser(request, env);
        } else if (action === 'google') {
          response = await handleGoogleAuth(request, env);
        } else if (action === 'google-callback') {
          response = await handleGoogleCallback(request, env);
        } else {
          throw new Error(`Unknown auth action: ${action}`);
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

// ログイン処理
async function handleLogin(request, env) {
  const { email, password } = await request.json();
  
  if (!email) {
    throw new Error('Email is required');
  }
  
  // データベースからユーザーを検索
  const { results } = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).all();
  
  let user;
  if (results.length === 0) {
    // ユーザーが存在しない場合は自動作成（簡易実装）
    const userId = await hashString(email);
    const now = new Date().toISOString();
    
    await env.DB.prepare(
      'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(userId, email, now, now).run();
    
    user = { id: userId, email, created_at: now };
  } else {
    user = results[0];
  }
  
  // JWTトークンを生成
  const authResult = await authenticateUser(email);
  
  return {
    success: true,
    token: authResult.token,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    }
  };
}

// ユーザー登録処理
async function handleRegister(request, env) {
  // 現在の実装ではログインと同じ処理
  return await handleLogin(request, env);
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
    'SELECT id, email, created_at FROM users WHERE id = ?'
  ).bind(userId).all();
  
  if (results.length === 0) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  
  return {
    user: results[0]
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
  
  // ユーザーをデータベースに保存/更新
  const userId = await hashString(userData.email);
  const now = new Date().toISOString();
  
  const { results } = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(userData.email).all();
  
  if (results.length === 0) {
    await env.DB.prepare(
      'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(userId, userData.email, now, now).run();
  }
  
  // JWTトークンを生成
  const authResult = await authenticateUser(userData.email);
  
  // フロントエンドにリダイレクト（トークンを含む）
  const redirectUrl = `${env.FRONTEND_URL}/auth-callback?token=${authResult.token}`;
  
  return Response.redirect(redirectUrl, 302);
}

// 文字列のハッシュ化（ユーザーID生成用）
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}