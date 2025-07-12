import { useState, useEffect } from 'react';
import type { MindMapNode } from '../../../../shared/types';

// Type definitions
interface Position {
  x: number;
  y: number;
}

/**
 * UI状態管理のカスタムフック（パネル、モーダル、メニューなど）
 */
export const useUIState = () => {
  // 基本UI状態
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [showCustomizationPanel, setShowCustomizationPanel] = useState<boolean>(false);
  const [customizationPosition, setCustomizationPosition] = useState<Position>({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState<boolean>(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<Position>({ x: 0, y: 0 });
  const [clipboard, setClipboard] = useState<MindMapNode | null>(null);
  
  // キーボードショートカットヘルパー状態
  const [showShortcutHelper, setShowShortcutHelper] = useState<boolean>(false);
  
  // マップリスト状態
  const [showMapList, setShowMapList] = useState<boolean>(false);
  
  // ノードマップリンクパネル状態
  const [showNodeMapLinksPanel, setShowNodeMapLinksPanel] = useState<boolean>(false);
  const [nodeMapLinksPanelPosition, setNodeMapLinksPanelPosition] = useState<Position>({ x: 0, y: 0 });
  const [selectedNodeForLinks, setSelectedNodeForLinks] = useState<MindMapNode | null>(null);
  
  // サイドバー状態
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  
  // ローカルストレージパネル状態
  const [showLocalStoragePanel, setShowLocalStoragePanel] = useState<boolean>(false);
  
  // チュートリアル状態
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  const handleZoomReset = (): void => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCloseAllPanels = (): void => {
    setShowCustomizationPanel(false);
    setShowContextMenu(false);
    setShowNodeMapLinksPanel(false);
  };

  const handleShowCustomization = (_node?: MindMapNode, position?: Position): void => {
    setCustomizationPosition(position || { x: 300, y: 200 });
    setShowCustomizationPanel(true);
    setShowContextMenu(false);
  };

  const handleToggleSidebar = (): void => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // ノードマップリンク関連のハンドラー
  const handleShowNodeMapLinks = (node: MindMapNode, position: Position): void => {
    setSelectedNodeForLinks(node);
    setNodeMapLinksPanelPosition(position);
    setShowNodeMapLinksPanel(true);
    handleCloseAllPanels();
    setShowNodeMapLinksPanel(true);
  };

  const handleCloseNodeMapLinksPanel = (): void => {
    setShowNodeMapLinksPanel(false);
    setSelectedNodeForLinks(null);
  };

  // Escapeキーでパネルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        handleCloseAllPanels();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    // 基本状態
    zoom,
    setZoom,
    pan,
    setPan,
    showCustomizationPanel,
    setShowCustomizationPanel,
    customizationPosition,
    showContextMenu,
    setShowContextMenu,
    contextMenuPosition,
    setContextMenuPosition,
    clipboard,
    setClipboard,
    
    // UI表示状態
    showShortcutHelper,
    setShowShortcutHelper,
    showMapList,
    setShowMapList,
    showNodeMapLinksPanel,
    nodeMapLinksPanelPosition,
    selectedNodeForLinks,
    sidebarCollapsed,
    showLocalStoragePanel,
    setShowLocalStoragePanel,
    showTutorial,
    setShowTutorial,
    
    // ハンドラー
    handleZoomReset,
    handleCloseAllPanels,
    handleShowCustomization,
    handleToggleSidebar,
    handleShowNodeMapLinks,
    handleCloseNodeMapLinksPanel
  };
};