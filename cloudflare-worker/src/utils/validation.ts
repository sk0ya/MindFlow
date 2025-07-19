import { ZodError, type ZodSchema } from 'zod';
import { ValidationError } from '@/types';

/**
 * セキュアなバリデーションユーティリティ
 * - Zodスキーマを使用した型安全なバリデーション
 * - セキュリティ重視のエラーハンドリング
 * - 適切なエラーメッセージの生成
 */

/**
 * リクエストボディをバリデーション
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    // Content-Type チェック
    const contentType = request.headers.get('Content-Type');
    if (!contentType?.includes('application/json')) {
      throw new ValidationError('Content-Type must be application/json');
    }

    // JSONパース（サイズ制限付き）
    const body = await parseJSONSafely(request);
    
    // Zodによるバリデーション
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = formatZodErrors(error);
      throw new ValidationError('Request validation failed', details);
    }
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid request body format');
  }
}

/**
 * URLパラメータをバリデーション
 */
export function validatePathParams<T>(
  params: Record<string, string | undefined>,
  schema: ZodSchema<T>
): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = formatZodErrors(error);
      throw new ValidationError('Path parameters validation failed', details);
    }
    throw new ValidationError('Invalid path parameters');
  }
}

/**
 * クエリパラメータをバリデーション
 */
export function validateQueryParams<T>(
  url: URL,
  schema: ZodSchema<T>
): T {
  try {
    const params: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      params[key] = value;
    }
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = formatZodErrors(error);
      throw new ValidationError('Query parameters validation failed', details);
    }
    throw new ValidationError('Invalid query parameters');
  }
}

/**
 * ファイルのバリデーション
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): void {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = [],
    allowedExtensions = []
  } = options;

  // ファイルサイズチェック
  if (file.size > maxSize) {
    throw new ValidationError(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
  }

  // ファイルサイズが0でないかチェック
  if (file.size === 0) {
    throw new ValidationError('File cannot be empty');
  }

  // ファイル名チェック
  if (!file.name || file.name.trim() === '') {
    throw new ValidationError('File name is required');
  }

  // 危険なファイル名の文字をチェック
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(file.name)) {
    throw new ValidationError('File name contains invalid characters');
  }

  // ファイル名の長さチェック
  if (file.name.length > 255) {
    throw new ValidationError('File name is too long (max 255 characters)');
  }

  // MIMEタイプチェック
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    throw new ValidationError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  // 拡張子チェック
  if (allowedExtensions.length > 0) {
    const extension = getFileExtension(file.name);
    if (!extension || !allowedExtensions.includes(extension)) {
      throw new ValidationError(`File extension not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`);
    }
  }

  // 実行可能ファイルの検出
  const executableExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.sh', '.ps1', '.msi', '.dll', '.app', '.deb', '.rpm'
  ];
  const extension = getFileExtension(file.name);
  if (extension && executableExtensions.includes(extension)) {
    throw new ValidationError('Executable files are not allowed');
  }
}

/**
 * 安全なJSONパース（サイズ制限付き）
 */
async function parseJSONSafely(
  request: Request,
  maxSize: number = 1024 * 1024 // 1MB
): Promise<unknown> {
  try {
    // Content-Length チェック
    const contentLength = request.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      throw new ValidationError(`Request body too large (max ${Math.round(maxSize / 1024)}KB)`);
    }

    const text = await request.text();
    
    // テキストサイズチェック
    if (text.length > maxSize) {
      throw new ValidationError(`Request body too large (max ${Math.round(maxSize / 1024)}KB)`);
    }

    // 空のボディチェック
    if (!text.trim()) {
      throw new ValidationError('Request body cannot be empty');
    }

    return JSON.parse(text);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new ValidationError('Invalid JSON format');
    }
    throw new ValidationError('Failed to parse request body');
  }
}

/**
 * Zodエラーを分かりやすい形式に変換
 */
function formatZodErrors(error: ZodError): Record<string, unknown> {
  const errors: Record<string, string[]> = {};
  
  error.errors.forEach(err => {
    const path = err.path.join('.');
    const field = path || 'root';
    
    if (!errors[field]) {
      errors[field] = [];
    }
    errors[field].push(err.message);
  });

  return {
    validationErrors: errors,
    errorCount: error.errors.length,
  };
}

/**
 * ファイル拡張子を取得
 */
function getFileExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return null;
  }
  return filename.substring(lastDot).toLowerCase();
}

/**
 * メールアドレスの形式チェック
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
}

/**
 * セキュアなID生成（UUIDv4風）
 */
export function generateSecureId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  
  // UUIDv4の形式に合わせて調整
  array[6] = (array[6] & 0x0f) | 0x40; // Version 4
  array[8] = (array[8] & 0x3f) | 0x80; // Variant 10
  
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

/**
 * 文字列のサニタイゼーション
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // HTMLタグを除去
    .replace(/javascript:/gi, '') // javascript: URLを除去
    .replace(/data:/gi, '') // data: URLを除去
    .trim();
}

/**
 * SQLインジェクション対策のためのパラメータチェック
 */
export function validateSQLParam(param: unknown): string {
  if (typeof param !== 'string') {
    throw new ValidationError('SQL parameter must be a string');
  }
  
  // 基本的な危険なパターンをチェック
  const dangerousPatterns = [
    /--/,           // SQL コメント
    /\/\*/,         // SQL ブロックコメント
    /;/,            // ステートメント区切り
    /\bUNION\b/i,   // UNION クエリ
    /\bDROP\b/i,    // DROP文
    /\bDELETE\b/i,  // DELETE文（WHERE句なし）
    /\bUPDATE\b/i,  // UPDATE文（単体では危険）
    /\bINSERT\b/i,  // INSERT文（単体では危険）
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(param)) {
      throw new ValidationError('Parameter contains potentially dangerous content');
    }
  }

  return param;
}