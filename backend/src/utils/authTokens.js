// Magic Link認証トークン管理

import { generateJWT } from './auth.js';
import { createPersistentSession, extractDeviceInfo } from './deviceSecurity.js';

// 認証トークンを生成してデータベースに保存
export async function createAuthToken(email, request, env) {
  console.log('🔍 createAuthToken開始:', { email });
  
  // 許可されたメールアドレスかチェック
  const allowedEmails = env.ALLOWED_EMAILS ? env.ALLOWED_EMAILS.split(',').map(e => e.trim()) : [];
  if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
    throw new Error('Access denied: Email not authorized');
  }

  console.log('🔍 既存トークン無効化開始');
  // 既存の未使用トークンを無効化
  await invalidateExistingTokens(email, env);
  console.log('✅ 既存トークン無効化完了');

  // 新しいトークンを生成
  const tokenId = generateRandomToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分後
  
  // リクエスト情報を取得
  const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  console.log('🔍 データベース保存開始:', { tokenId: tokenId.substring(0, 8) + '...', email });
  // データベースに保存
  await env.DB.prepare(`
    INSERT INTO auth_tokens (id, user_id, expires_at, used_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    tokenId,
    email,
    expiresAt.toISOString(),
    null,
    new Date().toISOString()
  ).run();
  console.log('✅ データベース保存完了');

  return {
    tokenId,
    token: tokenId,
    expiresAt
  };
}

// トークンを検証して使用済みにマーク（新しいセッション管理対応）
export async function verifyAuthToken(token, request, env) {
  console.log('🔍 Token検証開始:', { token: token.substring(0, 10) + '...' });
  
  // デバイス情報を抽出
  const deviceInfo = extractDeviceInfo(request);
  
  // リクエストボディからクライアントフィンガープリントを取得（存在する場合）
  let clientFingerprint = null;
  try {
    const body = await request.clone().json();
    clientFingerprint = body.deviceFingerprint;
  } catch (e) {
    // JSONでない場合はスキップ
  }
  
  // まず、トークンがDBに存在するかチェック
  const { results: allTokens } = await env.DB.prepare(`
    SELECT *, 
           datetime('now') as current_time,
           (expires_at > datetime('now')) as is_valid_time,
           (used_at IS NULL) as is_unused
    FROM auth_tokens 
    WHERE id = ?
  `).bind(token).all();

  console.log('🔍 Token検索結果:', {
    found: allTokens.length > 0,
    tokenData: allTokens[0] ? {
      exists: true,
      expires_at: allTokens[0].expires_at,
      current_time: allTokens[0].current_time,
      is_valid_time: allTokens[0].is_valid_time,
      is_unused: allTokens[0].is_unused,
      used_at: allTokens[0].used_at
    } : 'Token not found'
  });

  const { results } = await env.DB.prepare(`
    SELECT * FROM auth_tokens 
    WHERE id = ? AND expires_at > datetime('now') AND used_at IS NULL
  `).bind(token).all();

  if (results.length === 0) {
    const errorMsg = allTokens.length === 0 
      ? 'Authentication token not found' 
      : allTokens[0].is_valid_time 
        ? 'Authentication token already used'
        : 'Authentication token expired';
    console.error('❌ Token検証失敗:', errorMsg);
    throw new Error(errorMsg);
  }

  const authToken = results[0];
  
  // トークンを使用済みにマーク
  await env.DB.prepare(`
    UPDATE auth_tokens 
    SET used_at = datetime('now') 
    WHERE id = ?
  `).bind(authToken.id).run();

  // ユーザーを取得または作成
  const user = await getOrCreateUser(authToken.user_id, env);
  
  // 永続セッションを作成
  const sessionResult = await createPersistentSession(
    authToken.user_id, 
    deviceInfo, 
    clientFingerprint, 
    env
  );
  
  console.log('🔐 セッション作成結果:', {
    sessionId: sessionResult.sessionId,
    isNewSession: sessionResult.isNewSession
  });

  return {
    success: true,
    token: sessionResult.token,
    sessionId: sessionResult.sessionId,
    expiresAt: sessionResult.expiresAt,
    user: {
      id: user.id,
      email: user.id,
      created_at: user.created_at
    }
  };
}

// ユーザーの既存トークンを無効化
async function invalidateExistingTokens(email, env) {
  console.log('🔍 SQL実行: 既存トークン無効化:', { email });
  await env.DB.prepare(`
    UPDATE auth_tokens 
    SET used_at = datetime('now') 
    WHERE user_id = ? AND used_at IS NULL
  `).bind(email).run();
  console.log('✅ SQL完了: 既存トークン無効化');
}

// ユーザーを取得または作成
async function getOrCreateUser(email, env) {
  // 既存ユーザーを検索
  const { results } = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(email).all();

  if (results.length > 0) {
    return results[0];
  }

  // 新規ユーザーを作成
  const userId = email;
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO users (id, created_at, updated_at) VALUES (?, ?, ?)'
  ).bind(userId, now, now).run();

  return { id: userId, created_at: now };
}

// 期限切れトークンをクリーンアップ
export async function cleanupExpiredTokens(env) {
  console.log('🔍 SQL実行: 期限切れトークンクリーンアップ');
  const result = await env.DB.prepare(`
    DELETE FROM auth_tokens 
    WHERE expires_at < datetime('now')
  `).run();
  console.log('✅ SQL完了: クリーンアップ', { deleted: result.changes || 0 });
  
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