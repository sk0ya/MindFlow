import React, { memo } from 'react';
import { ErrorBoundary } from '../../../../shared/components';
import MindMapCanvas from './MindMapCanvas';
import type { MindMapData, MindMapNode, Position, FileAttachment } from '../../../../shared/types';

interface MindMapWorkspaceProps {
  data: MindMapData;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onMoveNode: (nodeId: string, newParentId: string) => void;
  onChangeSiblingOrder: (draggedNodeId: string, targetNodeId: string, insertBefore: boolean) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRightClick: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onFileUpload: (nodeId: string, files: FileList) => void;
  onRemoveFile: (nodeId: string, fileId: string) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onShowNodeMapLinks: (node: MindMapNode, position: { x: number; y: number }) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: Position;
  setPan: (pan: Position | ((prev: Position) => Position)) => void;
}

const MindMapWorkspace: React.FC<MindMapWorkspaceProps> = ({
  data,
  selectedNodeId,
  editingNodeId,
  editText,
  setEditText,
  onSelectNode,
  onStartEdit,
  onFinishEdit,
  onMoveNode,
  onChangeSiblingOrder,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onRightClick,
  onToggleCollapse,
  onFileUpload,
  onRemoveFile,
  onShowImageModal,
  onShowFileActionMenu,
  onShowNodeMapLinks,
  zoom,
  setZoom,
  pan,
  setPan
}) => {
  console.log('🏗️ MindMapWorkspace props:', { 
    hasOnMoveNode: !!onMoveNode,
    hasOnChangeSiblingOrder: !!onChangeSiblingOrder,
    onMoveNodeType: typeof onMoveNode,
    onChangeSiblingOrderType: typeof onChangeSiblingOrder
  });
  
  return (
    <ErrorBoundary>
      <MindMapCanvas
        data={data}
        selectedNodeId={selectedNodeId}
        editingNodeId={editingNodeId}
        editText={editText}
        setEditText={setEditText}
        onSelectNode={onSelectNode}
        onStartEdit={onStartEdit}
        onFinishEdit={onFinishEdit}
        onChangeParent={onMoveNode}
        onChangeSiblingOrder={onChangeSiblingOrder}
        onAddChild={onAddChild}
        onAddSibling={onAddSibling}
        onDeleteNode={onDeleteNode}
        onRightClick={onRightClick}
        onToggleCollapse={onToggleCollapse}
        onNavigateToDirection={(_direction: 'up' | 'down' | 'left' | 'right') => {}}
        onFileUpload={onFileUpload}
        onRemoveFile={onRemoveFile}
        onShowImageModal={onShowImageModal}
        onShowFileActionMenu={onShowFileActionMenu}
        onShowNodeMapLinks={onShowNodeMapLinks}
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
      />
    </ErrorBoundary>
  );
};

export default memo(MindMapWorkspace);