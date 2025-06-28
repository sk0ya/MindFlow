import { useState } from 'react';
import { NodeHandlerParams, NodeHandlers } from './handlerTypes';
import { MindMapNode } from '../../../../shared/types/dataTypes';

/**
 * ノード操作関連のハンドラーを管理するカスタムフック
 */
export const useNodeHandlers = ({
  setSelectedNodeId,
  setContextMenuPosition,
  setShowContextMenu,
  setShowCustomizationPanel,
  addChildNode,
  addSiblingNode,
  updateNode,
  addNodeMapLink,
  removeNodeMapLink,
  updateCursorPosition
}: NodeHandlerParams): NodeHandlers => {
  const handleAddChild = (parentId: string): void => {
    addChildNode(parentId, '', true); // startEditing = true で即座に編集開始
  };

  const handleRightClick = (e: React.MouseEvent<HTMLElement>, nodeId: string): void => {
    e.preventDefault();
    e.stopPropagation();
    
    if (nodeId) {
      setSelectedNodeId(nodeId);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
      setShowCustomizationPanel(false);
    }
  };

  const handleAddSibling = (nodeId: string): void => {
    addSiblingNode(nodeId, '', true); // startEditing = true で即座に編集開始
  };

  const handleCopyNode = (node: MindMapNode): Partial<MindMapNode> => {
    const nodeCopy = JSON.parse(JSON.stringify(node)) as MindMapNode;
    const removeIds = (n: MindMapNode): void => {
      delete n.id;
      if (n.children) n.children.forEach(removeIds);
    };
    removeIds(nodeCopy);
    return nodeCopy;
  };

  const handlePasteNode = (parentId: string, clipboard: Partial<MindMapNode> | null): void => {
    if (!clipboard) return;
    
    const newNodeId = addChildNode(parentId);
    if (newNodeId) {
      updateNode(newNodeId, {
        text: clipboard.text || '',
        fontSize: clipboard.fontSize,
        fontWeight: clipboard.fontWeight,
        fontStyle: clipboard.fontStyle
      });
      setSelectedNodeId(newNodeId);
    }
  };

  // カーソル更新（ノード選択時）
  const handleNodeSelect = (nodeId: string): void => {
    setSelectedNodeId(nodeId);
    if (updateCursorPosition && nodeId) {
      updateCursorPosition(nodeId);
    }
  };

  const handleAddNodeMapLink = (nodeId: string, targetMapId: string, targetMapTitle: string, description: string): void => {
    addNodeMapLink(nodeId, targetMapId, targetMapTitle, description);
  };

  const handleRemoveNodeMapLink = (nodeId: string, linkId: string): void => {
    removeNodeMapLink(nodeId, linkId);
  };

  return {
    handleAddChild,
    handleRightClick,
    handleAddSibling,
    handleCopyNode,
    handlePasteNode,
    handleNodeSelect,
    handleAddNodeMapLink,
    handleRemoveNodeMapLink
  };
};