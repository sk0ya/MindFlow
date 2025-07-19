import { SignJWT, jwtVerify } from 'jose';
import type { 
  Environment, 
  WorkerRequest, 
  AuthResult, 
  JWTPayload, 
  AuthToken,
  User,
} from '@/types';
import { AuthenticationError, AuthorizationError } from '@/types';

/**
 * セキュアなJWT認証ユーティリティ
 * - 本格的なJOSEライブラリを使用
 * - 強力なセキュリティ設定
 * - 適切なエラーハンドリング
 */

const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRY_TIME = '1h'; // 1時間（セキュリティのため短縮）
const REFRESH_TOKEN_EXPIRY = '7d'; // 7日間

/**
 * JWTシークレットキーを取得
 */
function getJWTSecret(env: Environment): Uint8Array {
  const secret = env.JWT_SECRET;
  if (!secret || secret === 'your-super-secret-jwt-key-change-this-in-production') {
    throw new Error('JWT_SECRET must be set to a secure value in production');
  }
  
  // 最低限の長さチェック
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  return new TextEncoder().encode(secret);
}

/**
 * JWT アクセストークンを生成
 */
export async function generateAccessToken(
  userId: string, 
  email: string, 
  env: Environment
): Promise<string> {
  const secret = getJWTSecret(env);
  
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId,
    email,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY_TIME)
    .setIssuer(env.API_BASE_URL)
    .setAudience(env.FRONTEND_URL)
    .sign(secret);
}

/**
 * JWT トークンを検証
 */
export async function verifyJWTToken(
  token: string, 
  env: Environment
): Promise<JWTPayload> {
  try {
    const secret = getJWTSecret(env);
    
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.API_BASE_URL,
      audience: env.FRONTEND_URL,
      algorithms: [JWT_ALGORITHM],
    });

    // ペイロードの型安全性を確保
    if (
      typeof payload['userId'] !== 'string' ||
      typeof payload['email'] !== 'string' ||
      typeof payload['iat'] !== 'number' ||
      typeof payload['exp'] !== 'number'
    ) {
      throw new Error('Invalid JWT payload structure');
    }

    return payload as JWTPayload;
  } catch (error) {
    if (error instanceof Error) {
      // より具体的なエラーメッセージ
      if (error.message.includes('expired')) {
        throw new AuthenticationError('Token has expired');
      }
      if (error.message.includes('signature')) {
        throw new AuthenticationError('Invalid token signature');
      }
    }
    throw new AuthenticationError('Invalid or malformed token');
  }
}

/**
 * リクエストから認証情報を抽出・検証
 */
export async function requireAuth(
  request: WorkerRequest,
  env: Environment
): Promise<AuthResult> {
  try {
    // Authorization ヘッダーから Bearer トークンを取得
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        authenticated: false,
        error: 'Authorization header missing or invalid format',
        status: 401,
      };
    }

    const token = authHeader.substring(7); // "Bearer " を除去
    if (!token) {
      return {
        authenticated: false,
        error: 'Token is empty',
        status: 401,
      };
    }

    // JWT トークンを検証
    const payload = await verifyJWTToken(token, env);
    
    // ユーザーがアクセス許可されているかチェック
    const allowedEmails = env.ALLOWED_EMAILS.split(',').map(email => email.trim());
    if (!allowedEmails.includes(payload.email)) {
      return {
        authenticated: false,
        error: 'Access not authorized for this email',
        status: 403,
      };
    }

    return {
      authenticated: true,
      user: {
        userId: payload.userId,
        email: payload.email,
      },
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        authenticated: false,
        error: error.message,
        status: error.status,
      };
    }
    
    // 予期しないエラー
    console.error('Authentication error:', error);
    return {
      authenticated: false,
      error: 'Authentication failed',
      status: 500,
    };
  }
}

/**
 * Magic Link トークンを生成（セキュア）
 */
export function generateMagicLinkToken(): string {
  // 256ビット（32バイト）のランダムトークン
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Magic Link トークンをデータベースに保存
 */
export async function storeMagicLinkToken(
  db: D1Database,
  userId: string,
  token: string,
  expiryMinutes: number = 10
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
  
  try {
    await db.prepare(`
      INSERT INTO auth_tokens (id, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(token, userId, expiresAt, new Date().toISOString()).run();
  } catch (error) {
    console.error('Failed to store magic link token:', error);
    throw new Error('Failed to create authentication token');
  }
}

/**
 * Magic Link トークンを検証・使用
 */
export async function verifyAndConsumeMagicLinkToken(
  db: D1Database,
  token: string
): Promise<AuthToken | null> {
  try {
    // トークンを取得
    const authToken = await db.prepare(`
      SELECT * FROM auth_tokens 
      WHERE id = ? AND used_at IS NULL AND expires_at > datetime('now')
    `).bind(token).first() as AuthToken | null;

    if (!authToken) {
      return null;
    }

    // トークンを使用済みとしてマーク
    await db.prepare(`
      UPDATE auth_tokens 
      SET used_at = datetime('now') 
      WHERE id = ?
    `).bind(token).run();

    return authToken;
  } catch (error) {
    console.error('Failed to verify magic link token:', error);
    return null;
  }
}

/**
 * 期限切れトークンのクリーンアップ
 */
export async function cleanupExpiredTokens(db: D1Database): Promise<void> {
  try {
    await db.prepare(`
      DELETE FROM auth_tokens 
      WHERE expires_at < datetime('now') OR used_at IS NOT NULL
    `).run();
  } catch (error) {
    console.error('Failed to cleanup expired tokens:', error);
  }
}

/**
 * ユーザーを取得または作成
 */
export async function getOrCreateUser(
  db: D1Database,
  email: string
): Promise<User> {
  try {
    // 既存ユーザーを検索
    let user = await db.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(email).first() as User | null;

    if (!user) {
      // 新規ユーザーを作成
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO users (id, created_at, updated_at)
        VALUES (?, ?, ?)
      `).bind(email, now, now).run();

      user = {
        id: email,
        created_at: now,
        updated_at: now,
      };
    }

    return user;
  } catch (error) {
    console.error('Failed to get or create user:', error);
    throw new Error('User management failed');
  }
}

/**
 * セキュアなランダム文字列生成
 */
export function generateSecureRandomString(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * レート制限チェック（簡易実装）
 */
export async function checkRateLimit(
  db: D1Database,
  identifier: string,
  maxAttempts: number = 5,
  windowMinutes: number = 15
): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    
    const { count } = await db.prepare(`
      SELECT COUNT(*) as count FROM auth_tokens 
      WHERE user_id = ? AND created_at > ?
    `).bind(identifier, windowStart).first() as { count: number };

    return count < maxAttempts;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // エラー時は安全側に倒してアクセスを許可
    return true;
  }
}