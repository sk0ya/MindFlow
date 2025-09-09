import { useState } from 'react';
import type { NodeLink } from '@shared/types';

interface UseModalStateReturn {
  // Export/Import modals
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (show: boolean) => void;
  
  // Login modal
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  
  // Link modal states
  showLinkModal: boolean;
  setShowLinkModal: (show: boolean) => void;
  editingLink: NodeLink | null;
  setEditingLink: (link: NodeLink | null) => void;
  linkModalNodeId: string | null;
  setLinkModalNodeId: (nodeId: string | null) => void;
  
  // Link action menu states
  showLinkActionMenu: boolean;
  setShowLinkActionMenu: (show: boolean) => void;
  linkActionMenuData: {
    link: NodeLink;
    position: { x: number; y: number };
  } | null;
  setLinkActionMenuData: (data: { link: NodeLink; position: { x: number; y: number }; } | null) => void;
  
  // Context menu state
  contextMenu: {
    visible: boolean;
    position: { x: number; y: number };
    nodeId: string | null;
  };
  setContextMenu: (menu: {
    visible: boolean;
    position: { x: number; y: number };
    nodeId: string | null;
  }) => void;
}

export const useModalState = (): UseModalStateReturn => {
  // Export/Import modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Login modal
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Link-related states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState<NodeLink | null>(null);
  const [linkModalNodeId, setLinkModalNodeId] = useState<string | null>(null);
  const [showLinkActionMenu, setShowLinkActionMenu] = useState(false);
  const [linkActionMenuData, setLinkActionMenuData] = useState<{
    link: NodeLink;
    position: { x: number; y: number };
  } | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    nodeId: string | null;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    nodeId: null
  });

  return {
    showExportModal,
    setShowExportModal,
    showImportModal,
    setShowImportModal,
    showLoginModal,
    setShowLoginModal,
    showLinkModal,
    setShowLinkModal,
    editingLink,
    setEditingLink,
    linkModalNodeId,
    setLinkModalNodeId,
    showLinkActionMenu,
    setShowLinkActionMenu,
    linkActionMenuData,
    setLinkActionMenuData,
    contextMenu,
    setContextMenu
  };
};