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

  // 新しいトークンを生成（新スキーマではid = token）
  const tokenId = generateRandomToken();  // tokenId自体がトークン
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分後
  
  // リクエスト情報を取得
  const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  // データベースに保存（互換性対応: token, email または user_id）
  try {
    // 新しいスキーマ（id, user_id）を試す
    await env.DB.prepare(`
      INSERT INTO auth_tokens (id, user_id, expires_at, used_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      tokenId,
      email,  // user_id = email
      expiresAt.toISOString(),
      null,
      new Date().toISOString()
    ).run();
  } catch (error) {
    // 古いスキーマ（token, email）にフォールバック
    console.log('新スキーマ失敗、古いスキーマを使用:', error.message);
    await env.DB.prepare(`
      INSERT INTO auth_tokens (token, email, expires_at, used_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      tokenId,
      email,
      expiresAt.getTime(),  // 古いスキーマはUNIXタイムスタンプ
      null,
      new Date().toISOString()
    ).run();
  }

  return {
    tokenId,
    token: tokenId,  // 新スキーマではid = token
    expiresAt
  };
}

// トークンを検証して使用済みにマーク（互換性対応）
export async function verifyAuthToken(token, env) {
  let authToken = null;
  let userEmail = null;

  try {
    // 新しいスキーマ（id, user_id）を試す
    const { results } = await env.DB.prepare(`
      SELECT * FROM auth_tokens 
      WHERE id = ? AND expires_at > datetime('now') AND used_at IS NULL
    `).bind(token).all();

    if (results.length > 0) {
      authToken = results[0];
      userEmail = authToken.user_id;
      
      // トークンを使用済みにマーク
      await env.DB.prepare(`
        UPDATE auth_tokens 
        SET used_at = datetime('now') 
        WHERE id = ?
      `).bind(authToken.id).run();
    }
  } catch (error) {
    console.log('新スキーマ失敗、古いスキーマを使用:', error.message);
  }

  // 新スキーマで見つからなかった場合、古いスキーマを試す
  if (!authToken) {
    try {
      const { results } = await env.DB.prepare(`
        SELECT * FROM auth_tokens 
        WHERE token = ? AND expires_at > ? AND used_at IS NULL
      `).bind(token, Date.now()).all();

      if (results.length > 0) {
        authToken = results[0];
        userEmail = authToken.email;
        
        // トークンを使用済みにマーク
        await env.DB.prepare(`
          UPDATE auth_tokens 
          SET used_at = ? 
          WHERE token = ?
        `).bind(Date.now(), authToken.token).run();
      }
    } catch (error) {
      console.log('古いスキーマも失敗:', error.message);
    }
  }

  if (!authToken) {
    throw new Error('Invalid or expired authentication token');
  }

  // ユーザーを取得または作成
  const user = await getOrCreateUser(userEmail, env);
  
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
      email: user.id,  // 新スキーマではid = email
      created_at: user.created_at
    }
  };
}

// ユーザーの既存トークンを無効化（互換性対応）
async function invalidateExistingTokens(email, env) {
  try {
    // 新しいスキーマを試す
    await env.DB.prepare(`
      UPDATE auth_tokens 
      SET used_at = datetime('now') 
      WHERE user_id = ? AND used_at IS NULL
    `).bind(email).run();
  } catch (error) {
    // 古いスキーマにフォールバック
    try {
      await env.DB.prepare(`
        UPDATE auth_tokens 
        SET used_at = ? 
        WHERE email = ? AND used_at IS NULL
      `).bind(Date.now(), email).run();
    } catch (oldError) {
      console.log('トークン無効化エラー:', oldError.message);
    }
  }
}

// ユーザーを取得または作成（新スキーマ対応）
async function getOrCreateUser(email, env) {
  // 既存ユーザーを検索（新スキーマではid = email）
  const { results } = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(email).all();

  if (results.length > 0) {
    return results[0];
  }

  // 新規ユーザーを作成（新スキーマ対応: id = email）
  const userId = email;
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO users (id, created_at, updated_at) VALUES (?, ?, ?)'
  ).bind(userId, now, now).run();

  return { id: userId, created_at: now };
}

// 期限切れトークンをクリーンアップ（互換性対応）
export async function cleanupExpiredTokens(env) {
  let changes = 0;
  
  try {
    // 新しいスキーマを試す
    const result = await env.DB.prepare(`
      DELETE FROM auth_tokens 
      WHERE expires_at < datetime('now')
    `).run();
    changes = result.changes || 0;
  } catch (error) {
    try {
      // 古いスキーマにフォールバック
      const result = await env.DB.prepare(`
        DELETE FROM auth_tokens 
        WHERE expires_at < ?
      `).bind(Date.now()).run();
      changes = result.changes || 0;
    } catch (oldError) {
      console.log('クリーンアップエラー:', oldError.message);
    }
  }

  return changes;
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