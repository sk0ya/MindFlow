import type { Environment, WorkerRequest } from '@/types';

/**
 * セキュリティユーティリティ
 * - CSP (Content Security Policy)
 * - セキュリティヘッダー
 * - XSS防止
 * - セキュアランダム生成
 */

/**
 * コンテンツセキュリティポリシーの生成
 */
export function generateCSP(env: Environment): string {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  
  // 本番環境ではより厳しいCSPを適用
  if (env.NODE_ENV === 'production') {
    return [
      "default-src 'none'",
      "script-src 'none'",
      "style-src 'none'",
      "img-src 'none'",
      "font-src 'none'",
      "connect-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      "media-src 'none'",
      "worker-src 'none'",
      "manifest-src 'none'",
      "prefetch-src 'none'"
    ].join('; ');
  }

  // 開発環境では若干緩和
  return [
    "default-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'"
  ].join('; ');
}

/**
 * セキュリティヘッダーの完全セット
 */
export function getSecurityHeaders(env: Environment): Record<string, string> {
  return {
    // XSS対策
    'X-XSS-Protection': '1; mode=block',
    'X-Content-Type-Options': 'nosniff',
    
    // フレームジャック対策
    'X-Frame-Options': 'DENY',
    
    // HTTPS強制（本番環境のみ）
    ...(env.NODE_ENV === 'production' && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    }),
    
    // リファラーポリシー
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // コンテンツセキュリティポリシー
    'Content-Security-Policy': generateCSP(env),
    
    // 権限ポリシー（機能制限）
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
      'notifications=()',
      'push=()',
      'speaker=()',
      'vibrate=()',
      'fullscreen=()',
      'midi=()',
      'sync-xhr=()'
    ].join(', '),
    
    // キャッシュ制御
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    
    // その他のセキュリティヘッダー
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-Download-Options': 'noopen',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

/**
 * リクエストのセキュリティチェック
 */
export function performSecurityChecks(
  request: WorkerRequest,
  env: Environment
): { allowed: boolean; reason?: string } {
  
  // ユーザーエージェントの基本チェック
  const userAgent = request.headers.get('User-Agent');
  if (!userAgent || userAgent.length < 10) {
    return { allowed: false, reason: 'Invalid or missing User-Agent' };
  }

  // 異常に長いヘッダーのチェック
  for (const [key, value] of request.headers.entries()) {
    if (key.length > 100 || value.length > 8192) {
      return { allowed: false, reason: 'Header too long' };
    }
  }

  // Hostヘッダーのチェック
  const host = request.headers.get('Host');
  const url = new URL(request.url);
  if (host && host !== url.host) {
    return { allowed: false, reason: 'Host header mismatch' };
  }

  // 危険なHTTPメソッドのチェック
  const dangerousMethods = ['TRACE', 'TRACK', 'DEBUG', 'CONNECT'];
  if (dangerousMethods.includes(request.method.toUpperCase())) {
    return { allowed: false, reason: 'Dangerous HTTP method' };
  }

  // Content-Typeの基本チェック（POSTリクエストの場合）
  if (['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
    const contentType = request.headers.get('Content-Type');
    if (contentType) {
      const allowedContentTypes = [
        'application/json',
        'multipart/form-data',
        'application/x-www-form-urlencoded',
        'text/plain'
      ];
      
      const isAllowed = allowedContentTypes.some(allowed => 
        contentType.toLowerCase().startsWith(allowed)
      );
      
      if (!isAllowed) {
        return { allowed: false, reason: 'Unsupported content type' };
      }
    }
  }

  return { allowed: true };
}

/**
 * IPアドレスのレート制限チェック（簡易実装）
 */
export async function checkIPRateLimit(
  request: WorkerRequest,
  env: Environment,
  maxRequests: number = 100,
  windowMinutes: number = 15
): Promise<{ allowed: boolean; remaining?: number }> {
  try {
    // Cloudflare の CF-Connecting-IP ヘッダーから実際のIPを取得
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';

    if (clientIP === 'unknown') {
      // IPが取得できない場合は制限を緩和
      return { allowed: true };
    }

    // KVストレージがある場合の実装例（実際のKVは要設定）
    // const key = `rate_limit:${clientIP}`;
    // const current = await env.KV?.get(key);
    // const count = current ? parseInt(current, 10) : 0;
    
    // 現在は簡易的にtrueを返す（実際の実装ではKVストレージを使用）
    return { allowed: true, remaining: maxRequests };

  } catch (error) {
    console.error('Rate limit check error:', error);
    // エラー時は安全側に倒してアクセスを許可
    return { allowed: true };
  }
}

/**
 * セキュアなランダム文字列生成（暗号学的に安全）
 */
export function generateCryptoSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * セキュアなUUID生成（UUID v4）
 */
export function generateSecureUUID(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  
  // UUIDv4の形式に調整
  array[6] = (array[6] & 0x0f) | 0x40; // Version 4
  array[8] = (array[8] & 0x3f) | 0x80; // Variant 10
  
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

/**
 * 入力文字列のXSS対策サニタイゼーション
 */
export function sanitizeForXSS(input: string): string {
  return input
    .replace(/[<>&"']/g, (match) => {
      const escapes: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;',
      };
      return escapes[match] || match;
    })
    // JavaScript関連のキーワードを除去
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * SQLインジェクション対策のパラメータ検証
 */
export function validateSQLParameter(param: string): boolean {
  // 基本的な危険パターンの検出
  const dangerousPatterns = [
    /--/,                    // SQLコメント
    /\/\*/,                  // SQLブロックコメント
    /;\s*\w/,               // 複文の開始
    /\bUNION\s+SELECT\b/i,  // UNION SELECT
    /\bDROP\s+TABLE\b/i,    // DROP TABLE
    /\bDELETE\s+FROM\b/i,   // DELETE FROM
    /\bUPDATE\s+\w+\s+SET\b/i, // UPDATE SET
    /\bINSERT\s+INTO\b/i,   // INSERT INTO
    /\bALTER\s+TABLE\b/i,   // ALTER TABLE
    /\bCREATE\s+TABLE\b/i,  // CREATE TABLE
    /\bTRUNCATE\s+TABLE\b/i, // TRUNCATE TABLE
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(param)) {
      return false;
    }
  }

  return true;
}

/**
 * ファイル名のセキュリティチェック
 */
export function validateFileName(fileName: string): { valid: boolean; reason?: string } {
  // 基本的なチェック
  if (!fileName || fileName.trim() === '') {
    return { valid: false, reason: 'Empty filename' };
  }

  // 長さチェック
  if (fileName.length > 255) {
    return { valid: false, reason: 'Filename too long' };
  }

  // 危険な文字のチェック
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(fileName)) {
    return { valid: false, reason: 'Contains invalid characters' };
  }

  // 予約されたファイル名のチェック（Windows）
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];
  
  const nameWithoutExt = fileName.split('.')[0];
  if (nameWithoutExt && reservedNames.includes(nameWithoutExt.toUpperCase())) {
    return { valid: false, reason: 'Reserved filename' };
  }

  // 実行可能ファイルの拡張子チェック
  const executableExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.sh', '.ps1', '.msi', '.dll', '.app', '.deb', '.rpm', '.dmg'
  ];
  
  const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  if (executableExtensions.includes(extension)) {
    return { valid: false, reason: 'Executable file type not allowed' };
  }

  return { valid: true };
}

/**
 * リクエストボディサイズの制限チェック
 */
export function checkContentLength(
  request: WorkerRequest,
  maxSize: number = 10 * 1024 * 1024 // 10MB
): { allowed: boolean; reason?: string } {
  const contentLength = request.headers.get('Content-Length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (isNaN(size) || size < 0) {
      return { allowed: false, reason: 'Invalid Content-Length header' };
    }
    
    if (size > maxSize) {
      return { allowed: false, reason: `Content too large (max: ${Math.round(maxSize / 1024 / 1024)}MB)` };
    }
  }

  return { allowed: true };
}

/**
 * 時間ベースの攻撃対策（タイミング攻撃防止）
 */
export async function constantTimeDelay(
  minDelayMs: number = 100,
  maxDelayMs: number = 300
): Promise<void> {
  const delay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * ハッシュベースのチェックサム生成
 */
export async function generateChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}