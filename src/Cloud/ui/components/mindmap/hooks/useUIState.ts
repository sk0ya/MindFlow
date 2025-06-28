import { useState, useEffect } from 'react';

/**
 * UI状態管理のカスタムフック（パネル、モーダル、メニューなど）
 */
export const useUIState = () => {
  // 基本UI状態
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const [customizationPosition, setCustomizationPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [clipboard, setClipboard] = useState(null);
  
  // キーボードショートカットヘルパー状態
  const [showShortcutHelper, setShowShortcutHelper] = useState(false);
  
  // マップリスト状態
  const [showMapList, setShowMapList] = useState(false);
  
  // ノードマップリンクパネル状態
  const [showNodeMapLinksPanel, setShowNodeMapLinksPanel] = useState(false);
  const [nodeMapLinksPanelPosition, setNodeMapLinksPanelPosition] = useState({ x: 0, y: 0 });
  const [selectedNodeForLinks, setSelectedNodeForLinks] = useState(null);
  
  // サイドバー状態
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // クラウドストレージパネル状態
  const [showCloudStoragePanel, setShowCloudStoragePanel] = useState(false);
  
  // 競合通知状態
  const [conflicts, setConflicts] = useState([]);
  
  // 共同編集機能パネル状態
  const [showCollaborativeFeatures, setShowCollaborativeFeatures] = useState(false);
  
  // パフォーマンスダッシュボード状態（開発環境のみ）
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);
  
  // チュートリアル状態
  const [showTutorial, setShowTutorial] = useState(false);

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCloseAllPanels = () => {
    setShowCustomizationPanel(false);
    setShowContextMenu(false);
    setShowNodeMapLinksPanel(false);
  };

  const handleShowCustomization = (node, position) => {
    setCustomizationPosition(position || { x: 300, y: 200 });
    setShowCustomizationPanel(true);
    setShowContextMenu(false);
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleToggleCollaborativeFeatures = () => {
    setShowCollaborativeFeatures(!showCollaborativeFeatures);
  };

  const handleTogglePerformanceDashboard = () => {
    if (process.env.NODE_ENV === 'development') {
      setShowPerformanceDashboard(!showPerformanceDashboard);
    }
  };

  // ノードマップリンク関連のハンドラー
  const handleShowNodeMapLinks = (node, position) => {
    setSelectedNodeForLinks(node);
    setNodeMapLinksPanelPosition(position);
    setShowNodeMapLinksPanel(true);
    handleCloseAllPanels();
    setShowNodeMapLinksPanel(true);
  };

  const handleCloseNodeMapLinksPanel = () => {
    setShowNodeMapLinksPanel(false);
    setSelectedNodeForLinks(null);
  };

  // 競合処理関連
  const handleConflictResolved = (conflict) => {
    setConflicts(prev => [...prev, {
      ...conflict,
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }]);
  };

  const handleDismissConflict = (conflictId) => {
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
  };

  // Escapeキーでパネルを閉じる
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseAllPanels();
      }
      
      // パフォーマンスダッシュボードのトグル（開発環境のみ、Ctrl+Shift+P）
      if (e.ctrlKey && e.shiftKey && e.key === 'P' && process.env.NODE_ENV === 'development') {
        e.preventDefault();
        handleTogglePerformanceDashboard();
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
    setCustomizationPosition,
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
    showCloudStoragePanel,
    setShowCloudStoragePanel,
    conflicts,
    showCollaborativeFeatures,
    setShowCollaborativeFeatures,
    showPerformanceDashboard,
    setShowPerformanceDashboard,
    showTutorial,
    setShowTutorial,
    
    // ハンドラー
    handleZoomReset,
    handleCloseAllPanels,
    handleShowCustomization,
    handleToggleSidebar,
    handleToggleCollaborativeFeatures,
    handleTogglePerformanceDashboard,
    handleShowNodeMapLinks,
    handleCloseNodeMapLinksPanel,
    handleConflictResolved,
    handleDismissConflict
  };
};