/**
 * ファイル・ストレージ関連の定数
 */
export const STORAGE = {
  // ファイルサイズ制限 (bytes)
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOTAL_STORAGE: 100 * 1024 * 1024, // 100MB
  
  // 画像最適化
  IMAGE_MAX_WIDTH: 800,
  IMAGE_MAX_HEIGHT: 600,
  IMAGE_QUALITY: 0.8,
  
  // ストレージキー
  MAPS_KEY: 'mindflow_maps',
  SETTINGS_KEY: 'mindflow_settings',
  
  // 履歴管理
  MAX_HISTORY_SIZE: 50,
  AUTO_SAVE_INTERVAL: 5000, // 5秒
};