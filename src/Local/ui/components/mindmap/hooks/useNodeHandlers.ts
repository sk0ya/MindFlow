import { useState } from 'react';

/**
 * ノード操作関連のハンドラーを管理するカスタムフック
 */
export const useNodeHandlers = (
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
) => {
  const handleAddChild = (parentId) => {
    addChildNode(parentId, '', true); // startEditing = true で即座に編集開始
  };

  const handleRightClick = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (nodeId) {
      setSelectedNodeId(nodeId);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
      setShowCustomizationPanel(false);
    }
  };

  const handleAddSibling = (nodeId) => {
    addSiblingNode(nodeId, '', true); // startEditing = true で即座に編集開始
  };

  const handleCopyNode = (node) => {
    const nodeCopy = JSON.parse(JSON.stringify(node));
    const removeIds = (n) => {
      delete n.id;
      if (n.children) n.children.forEach(removeIds);
    };
    removeIds(nodeCopy);
    return nodeCopy;
  };

  const handlePasteNode = (parentId, clipboard) => {
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
  const handleNodeSelect = (nodeId) => {
    setSelectedNodeId(nodeId);
    if (updateCursorPosition && nodeId) {
      updateCursorPosition(nodeId);
    }
  };

  const handleAddNodeMapLink = (nodeId, targetMapId, targetMapTitle, description) => {
    addNodeMapLink(nodeId, targetMapId, targetMapTitle, description);
  };

  const handleRemoveNodeMapLink = (nodeId, linkId) => {
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