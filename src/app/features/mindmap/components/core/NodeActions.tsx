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
}

const NodeActions: React.FC<NodeActionsProps> = ({
  node,
  isSelected,
  isEditing,
  nodeHeight,
  onAddChild,
  onDelete,
  onFileUpload,
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

  const buttonY = node.y + nodeHeight / 2 + 20;
  const buttonSize = 14; // ボタンサイズを少し大きく
  const spacing = 36; // ボタン間隔

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
          style={{ opacity: 0, transition: 'opacity 0.2s ease', pointerEvents: 'none' }}
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
          style={{ opacity: 0, transition: 'opacity 0.2s ease', pointerEvents: 'none' }}
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
          style={{
            filter: 'drop-shadow(0 2px 8px rgba(59, 130, 246, 0.15))',
            transition: 'all 0.2s ease'
          }}
          className="button-bg"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(node.id);
          }}
        />
        {/* ホバーエフェクト用の背景 */}
        <rect
          x={node.x - spacing - buttonSize / 2}
          y={buttonY - buttonSize / 2}
          width={buttonSize}
          height={buttonSize}
          rx="4"
          ry="4"
          fill="#3b82f6"
          opacity="0"
          style={{
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none'
          }}
          className="button-hover"
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
          style={{ opacity: 0, transition: 'opacity 0.2s ease', pointerEvents: 'none' }}
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
          style={{ opacity: 0, transition: 'opacity 0.2s ease', pointerEvents: 'none' }}
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
          style={{
            filter: 'drop-shadow(0 2px 8px rgba(16, 185, 129, 0.15))',
            transition: 'all 0.2s ease'
          }}
          className="button-bg"
          onClick={handleFileUpload}
        />
        {/* ホバーエフェクト用の背景 */}
        <rect
          x={node.x - buttonSize / 2}
          y={buttonY - buttonSize / 2}
          width={buttonSize}
          height={buttonSize}
          rx="4"
          ry="4"
          fill="#10b981"
          opacity="0"
          style={{
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none'
          }}
          className="button-hover"
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

      {/* 削除ボタン（ルートノード以外） */}
      {node.id !== 'root' && (
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
            style={{ opacity: 0, transition: 'opacity 0.2s ease', pointerEvents: 'none' }}
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
            style={{ opacity: 0, transition: 'opacity 0.2s ease', pointerEvents: 'none' }}
            className="tooltip-text"
          >
            ノード削除
          </text>
          
          {/* ボタン背景 */}
          <rect
            x={node.x + spacing - buttonSize / 2}
            y={buttonY - buttonSize / 2}
            width={buttonSize}
            height={buttonSize}
            rx="4"
            ry="4"
            fill="#ef4444"
            stroke="#ef4444"
            strokeWidth="1.5"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(239, 68, 68, 0.15))',
              transition: 'all 0.2s ease'
            }}
            className="button-bg"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
          />
          {/* ホバーエフェクト用の背景 */}
          <rect
            x={node.x + spacing - buttonSize / 2}
            y={buttonY - buttonSize / 2}
            width={buttonSize}
            height={buttonSize}
            rx="4"
            ry="4"
            fill="#ef4444"
            opacity="0"
            style={{
              transition: 'opacity 0.2s ease',
              pointerEvents: 'none'
            }}
            className="button-hover"
          />
          {/* 削除アイコン（×） */}
          <g style={{ pointerEvents: 'none' }}>
            <line
              x1={node.x + spacing - 4}
              y1={buttonY - 4}
              x2={node.x + spacing + 4}
              y2={buttonY + 4}
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              className="icon-stroke"
            />
            <line
              x1={node.x + spacing - 4}
              y1={buttonY + 4}
              x2={node.x + spacing + 4}
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
          .action-button:hover .button-bg {
            transform: translateY(-1px);
            filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2)) !important;
          }
          .action-button:hover .button-hover {
            opacity: 0.2 !important;
          }
          .action-button:hover .tooltip-bg {
            opacity: 1 !important;
          }
          .action-button:hover .tooltip-text {
            opacity: 1 !important;
          }
          .action-button:active .button-bg {
            transform: translateY(0px);
          }
        `
      }} />
    </g>
  );
};

export default memo(NodeActions);