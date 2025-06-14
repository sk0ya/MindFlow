// JWT認証ユーティリティ

import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
const JWT_ALGORITHM = 'HS256';

// JWTトークンを生成
export async function generateJWT(payload, expiresIn = '24h') {
  const secret = new TextEncoder().encode(JWT_SECRET);
  
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
    
  return jwt;
}

// JWTトークンを検証
export async function verifyJWT(token) {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// リクエストからJWTトークンを抽出
export function extractTokenFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// 認証ミドルウェア
export async function requireAuth(request) {
  const token = extractTokenFromRequest(request);
  
  if (!token) {
    return { 
      authenticated: false, 
      error: 'Authorization token required',
      status: 401 
    };
  }
  
  const verification = await verifyJWT(token);
  
  if (!verification.valid) {
    return { 
      authenticated: false, 
      error: 'Invalid or expired token',
      status: 401 
    };
  }
  
  return { 
    authenticated: true, 
    user: verification.payload 
  };
}

// 簡易ユーザー登録/ログイン（本番では外部認証プロバイダーを推奨）
export async function authenticateUser(email, password = null) {
  // 簡易実装: メールアドレスベースの認証
  // 本番環境では適切なパスワードハッシュ化と検証を実装
  
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address required');
  }
  
  // ユーザーIDを生成（メールアドレスのハッシュ）
  const userId = await hashString(email);
  
  const payload = {
    userId,
    email,
    iat: Math.floor(Date.now() / 1000)
  };
  
  const token = await generateJWT(payload);
  
  return {
    token,
    user: payload
  };
}

// 文字列のハッシュ化（ユーザーID生成用）
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// 環境変数からJWTシークレットを取得（本番環境用）
export function getJWTSecret(env) {
  return env.JWT_SECRET || JWT_SECRET;
}