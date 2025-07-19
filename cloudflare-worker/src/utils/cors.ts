import type { Environment } from '@/types';

/**
 * セキュアなCORS設定
 * - オリジンの厳密なチェック
 * - 適切なヘッダー設定
 * - セキュリティヘッダーの追加
 */

export interface CORSConfig {
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
  maxAge: number;
}

/**
 * デフォルトのCORS設定
 */
const DEFAULT_CORS_CONFIG: CORSConfig = {
  origins: [], // 実行時に環境変数から設定
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: [
    'Content-Type',
    'Authorization',
    'X-User-ID',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  credentials: true,
  maxAge: 86400, // 24時間
};

/**
 * 許可されたオリジンかチェック
 */
function isAllowedOrigin(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  // 正確なマッチのみ許可（ワイルドカードは使用しない）
  return allowedOrigins.some(allowed => {
    // プロトコルを含む完全なURLでマッチ
    return origin === allowed;
  });
}

/**
 * CORSヘッダーを生成
 */
export function corsHeaders(env: Environment, requestOrigin: string | null): HeadersInit {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  const config = { ...DEFAULT_CORS_CONFIG, origins: allowedOrigins };

  const headers: HeadersInit = {};

  // Origin の検証と設定
  if (requestOrigin && isAllowedOrigin(requestOrigin, config.origins)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  } else {
    // 許可されていないオリジンの場合、明示的に拒否
    headers['Access-Control-Allow-Origin'] = 'null';
  }

  // その他のCORSヘッダー
  headers['Access-Control-Allow-Methods'] = config.methods.join(', ');
  headers['Access-Control-Allow-Headers'] = config.headers.join(', ');
  headers['Access-Control-Max-Age'] = config.maxAge.toString();

  // 認証情報を含むリクエストを許可（許可されたオリジンのみ）
  if (isAllowedOrigin(requestOrigin, config.origins)) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  // セキュリティヘッダーを追加
  headers['X-Content-Type-Options'] = 'nosniff';
  headers['X-Frame-Options'] = 'DENY';
  headers['X-XSS-Protection'] = '1; mode=block';
  headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
  headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none';";

  return headers;
}

/**
 * プリフライトリクエストを処理
 */
export function handlePreflight(env: Environment, request: Request): Response {
  const origin = request.headers.get('Origin');
  const method = request.headers.get('Access-Control-Request-Method');
  const requestHeaders = request.headers.get('Access-Control-Request-Headers');

  const allowedOrigins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  const config = { ...DEFAULT_CORS_CONFIG, origins: allowedOrigins };

  // オリジンチェック
  if (!isAllowedOrigin(origin, config.origins)) {
    return new Response('CORS policy violation', { 
      status: 403,
      headers: corsHeaders(env, origin),
    });
  }

  // メソッドチェック
  if (method && !config.methods.includes(method)) {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders(env, origin),
    });
  }

  // ヘッダーチェック
  if (requestHeaders) {
    const headers = requestHeaders.split(',').map(h => h.trim().toLowerCase());
    const allowedHeadersLower = config.headers.map(h => h.toLowerCase());
    
    const hasDisallowedHeaders = headers.some(header => 
      !allowedHeadersLower.includes(header)
    );
    
    if (hasDisallowedHeaders) {
      return new Response('Headers not allowed', { 
        status: 400,
        headers: corsHeaders(env, origin),
      });
    }
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(env, origin),
  });
}

/**
 * レスポンスにCORSヘッダーを追加
 */
export function addCORSHeaders(
  response: Response, 
  env: Environment, 
  requestOrigin: string | null
): Response {
  const headers = new Headers(response.headers);
  const corsHeadersObj = corsHeaders(env, requestOrigin);

  Object.entries(corsHeadersObj).forEach(([key, value]) => {
    if (typeof value === 'string') {
      headers.set(key, value);
    }
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * セキュアなレスポンスヘッダーを生成
 */
export function securityHeaders(): HeadersInit {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}