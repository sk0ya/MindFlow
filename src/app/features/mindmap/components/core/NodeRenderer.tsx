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
  const hasAttachments = node.attachments && node.attachments.length > 0;
  const hasDisplayImage = node.attachments && node.attachments.some(f => f.isImage);
  const hasNonImageFiles = node.attachments && node.attachments.some(f => !f.isImage) || 
                          (node.attachments && node.attachments.filter(f => f.isImage).length > 1);
  
  // 選択範囲の高さ・幅計算
  let selectionHeight = nodeHeight;
  let selectionY = node.y - nodeHeight / 2;
  let selectionWidth = nodeWidth;
  let selectionX = node.x - nodeWidth / 2;
  
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
        x={node.x - nodeWidth / 2}
        y={node.y - nodeHeight / 2}
        width={nodeWidth}
        height={nodeHeight}
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
          transition: (isDragging || isLayoutTransitioning) ? 'none' : 'filter 0.2s ease, opacity 0.2s ease, transform 0.2s ease'
        }}
        onMouseDown={onMouseDown}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      />
      
      {/* 選択時の枠線（ファイルカードを含む範囲） */}
      {(isSelected || isDragTarget) && (
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
            transition: (isDragging || isLayoutTransitioning) ? 'none' : 'stroke 0.2s ease'
          }}
        />
      )}
    </>
  );
};

export default memo(NodeRenderer);