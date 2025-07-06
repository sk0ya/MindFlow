/**
 * MindFlowアプリケーション全体で使用する定数定義
 */

// ========================================
// 座標・位置関連
// ========================================
export const COORDINATES = {
  // デフォルトキャンバス中心
  DEFAULT_CENTER_X: 400,
  DEFAULT_CENTER_Y: 300,
  
  // ルートノードのデフォルト位置
  ROOT_NODE_X: 400,
  ROOT_NODE_Y: 300,
  
  // 子ノードの初期オフセット
  CHILD_OFFSET_X: 500,
  CHILD_OFFSET_Y: 350,
};

// ========================================
// レイアウト関連
// ========================================
export const LAYOUT = {
  // 放射状レイアウト
  RADIAL_BASE_RADIUS: 150,
  RADIAL_RADIUS_INCREMENT: 120,
  RADIAL_MIN_RADIUS: 100,
  
  // 階層レイアウト
  LEVEL_SPACING: 200,
  VERTICAL_SPACING_MIN: 80,
  VERTICAL_SPACING_MAX: 130,
  
  // ノード間隔
  NODE_PADDING: 50,
  NODE_MIN_DISTANCE: 100,
  
  // グリッド
  GRID_SIZE: 20,
  SNAP_THRESHOLD: 10,
};

// ========================================
// フォント・テキスト関連
// ========================================
export const TYPOGRAPHY = {
  // フォントサイズ
  DEFAULT_FONT_SIZE: 16,
  MIN_FONT_SIZE: 10,
  MAX_FONT_SIZE: 48,
  
  // フォントウェイト
  DEFAULT_FONT_WEIGHT: 'normal',
  BOLD_FONT_WEIGHT: 'bold',
  
  // テキスト制限
  MAX_TEXT_LENGTH: 500,
  MAX_TITLE_LENGTH: 100,
};

// ========================================
// ファイル・ストレージ関連
// ========================================
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

// ========================================
// UI・UX関連
// ========================================
export const UI = {
  // アニメーション時間
  ANIMATION_DURATION: 300,
  TRANSITION_DURATION: 200,
  
  // モーダル・パネル
  MODAL_Z_INDEX: 1000,
  PANEL_WIDTH: 300,
  SIDEBAR_WIDTH: 280,
  
  // ツールチップ・通知
  TOOLTIP_DELAY: 500,
  NOTIFICATION_DURATION: 3000,
  ERROR_NOTIFICATION_DURATION: 5000,
  
  // タッチ・マウス
  DOUBLE_CLICK_THRESHOLD: 300,
  LONG_PRESS_DURATION: 500,
  DRAG_THRESHOLD: 5,
};


// ========================================
// カラーパレット
// ========================================
export const COLORS = {
  // ノードカラー（既存から移行）
  NODE_COLORS: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
    '#00D2D3', '#FF9F43', '#EE5A24', '#0ABDE3'
  ],
  
  // システムカラー
  PRIMARY: '#007BFF',
  SECONDARY: '#6C757D',
  SUCCESS: '#28A745',
  WARNING: '#FFC107',
  ERROR: '#DC3545',
  INFO: '#17A2B8',
  
  // 背景・境界線
  BACKGROUND: '#FFFFFF',
  SURFACE: '#F8F9FA',
  BORDER: '#DEE2E6',
  TEXT: '#212529',
  MUTED: '#6C757D',
};

// ========================================
// パフォーマンス関連
// ========================================
export const PERFORMANCE = {
  // レンダリング
  MAX_VISIBLE_NODES: 1000,
  VIRTUALIZATION_THRESHOLD: 500,
  
  // デバウンス・スロットル
  SEARCH_DEBOUNCE: 300,
  RESIZE_DEBOUNCE: 100,
  SCROLL_THROTTLE: 16, // 60fps
  
  // メモリ管理
  CACHE_SIZE: 100,
  CLEANUP_INTERVAL: 60000, // 1分
};

// ========================================
// キーボードショートカット
// ========================================
export const SHORTCUTS = {
  // ナビゲーション
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  
  // 編集
  ENTER: 'Enter',
  TAB: 'Tab',
  ESCAPE: 'Escape',
  SPACE: ' ',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  
  // モディファイア
  CTRL: 'ctrl',
  CMD: 'cmd',
  SHIFT: 'shift',
  ALT: 'alt',
};

// ========================================
// 設定デフォルト値
// ========================================
export const DEFAULTS = {
  // マップ設定
  AUTO_SAVE: true,
  AUTO_LAYOUT: true,
  SNAP_TO_GRID: false,
  SHOW_GRID: false,
  ANIMATION_ENABLED: true,
  
  // UI設定
  SIDEBAR_VISIBLE: false,
  PERFORMANCE_DASH_VISIBLE: false,
  
  // 新規マップのタイトル
  NEW_MAP_TITLE: '新しいマインドマップ',
  ROOT_NODE_TEXT: 'メインテーマ',
};

// ========================================
// バリデーション
// ========================================
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
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_FILE_TYPES: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain', 'application/pdf', 'application/json'
  ],
};