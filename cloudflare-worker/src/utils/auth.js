// JWT認証ユーティリティ

// import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
const JWT_ALGORITHM = 'HS256';

// JWTトークンを生成（簡易実装）
export async function generateJWT(payload, expiresIn = '24h') {
  // 簡易的な実装（本番環境では proper JWTライブラリを使用）
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (24 * 60 * 60); // 24時間後
  
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: exp
  };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(jwtPayload));
  const signature = await simpleSign(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// JWTトークンを検証（簡易実装）
export async function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }
    
    const [header, payload, signature] = parts;
    const expectedSignature = await simpleSign(`${header}.${payload}`, JWT_SECRET);
    
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    const decodedPayload = JSON.parse(atob(payload));
    
    // 有効期限チェック
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token expired' };
    }
    
    return { valid: true, payload: decodedPayload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// 簡易署名関数
async function simpleSign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
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
  
  // ユーザーIDを生成（メールアドレスをそのまま使用して同期を確実に）
  const userId = email;
  
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