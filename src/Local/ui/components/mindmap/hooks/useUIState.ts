import { useState, useEffect } from 'react';
import type { MindMapNode } from '../../../../shared/types';

// Type definitions
interface Position {
  x: number;
  y: number;
}

interface ConflictInfo {
  id: string;
  timestamp: number;
  [key: string]: any;
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
  
  // クラウドストレージパネル状態
  const [showCloudStoragePanel, setShowCloudStoragePanel] = useState<boolean>(false);
  
  // ローカルストレージパネル状態
  const [showLocalStoragePanel, setShowLocalStoragePanel] = useState<boolean>(false);
  
  // 競合通知状態
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  
  // 共同編集機能パネル状態
  const [showCollaborativeFeatures, setShowCollaborativeFeatures] = useState<boolean>(false);
  
  // パフォーマンスダッシュボード状態（開発環境のみ）
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState<boolean>(false);
  
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

  const handleToggleCollaborativeFeatures = (): void => {
    setShowCollaborativeFeatures(!showCollaborativeFeatures);
  };

  const handleTogglePerformanceDashboard = (): void => {
    if (process.env.NODE_ENV === 'development') {
      setShowPerformanceDashboard(!showPerformanceDashboard);
    }
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

  // 競合処理関連
  const handleConflictResolved = (conflict: Partial<ConflictInfo>): void => {
    setConflicts(prev => [...prev, {
      ...conflict,
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    } as ConflictInfo]);
  };

  const handleDismissConflict = (conflictId: string): void => {
    setConflicts(prev => prev.filter((c: ConflictInfo) => c.id !== conflictId));
  };

  // Escapeキーでパネルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
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
    showLocalStoragePanel,
    setShowLocalStoragePanel,
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