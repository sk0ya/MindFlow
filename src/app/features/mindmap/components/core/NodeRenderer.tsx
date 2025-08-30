import React, { memo } from 'react';
import type { MindMapNode } from '@shared/types';

interface NodeRendererProps {
  node: MindMapNode;
  isSelected: boolean;
  isDragTarget?: boolean;
  isDragging: boolean;
  isLayoutTransitioning: boolean;
  nodeWidth: number;
  nodeHeight: number;
  imageHeight: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  isSelected,
  isDragTarget,
  isDragging,
  isLayoutTransitioning,
  nodeWidth,
  nodeHeight,
  imageHeight,
  onMouseDown,
  onClick,
  onDoubleClick,
  onContextMenu
}) => {
  // ファイルカードを考慮した選択範囲の計算
  const hasDisplayImage = node.attachments && node.attachments.some(f => f.isImage);
  const hasNonImageFiles = node.attachments && node.attachments.some(f => !f.isImage) || 
                          (node.attachments && node.attachments.filter(f => f.isImage).length > 1);
  
  // 画像がある場合のノード背景サイズを調整
  let actualNodeWidth = nodeWidth;
  let actualNodeHeight = nodeHeight;
  
  if (hasDisplayImage) {
    // 画像サイズを取得
    const imageSize = node.imageSize || 'medium';
    const imageSizeMap = {
      'small': { width: 100, height: 70 },
      'medium': { width: 150, height: 105 },
      'large': { width: 200, height: 140 },
      'extra-large': { width: 250, height: 175 }
    };
    const imageDimensions = imageSizeMap[imageSize];
    
    // ノード幅は画像幅とテキスト幅のうち大きい方に調整
    actualNodeWidth = Math.max(nodeWidth, imageDimensions.width + 20); // 20pxのマージン
    // ノード高さも調整（テキスト部分 + 画像部分）
    actualNodeHeight = 40 + imageDimensions.height; // テキスト部分40px + 画像の高さ
  }
  
  // 選択範囲の高さ・幅計算（新しいレイアウトに合わせて）
  let selectionHeight, selectionY, selectionWidth, selectionX;
  
  if (hasDisplayImage) {
    // 画像がある場合: 画像（上）+ テキスト（下）をカバーする範囲
    const imageSize = node.imageSize || 'medium';
    const imageSizeMap = {
      'small': { width: 100, height: 70 },
      'medium': { width: 150, height: 105 },
      'large': { width: 200, height: 140 },
      'extra-large': { width: 250, height: 175 }
    };
    const imageDimensions = imageSizeMap[imageSize];
    
    // 画像の上端から テキストの下端までをカバー
    const imageTop = node.y - imageDimensions.height / 2 - 20;
    const textBottom = node.y + imageDimensions.height / 2 + 5;
    
    selectionY = imageTop - 5; // 5pxのマージン
    selectionHeight = textBottom - imageTop + 10; // 上下5pxずつのマージン
    selectionWidth = Math.max(actualNodeWidth, imageDimensions.width) + 10; // 左右5pxずつのマージン
    selectionX = node.x - selectionWidth / 2;
  } else {
    // 画像がない場合: 従来通り
    selectionHeight = actualNodeHeight + 10; // 上下5pxずつのマージン
    selectionY = node.y - actualNodeHeight / 2 - 5;
    selectionWidth = actualNodeWidth + 10; // 左右5pxずつのマージン
    selectionX = node.x - selectionWidth / 2;
  }
  
  if (isSelected && hasNonImageFiles) {
    // ファイルカードがある場合は選択範囲を拡張
    const fileCardHeight = 22; // ファイルカードの高さ
    const fileCardYOffset = hasDisplayImage 
      ? imageHeight - 35 + 10  // 画像がある場合
      : 10;                    // 画像がない場合
    
    // 高さの拡張
    const fileCardBottom = node.y + fileCardYOffset + fileCardHeight;
    const nodeBottom = node.y + nodeHeight / 2;
    
    if (fileCardBottom > nodeBottom) {
      selectionHeight = fileCardBottom - selectionY + 5; // 5pxのマージン
    }
    
    // 幅の拡張 - ファイルカードの実際の配置範囲を計算
    const nonImageFiles = [
      ...(node.attachments?.filter(f => !f.isImage) || []),
      ...(node.attachments?.filter(f => f.isImage).slice(1) || [])
    ];
    
    if (nonImageFiles.length > 0) {
      let fileContentLeft, fileContentRight;
      
      if (nonImageFiles.length === 1) {
        // 単一ファイルの場合 - アイコンのみ
        const iconSize = 24;
        fileContentLeft = node.x - iconSize / 2;
        fileContentRight = node.x + iconSize / 2;
      } else {
        // 複数ファイルの場合 - アイコンの横並び
        const maxDisplayFiles = 3;
        const filesToShow = nonImageFiles.slice(0, maxDisplayFiles);
        const remainingCount = nonImageFiles.length - maxDisplayFiles;
        const iconSize = 20;
        const iconSpacing = 4;
        const totalWidth = filesToShow.length * iconSize + (filesToShow.length - 1) * iconSpacing + 
                          (remainingCount > 0 ? iconSize + iconSpacing : 0);
        fileContentLeft = node.x - totalWidth / 2;
        fileContentRight = node.x + totalWidth / 2;
      }
      
      // ノードテキスト部分の範囲
      const nodeLeft = node.x - nodeWidth / 2;
      const nodeRight = node.x + nodeWidth / 2;
      
      // 選択範囲は両方を含む最小の範囲
      const selectionLeft = Math.min(nodeLeft, fileContentLeft);
      const selectionRight = Math.max(nodeRight, fileContentRight);
      
      selectionWidth = selectionRight - selectionLeft;
      selectionX = selectionLeft;
    }
  }

  return (
    <>
      {/* 通常のノード背景 */}
      <rect
        x={node.x - actualNodeWidth / 2}
        y={node.y - actualNodeHeight / 2}
        width={actualNodeWidth}
        height={actualNodeHeight}
        fill="rgba(255, 255, 255, 0.9)"
        stroke="transparent"
        strokeWidth="0"
        rx="12"
        ry="12"
        role="button"
        tabIndex={0}
        aria-label={`Mind map node: ${node.text}`}
        aria-selected={isSelected}
        style={{
          cursor: isDragging ? 'grabbing' : 'pointer',
          filter: isDragTarget 
            ? 'drop-shadow(0 8px 25px rgba(245, 158, 11, 0.4))' 
            : isDragging
            ? 'drop-shadow(0 12px 30px rgba(0,0,0,0.2))'
            : (isSelected ? 'drop-shadow(0 4px 20px rgba(59, 130, 246, 0.25))' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))'),
          opacity: isDragging ? 0.8 : 1,
          transform: isDragging ? 'scale(1.05)' : 'scale(1)',
          transition: (isDragging || isLayoutTransitioning) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
        }}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      />
    </>
  );
};

// 選択枠線のみを描画する新しいコンポーネント
export const NodeSelectionBorder: React.FC<{
  node: MindMapNode;
  isSelected: boolean;
  isDragTarget?: boolean;
  isDragging: boolean;
  isLayoutTransitioning: boolean;
  nodeWidth: number;
  nodeHeight: number;
  imageHeight: number;
}> = ({
  node,
  isSelected,
  isDragTarget,
  isDragging,
  isLayoutTransitioning,
  nodeWidth,
  nodeHeight,
  imageHeight
}) => {
  if (!isSelected && !isDragTarget) return null;
  
  // 画像の有無を確認
  const hasDisplayImage = node.attachments && node.attachments.some(f => f.isImage);
  const hasNonImageFiles = node.attachments && node.attachments.some(f => !f.isImage) || 
                          (node.attachments && node.attachments.filter(f => f.isImage).length > 1);
  
  // 画像がある場合のノード背景サイズを調整
  let actualNodeWidth = nodeWidth;
  let actualNodeHeight = nodeHeight;
  
  if (hasDisplayImage) {
    const imageSize = node.imageSize || 'medium';
    const imageSizeMap = {
      'small': { width: 100, height: 70 },
      'medium': { width: 150, height: 105 },
      'large': { width: 200, height: 140 },
      'extra-large': { width: 250, height: 175 }
    };
    const imageDimensions = imageSizeMap[imageSize];
    
    actualNodeWidth = Math.max(nodeWidth, imageDimensions.width + 20);
    actualNodeHeight = 40 + imageDimensions.height;
  }
  
  // 選択範囲の計算
  let selectionHeight, selectionY, selectionWidth, selectionX;
  
  if (hasDisplayImage) {
    const imageSize = node.imageSize || 'medium';
    const imageSizeMap = {
      'small': { width: 100, height: 70 },
      'medium': { width: 150, height: 105 },
      'large': { width: 200, height: 140 },
      'extra-large': { width: 250, height: 175 }
    };
    const imageDimensions = imageSizeMap[imageSize];
    
    const imageTop = node.y - imageDimensions.height / 2 - 20;
    const textBottom = node.y + imageDimensions.height / 2 + 5;
    
    selectionY = imageTop - 5;
    selectionHeight = textBottom - imageTop + 10;
    selectionWidth = Math.max(actualNodeWidth, imageDimensions.width) + 10;
    selectionX = node.x - selectionWidth / 2;
  } else {
    selectionHeight = actualNodeHeight + 10;
    selectionY = node.y - actualNodeHeight / 2 - 5;
    selectionWidth = actualNodeWidth + 10;
    selectionX = node.x - selectionWidth / 2;
  }
  
  // ファイルアイコンがある場合の範囲拡張
  if (hasNonImageFiles) {
    const fileCardHeight = 22;
    const fileCardYOffset = hasDisplayImage 
      ? node.y + (hasDisplayImage ? (node.imageSize ? { 'small': 70, 'medium': 105, 'large': 140, 'extra-large': 175 }[node.imageSize] || 105 : 105) : 0) / 2 + 15
      : node.y + 10;
    
    const fileCardBottom = fileCardYOffset + fileCardHeight;
    const currentBottom = selectionY + selectionHeight;
    
    if (fileCardBottom > currentBottom) {
      selectionHeight = fileCardBottom - selectionY + 5;
    }
  }

  return (
    <rect
      x={selectionX}
      y={selectionY}
      width={selectionWidth}
      height={selectionHeight}
      fill="transparent"
      stroke={isDragTarget ? "#f59e0b" : "#3b82f6"}
      strokeWidth={isDragTarget ? "3" : "2.5"}
      strokeDasharray={isDragTarget ? "5,5" : "none"}
      rx="12"
      ry="12"
      style={{
        pointerEvents: 'none',
        transition: (isDragging || isLayoutTransitioning) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
      }}
    />
  );
};

export default memo(NodeRenderer);