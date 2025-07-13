/**
 * パフォーマンス関連の定数
 */
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