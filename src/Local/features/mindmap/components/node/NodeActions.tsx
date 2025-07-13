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
  onShowNodeMapLinks: (node: MindMapNode, position: { x: number; y: number }) => void;
}

const NodeActions: React.FC<NodeActionsProps> = ({
  node,
  isSelected,
  isEditing,
  nodeHeight,
  onAddChild,
  onDelete,
  onFileUpload,
  onShowNodeMapLinks
}) => {
  const handleShowMapLinks = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowNodeMapLinks) {
      onShowNodeMapLinks(node, {
        x: e.clientX,
        y: e.clientY
      });
    }
  }, [onShowNodeMapLinks, node]);

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

  return (
    <g>
      <circle
        cx={node.x - 35}
        cy={node.y + nodeHeight / 2 + 15}
        r="12"
        fill="#4285f4"
        stroke="white"
        strokeWidth="2"
        role="button"
        tabIndex={0}
        aria-label="Add child node"
        style={{ 
          cursor: 'pointer',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))'
        }}
        onClick={(e) => {
          e.stopPropagation();
          onAddChild(node.id);
        }}
      />
      <text
        x={node.x - 35}
        y={node.y + nodeHeight / 2 + 15 + 4}
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontWeight="bold"
        style={{ pointerEvents: 'none' }}
      >
        +
      </text>
      
      {/* ファイルアップロードボタン */}
      <circle
        cx={node.x - 10}
        cy={node.y + nodeHeight / 2 + 15}
        r="12"
        fill="#34a853"
        stroke="white"
        strokeWidth="2"
        role="button"
        tabIndex={0}
        aria-label="Upload file"
        style={{ 
          cursor: 'pointer',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))'
        }}
        onClick={handleFileUpload}
      />
      <text
        x={node.x - 10}
        y={node.y + nodeHeight / 2 + 15 + 4}
        textAnchor="middle"
        fill="white"
        fontSize="14"
        fontWeight="bold"
        style={{ pointerEvents: 'none' }}
      >
        📎
      </text>

      {/* マップリンクボタン */}
      <circle
        cx={node.x + 15}
        cy={node.y + nodeHeight / 2 + 15}
        r="12"
        fill="#9c27b0"
        stroke="white"
        strokeWidth="2"
        role="button"
        tabIndex={0}
        aria-label="Map links"
        style={{ 
          cursor: 'pointer',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))'
        }}
        onClick={handleShowMapLinks}
      />
      <text
        x={node.x + 15}
        y={node.y + nodeHeight / 2 + 15 + 4}
        textAnchor="middle"
        fill="white"
        fontSize="14"
        fontWeight="bold"
        style={{ pointerEvents: 'none' }}
      >
        🔗
      </text>

      {node.id !== 'root' && (
        <>
          <circle
            cx={node.x + 40}
            cy={node.y + nodeHeight / 2 + 15}
            r="12"
            fill="#ea4335"
            stroke="white"
            strokeWidth="2"
            role="button"
            tabIndex={0}
            aria-label="Delete node"
            style={{ 
              cursor: 'pointer',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
          />
          <text
            x={node.x + 40}
            y={node.y + nodeHeight / 2 + 15 + 4}
            textAnchor="middle"
            fill="white"
            fontSize="16"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            ×
          </text>
        </>
      )}
    </g>
  );
};

export default memo(NodeActions);