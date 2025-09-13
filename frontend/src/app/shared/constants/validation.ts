/**
 * バリデーション関連の定数
 */
export const VALIDATION = {
  // テキスト長
  MIN_TEXT_LENGTH: 1,
  MAX_TEXT_LENGTH: 500,
  
  // ファイル名
  MAX_FILENAME_LENGTH: 255,
  
  // 正規表現
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL_REGEX: /^https?:\/\/.+/,
  
  // 許可ファイル形式
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  ALLOWED_FILE_TYPES: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'text/plain', 'application/pdf', 'application/json'
  ],
};