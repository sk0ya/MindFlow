import React from 'react';
import { logger } from '../../../../shared/utils/logger';
import type { NodeLink } from '@shared/types';

interface ModalState {
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (show: boolean) => void;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  showLinkModal: boolean;
  setShowLinkModal: (show: boolean) => void;
  editingLink: NodeLink | null;
  setEditingLink: (link: NodeLink | null) => void;
  linkModalNodeId: string | null;
  setLinkModalNodeId: (id: string | null) => void;
  showLinkActionMenu: boolean;
  setShowLinkActionMenu: (show: boolean) => void;
  linkActionMenuData: { link: NodeLink; position: { x: number; y: number } } | null;
  setLinkActionMenuData: (data: { link: NodeLink; position: { x: number; y: number } } | null) => void;
  contextMenu: { visible: boolean; position: { x: number; y: number }; nodeId: string | null };
  setContextMenu: (menu: { visible: boolean; position: { x: number; y: number }; nodeId: string | null }) => void;
}

interface ModalManagerProps {
  modalState: ModalState;
  store: any;
  showNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  handleError: (error: Error, context: string, operation: string) => void;
}

export const useModalManager = ({
  modalState,
  store,
  showNotification,
  handleError,
}: ModalManagerProps) => {
  
  const {
    editingLink,
    setEditingLink,
    linkModalNodeId,
    setLinkModalNodeId,
    setShowLinkModal,
    setShowLinkActionMenu,
    setLinkActionMenuData,
    setContextMenu,
  } = modalState;

  // Link-related handlers
  const handleAddLink = React.useCallback((nodeId: string) => {
    console.log('📝 handleAddLink called:', nodeId);
    setEditingLink(null);
    setLinkModalNodeId(nodeId);
    setShowLinkModal(true);
  }, [setEditingLink, setLinkModalNodeId, setShowLinkModal]);

  const handleEditLink = React.useCallback((link: NodeLink, nodeId: string) => {
    console.log('🔥 handleEditLink called:', { link, nodeId });
    setEditingLink(link);
    setLinkModalNodeId(nodeId);
    setShowLinkModal(true);
  }, [setEditingLink, setLinkModalNodeId, setShowLinkModal]);

  const handleSaveLink = React.useCallback(async (linkData: Partial<NodeLink>) => {
    if (!linkModalNodeId) return;

    try {
      if (editingLink) {
        // Update existing link
        store.updateNodeLink(linkModalNodeId, editingLink.id, linkData);
        showNotification('success', 'リンクを更新しました');
      } else {
        // Add new link
        store.addNodeLink(linkModalNodeId, linkData);
        showNotification('success', 'リンクを追加しました');
      }
    } catch (error) {
      logger.error('Link save error:', error);
      handleError(error as Error, 'リンク操作', 'リンクの保存');
    }
  }, [linkModalNodeId, editingLink, store, showNotification, handleError]);

  const handleDeleteLink = React.useCallback(async (linkId: string) => {
    if (!linkModalNodeId) return;

    try {
      store.deleteNodeLink(linkModalNodeId, linkId);
      showNotification('success', 'リンクを削除しました');
    } catch (error) {
      logger.error('Link delete error:', error);
      handleError(error as Error, 'リンク操作', 'リンクの削除');
    }
  }, [linkModalNodeId, store, showNotification, handleError]);

  const handleShowLinkActionMenu = React.useCallback((link: NodeLink, position: { x: number; y: number }) => {
    setLinkActionMenuData({ link, position });
    setShowLinkActionMenu(true);
  }, [setLinkActionMenuData, setShowLinkActionMenu]);

  const handleCloseLinkActionMenu = React.useCallback(() => {
    setShowLinkActionMenu(false);
    setLinkActionMenuData(null);
  }, [setShowLinkActionMenu, setLinkActionMenuData]);

  // Context menu handlers
  const handleContextMenuClose = React.useCallback(() => {
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      nodeId: null
    });
  }, [setContextMenu]);

  const handleRightClick = React.useCallback((e: React.MouseEvent, nodeId: string, ui: any, selectNode: (nodeId: string) => void) => {
    e.preventDefault();
    
    // リンクリストまたは添付ファイルリスト表示中は右クリックコンテキストメニューを無効化
    if (ui.showLinkListForNode || ui.showAttachmentListForNode) {
      return;
    }
    
    setContextMenu({
      visible: true,
      position: { x: e.clientX, y: e.clientY },
      nodeId: nodeId
    });
    selectNode(nodeId); // Select the node when right-clicking
  }, [setContextMenu]);

  return {
    // Link operations
    handleAddLink,
    handleEditLink,
    handleSaveLink,
    handleDeleteLink,
    handleShowLinkActionMenu,
    handleCloseLinkActionMenu,
    
    // Context menu operations
    handleContextMenuClose,
    handleRightClick,
  };
};