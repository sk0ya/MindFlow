// Magic Link認証トークン管理

import { generateJWT } from './auth.js';

// 認証トークンを生成してデータベースに保存
export async function createAuthToken(email, request, env) {
  // 許可されたメールアドレスかチェック
  const allowedEmails = env.ALLOWED_EMAILS ? env.ALLOWED_EMAILS.split(',').map(e => e.trim()) : [];
  if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
    throw new Error('Access denied: Email not authorized');
  }

  // 既存の未使用トークンを無効化
  await invalidateExistingTokens(email, env);

  // 新しいトークンを生成
  const tokenId = generateRandomId();
  const token = generateRandomToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分後
  
  // リクエスト情報を取得
  const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  // データベースに保存
  await env.DB.prepare(`
    INSERT INTO auth_tokens (id, email, token, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    tokenId,
    email,
    token,
    expiresAt.toISOString(),
    ipAddress,
    userAgent
  ).run();

  return {
    tokenId,
    token,
    expiresAt
  };
}

// トークンを検証して使用済みにマーク
export async function verifyAuthToken(token, env) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM auth_tokens 
    WHERE token = ? AND expires_at > datetime('now') AND used_at IS NULL
  `).bind(token).all();

  if (results.length === 0) {
    throw new Error('Invalid or expired authentication token');
  }

  const authToken = results[0];
  
  // トークンを使用済みにマーク
  await env.DB.prepare(`
    UPDATE auth_tokens 
    SET used_at = datetime('now') 
    WHERE id = ?
  `).bind(authToken.id).run();

  // ユーザーを取得または作成
  const user = await getOrCreateUser(authToken.email, env);
  
  // JWTトークンを生成
  const jwtToken = await generateJWT({
    userId: user.id,
    email: user.email,
    tokenId: authToken.id,
    iat: Math.floor(Date.now() / 1000)
  });

  return {
    success: true,
    token: jwtToken,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    }
  };
}

// ユーザーの既存トークンを無効化
async function invalidateExistingTokens(email, env) {
  await env.DB.prepare(`
    UPDATE auth_tokens 
    SET used_at = datetime('now') 
    WHERE email = ? AND used_at IS NULL
  `).bind(email).run();
}

// ユーザーを取得または作成
async function getOrCreateUser(email, env) {
  // 既存ユーザーを検索
  const { results } = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).all();

  if (results.length > 0) {
    return results[0];
  }

  // 新規ユーザーを作成
  const userId = await hashString(email);
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).bind(userId, email, now, now).run();

  return { id: userId, email, created_at: now };
}

// 期限切れトークンをクリーンアップ
export async function cleanupExpiredTokens(env) {
  const result = await env.DB.prepare(`
    DELETE FROM auth_tokens 
    WHERE expires_at < datetime('now')
  `).run();

  return result.changes || 0;
}

// ランダムなIDを生成
function generateRandomId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// セキュアなランダムトークンを生成
function generateRandomToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 文字列のハッシュ化（ユーザーID生成用）
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}