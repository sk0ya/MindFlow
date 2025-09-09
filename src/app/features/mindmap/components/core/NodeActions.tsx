import React, { useCallback, memo } from 'react';
import type { MindMapNode } from '@shared/types';

interface NodeActionsProps {
  node: MindMapNode;
  isSelected: boolean;
  isEditing: boolean;
  nodeHeight: number;
  onAddChild: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
  onFileUpload: (nodeId: string, files: FileList) => void;
  onAddLink: (nodeId: string) => void;
}

const NodeActions: React.FC<NodeActionsProps> = ({
  node,
  isSelected,
  isEditing,
  nodeHeight,
  onAddChild,
  onDelete,
  onFileUpload,
  onAddLink,
}) => {

  const handleFileUpload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,text/plain,application/pdf,application/json';
    fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (files && files.length > 0 && onFileUpload) {
        onFileUpload(node.id, files);
      }
      target.value = '';
    });
    fileInput.click();
  }, [node.id, onFileUpload]);


  if (!isSelected || isEditing) {
    return null;
  }

  const buttonY = node.y + nodeHeight / 2 + 12;
  const buttonSize = 14; // ボタンサイズを少し大きく
  const spacing = 20; // ボタン間隔を狭く

  return (
    <g className="node-actions">
      {/* 子ノード追加ボタン */}
      <g className="action-button" style={{ cursor: 'pointer' }}>
        {/* ツールチップ背景 */}
        <rect
          x={node.x - spacing - 28}
          y={buttonY - 38}
          width="56"
          height="18"
          rx="4"
          ry="4"
          fill="rgba(0, 0, 0, 0.8)"
          style={{ opacity: 0, pointerEvents: 'none' }}
          className="tooltip-bg"
        />
        {/* ツールチップテキスト */}
        <text
          x={node.x - spacing}
          y={buttonY - 26}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          style={{ opacity: 0, pointerEvents: 'none' }}
          className="tooltip-text"
        >
          子ノード追加
        </text>
        
        {/* ボタン背景 */}
        <rect
          x={node.x - spacing - buttonSize / 2}
          y={buttonY - buttonSize / 2}
          width={buttonSize}
          height={buttonSize}
          rx="4"
          ry="4"
          fill="#3b82f6"
          stroke="#3b82f6"
          strokeWidth="1.5"
          className="button-bg"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(node.id);
          }}
        />
        {/* プラスアイコン */}
        <g style={{ pointerEvents: 'none' }}>
          <line
            x1={node.x - spacing - 4}
            y1={buttonY}
            x2={node.x - spacing + 4}
            y2={buttonY}
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            className="icon-stroke"
          />
          <line
            x1={node.x - spacing}
            y1={buttonY - 4}
            x2={node.x - spacing}
            y2={buttonY + 4}
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            className="icon-stroke"
          />
        </g>
      </g>
      
      {/* ファイルアップロードボタン */}
      <g className="action-button" style={{ cursor: 'pointer' }}>
        {/* ツールチップ背景 */}
        <rect
          x={node.x - 25}
          y={buttonY - 38}
          width="50"
          height="18"
          rx="4"
          ry="4"
          fill="rgba(0, 0, 0, 0.8)"
          style={{ opacity: 0, pointerEvents: 'none' }}
          className="tooltip-bg"
        />
        {/* ツールチップテキスト */}
        <text
          x={node.x}
          y={buttonY - 26}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          style={{ opacity: 0, pointerEvents: 'none' }}
          className="tooltip-text"
        >
          ファイル添付
        </text>
        
        {/* ボタン背景 */}
        <rect
          x={node.x - buttonSize / 2}
          y={buttonY - buttonSize / 2}
          width={buttonSize}
          height={buttonSize}
          rx="4"
          ry="4"
          fill="#10b981"
          stroke="#10b981"
          strokeWidth="1.5"
          className="button-bg"
          onClick={handleFileUpload}
        />
        {/* フォルダアイコン（ファイル添付） */}
        <g style={{ pointerEvents: 'none' }} transform={`translate(${node.x}, ${buttonY})`}>
          <path
            d="M-4 -2 L-2 -4 L4 -4 L4 3 L-4 3 Z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="icon-stroke"
          />
          <path
            d="M-4 -1 L4 -1"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="icon-stroke"
          />
        </g>
      </g>

      {/* リンク追加ボタン */}
      <g className="action-button" style={{ cursor: 'pointer' }}>
        {/* ツールチップ背景 */}
        <rect
          x={node.x + spacing - 25}
          y={buttonY - 38}
          width="50"
          height="18"
          rx="4"
          ry="4"
          fill="rgba(0, 0, 0, 0.8)"
          style={{ opacity: 0, pointerEvents: 'none' }}
          className="tooltip-bg"
        />
        {/* ツールチップテキスト */}
        <text
          x={node.x + spacing}
          y={buttonY - 26}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          style={{ opacity: 0, pointerEvents: 'none' }}
          className="tooltip-text"
        >
          リンク追加
        </text>
        
        {/* ボタン背景 */}
        <rect
          x={node.x + spacing - buttonSize / 2}
          y={buttonY - buttonSize / 2}
          width={buttonSize}
          height={buttonSize}
          rx="4"
          ry="4"
          fill="#6366f1"
          stroke="#6366f1"
          strokeWidth="1.5"
          className="button-bg"
          onClick={(e) => {
            e.stopPropagation();
            onAddLink(node.id);
          }}
        />
        {/* リンクアイコン */}
        <g style={{ pointerEvents: 'none' }} transform={`translate(${node.x + spacing}, ${buttonY})`}>
          <path
            d="M-3 -1 Q-3 -3 -1 -3 L1 -3 Q3 -3 3 -1 L3 1 Q3 3 1 3 L-1 3 Q-3 3 -3 1 Z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="icon-stroke"
          />
          <path
            d="M-1 -3 L-1 3 M1 -3 L1 3"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="icon-stroke"
          />
        </g>
      </g>

      {/* 削除ボタン（ルートノード以外） */}
      {node.id !== 'root' && (
        <g className="action-button" style={{ cursor: 'pointer' }}>
          {/* ツールチップ背景 */}
          <rect
            x={node.x + spacing * 2 - 25}
            y={buttonY - 38}
            width="50"
            height="18"
            rx="4"
            ry="4"
            fill="rgba(0, 0, 0, 0.8)"
            style={{ opacity: 0, pointerEvents: 'none' }}
            className="tooltip-bg"
          />
          {/* ツールチップテキスト */}
          <text
            x={node.x + spacing * 2}
            y={buttonY - 26}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="10"
            fontFamily="system-ui, sans-serif"
            style={{ opacity: 0, pointerEvents: 'none' }}
            className="tooltip-text"
          >
            ノード削除
          </text>
          
          {/* ボタン背景 */}
          <rect
            x={node.x + spacing * 2 - buttonSize / 2}
            y={buttonY - buttonSize / 2}
            width={buttonSize}
            height={buttonSize}
            rx="4"
            ry="4"
            fill="#ef4444"
            stroke="#ef4444"
            strokeWidth="1.5"
            className="button-bg"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
          />
          {/* 削除アイコン（×） */}
          <g style={{ pointerEvents: 'none' }}>
            <line
              x1={node.x + spacing * 2 - 4}
              y1={buttonY - 4}
              x2={node.x + spacing * 2 + 4}
              y2={buttonY + 4}
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              className="icon-stroke"
            />
            <line
              x1={node.x + spacing * 2 - 4}
              y1={buttonY + 4}
              x2={node.x + spacing * 2 + 4}
              y2={buttonY - 4}
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              className="icon-stroke"
            />
          </g>
        </g>
      )}

      {/* CSS スタイル */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .action-button:hover .tooltip-bg {
            opacity: 1 !important;
          }
          .action-button:hover .tooltip-text {
            opacity: 1 !important;
          }
        `
      }} />
    </g>
  );
};

export default memo(NodeActions);