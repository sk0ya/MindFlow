/**
 * 添付ファイル一覧とリンク一覧の高さ計算用ユーティリティ
 */

export interface ListHeightConfig {
  itemCount: number;
  maxHeight?: number;
}

export const calculateAttachmentListHeight = ({ itemCount, maxHeight = 240 }: ListHeightConfig): number => {
  if (itemCount === 0) return 0;
  
  const actualItemHeight = 16 + 4; // 内容高さ + パディング
  const containerPadding = 12; // コンテナの上下パディング（6px × 2）
  const itemGaps = Math.max(0, itemCount - 1) * 1; // アイテム間の1pxギャップ
  
  return Math.min(itemCount * actualItemHeight + containerPadding + itemGaps, maxHeight);
};

export const calculateLinkListHeight = ({ itemCount, maxHeight = 240 }: ListHeightConfig): number => {
  if (itemCount === 0) return 0;
  
  const actualItemHeight = 16 + 4; // 内容高さ + パディング（リンク一覧も同じサイズ）
  const containerPadding = 12; // コンテナの上下パディング（6px × 2）
  const itemGaps = Math.max(0, itemCount - 1) * 1; // アイテム間の1pxギャップ
  
  return Math.min(itemCount * actualItemHeight + containerPadding + itemGaps, maxHeight);
};