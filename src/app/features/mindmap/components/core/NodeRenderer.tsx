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
  imageHeight: _imageHeight,
  onMouseDown,
  onClick,
  onDoubleClick,
  onContextMenu
}) => {
  // propsで渡されたnodeWidth/nodeHeightを使用（nodeUtils.tsで計算済み）
  const actualNodeWidth = nodeWidth;
  const actualNodeHeight = nodeHeight;
  
  // この部分は使用されない（NodeSelectionBorderで選択枠線を描画する）

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
}> = ({
  node,
  isSelected,
  isDragTarget,
  isDragging,
  isLayoutTransitioning,
  nodeWidth,
  nodeHeight
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
    // 画像サイズを取得（カスタムサイズを優先）
    const getImageDimensions = (node: MindMapNode) => {
      // カスタムサイズが設定されている場合
      if (node.customImageWidth && node.customImageHeight) {
        return { width: node.customImageWidth, height: node.customImageHeight };
      }
      
      // プリセットサイズの場合
      const imageSize = node.imageSize || 'medium';
      const sizeMap = {
        'small': { width: 100, height: 70 },
        'medium': { width: 150, height: 105 },
        'large': { width: 200, height: 140 },
        'extra-large': { width: 250, height: 175 }
      };
      
      return sizeMap[imageSize];
    };

    const imageDimensions = getImageDimensions(node);
    
    actualNodeWidth = Math.max(nodeWidth, imageDimensions.width + 20);
    actualNodeHeight = 25 + imageDimensions.height;
  }
  
  // 選択範囲の計算
  let selectionHeight, selectionY, selectionWidth, selectionX;
  
  if (hasDisplayImage) {
    // 同じgetImageDimensions関数を使用
    const getImageDimensions = (node: MindMapNode) => {
      if (node.customImageWidth && node.customImageHeight) {
        return { width: node.customImageWidth, height: node.customImageHeight };
      }
      
      const imageSize = node.imageSize || 'medium';
      const sizeMap = {
        'small': { width: 100, height: 70 },
        'medium': { width: 150, height: 105 },
        'large': { width: 200, height: 140 },
        'extra-large': { width: 250, height: 175 }
      };
      
      return sizeMap[imageSize];
    };

    const imageDimensions = getImageDimensions(node);
    
    const imageTop = node.y - imageDimensions.height / 2;
    const textBottom = node.y + imageDimensions.height / 2 + 20;
    
    selectionY = imageTop - 5;
    selectionHeight = textBottom - imageTop + 5;
    selectionWidth = Math.max(actualNodeWidth, imageDimensions.width);
    selectionX = node.x - selectionWidth / 2;
  } else {
    selectionHeight = actualNodeHeight;
    selectionY = node.y - actualNodeHeight / 2;
    selectionWidth = actualNodeWidth;
    selectionX = node.x - selectionWidth / 2;
  }
  
  // ファイルアイコンがある場合の範囲拡張
  if (hasNonImageFiles) {
    const fileCardHeight = 22;
    
    // 画像サイズを再取得
    const getImageDimensions = (node: MindMapNode) => {
      if (node.customImageWidth && node.customImageHeight) {
        return { width: node.customImageWidth, height: node.customImageHeight };
      }
      
      const imageSize = node.imageSize || 'medium';
      const sizeMap = {
        'small': { width: 100, height: 70 },
        'medium': { width: 150, height: 105 },
        'large': { width: 200, height: 140 },
        'extra-large': { width: 250, height: 175 }
      };
      
      return sizeMap[imageSize];
    };
    
    const imageDimensions = getImageDimensions(node);
    const fileCardYOffset = hasDisplayImage 
      ? node.y + imageDimensions.height / 2 + 25
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
      stroke={isDragTarget ? "#f59e0b" : "#60a5fa"}
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