import React, { useEffect, useState } from 'react';
import { useMindMap } from '../../../core/hooks/useMindMap';
import Toolbar from '../common/Toolbar';
import MindMapCanvas from './MindMapCanvas';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import ContextMenu from '../common/ContextMenu';
import ErrorBoundary from '../errors/ErrorBoundary';
import ImageModal from '../files/ImageModal';
import FileActionMenu from '../files/FileActionMenu';
import MindMapSidebar from './MindMapSidebar';
import NodeMapLinksPanel from '../../panels/MapLinksPanel';
// Localモードでは直接localStorageを使用
import { getAppSettings } from '../../../core/storage/LocalEngine';
import './MindMapApp.css';

// TutorialOverlayは不要（ローカルモード専用）
import KeyboardShortcutHelper from '../common/KeyboardShortcutHelper';
// useAppInitializationは不要（ローカルモード専用）
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts';

// カスタムフックのインポート
import { useFileHandlers } from './hooks/useFileHandlers';
import { useMapHandlers } from './hooks/useMapHandlers';
import { useUIState } from './hooks/useUIState';
import { useNodeHandlers } from './hooks/useNodeHandlers';
import { useAppActions } from './hooks/useAppActions';

// Types
import type { MindMapNode, MindMapData, User } from '../../../shared/types';

const MindMapApp: React.FC = () => {
  // ローカルモードでは認証不要
  
  // ローカルモードでは単純な初期化（認証やモード選択は不要）
  const [isAppReady, setIsAppReady] = useState(true);
  
  const {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    setSelectedNodeId,
    setEditingNodeId,
    setEditText,
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    dragNode,
    changeParent,
    findNode,
    flattenNodes,
    startEdit,
    finishEdit,
    undo,
    redo,
    canUndo,
    canRedo,
    updateTitle,
    saveMindMap,
    toggleCollapse,
    navigateToDirection,
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile,
    allMindMaps,
    currentMapId,
    createMindMap,
    renameMindMap,
    deleteMindMapById,
    switchToMap,
    refreshAllMindMaps,
    changeMapCategory,
    getAvailableCategories,
    addNodeMapLink,
    removeNodeMapLink,
    reinitializeAfterModeSelection
  } = useMindMap(isAppReady);
  
  // ローカルモードではリアルタイム機能は無効
  const realtimeClient = null;
  const isRealtimeConnected = false;
  const realtimeStatus = 'disconnected';
  const connectedUsers = [];
  const userCursors = [];
  const initializeRealtime = () => {};
  const updateCursorPosition = () => {};
  const triggerLocalSync = () => {};
  
  // ローカルモードでは認証不要（認証状態をダミーで提供）
  const localAuth = { 
    authState: { isAuthenticated: false, user: null }, 
    isAuthVerification: false 
  };
  
  // ローカルモードでは認証ハンドラーもダミー
  const authHandlers = {
    authState: { isAuthenticated: false, user: null, isLoading: false },
    setAuthState: () => {},
    handleGoogleAuth: () => {},
    handleGitHubAuth: () => {},
    handleMagicLinkAuth: () => {},
    handleLogout: () => {},
    handleShowAuthModal: () => {}
  };
  
  const isAuthVerification = false;

  // ローカルモードでは既にモード選択済みなので不要

  // ローカルモードでは認証不要

  // カスタムフックで機能を分離（ローカルモードでは認証ハンドラーは上で定義済み）
  
  const fileHandlers = useFileHandlers(
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile
  );
  
  const mapHandlers = useMapHandlers(
    allMindMaps,
    switchToMap,
    createMindMap,
    deleteMindMapById,
    renameMindMap,
    changeMapCategory
  );
  
  const uiState = useUIState();
  
  const nodeHandlers = useNodeHandlers(
    setSelectedNodeId,
    uiState.setContextMenuPosition,
    uiState.setShowContextMenu,
    uiState.setShowCustomizationPanel,
    addChildNode,
    addSiblingNode,
    updateNode,
    addNodeMapLink,
    removeNodeMapLink,
    updateCursorPosition
  );
  
  const appActions = useAppActions(data, saveMindMap, null, null); // Localでは直接exportMindMapAsJSONを使用
  
  // ローカルモードではリアルタイムハンドラーは不要（ダミー）
  const realtimeHandlers = {
    handleRealtimeInit: () => {},
    handleRealtimeDisconnect: () => {},
    handleRealtimeReconnect: () => {},
    handleConnectionToggle: () => {},
    handleToggleRealtime: () => {},
    handleUserClick: () => {}
  };

  // キーボードショートカットの統合
  useKeyboardShortcuts({
    selectedNodeId,
    editingNodeId,
    setEditingNodeId,
    setEditText,
    startEdit,
    finishEdit,
    editText,
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    navigateToDirection,
    saveMindMap,
    showMapList: uiState.showMapList,
    setShowMapList: uiState.setShowMapList,
    showLocalStorage: uiState.showLocalStoragePanel,
    setShowLocalStorage: uiState.setShowLocalStoragePanel,
    showTutorial: uiState.showTutorial,
    setShowTutorial: uiState.setShowTutorial,
    showKeyboardHelper: uiState.showShortcutHelper,
    setShowKeyboardHelper: uiState.setShowShortcutHelper
  });
  
  // ローカルモードでは初期化完了（認証不要）

  // ローカルモードでは認証チェック不要

  // ファイルアクションメニューのハンドラーを拡張
  const handleCloseAllPanels = () => {
    uiState.handleCloseAllPanels();
    fileHandlers.handleCloseAllPanels();
  };

  // コンテキストメニューのハンドラー
  const handleRightClick = (e: React.MouseEvent, nodeId: string) => {
    nodeHandlers.handleRightClick(e, nodeId);
    uiState.handleCloseAllPanels();
  };

  const handleCopyNode = (node: MindMapNode) => {
    const clipboard = nodeHandlers.handleCopyNode(node);
    uiState.setClipboard(clipboard);
  };

  const handlePasteNode = (parentId: string) => {
    nodeHandlers.handlePasteNode(parentId, uiState.clipboard);
  };

  // ノードマップリンクのハンドラー
  const handleShowNodeMapLinks = (node: MindMapNode, position: { x: number; y: number }) => {
    uiState.handleShowNodeMapLinks(node, position);
  };

  const handleNavigateToMap = async (mapId: string) => {
    try {
      await mapHandlers.handleNavigateToMap(mapId);
      uiState.handleCloseNodeMapLinksPanel();
    } catch (error) {
      console.error('マップナビゲーションエラー:', error);
      alert('マップの切り替えに失敗しました: ' + (error as Error).message);
    }
  };

  // ローカルモードでは認証検証は不要（スキップ）

  // ローカルモードでは初期化処理不要

  // ローカルモードではデータが無い場合のみローディング表示
  if (!data) {
    return (
      <div className="mindmap-app loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>MindFlow</h2>
          <p>ローカルデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mindmap-app">
      {/* データが存在する場合のみメインアプリを表示 */}
      {data ? (
        <>
          <MindMapSidebar
            mindMaps={allMindMaps}
            currentMapId={currentMapId}
            onSelectMap={mapHandlers.handleSelectMap}
            onCreateMap={mapHandlers.handleCreateMap}
            onDeleteMap={mapHandlers.handleDeleteMap}
            onRenameMap={mapHandlers.handleRenameMap}
            onChangeCategory={mapHandlers.handleChangeCategory}
            availableCategories={getAvailableCategories()}
            isCollapsed={uiState.sidebarCollapsed}
            onToggleCollapse={uiState.handleToggleSidebar}
          />
          
          <div className={`container ${uiState.sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
            <Toolbar
              title={data.title}
              onTitleChange={updateTitle}
              onExport={appActions.handleExport}
              onImport={appActions.handleImport}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              zoom={uiState.zoom}
              onZoomReset={uiState.handleZoomReset}
              onShowLocalStoragePanel={() => uiState.setShowLocalStoragePanel(true)}
              authState={authHandlers.authState}
              onShowAuthModal={authHandlers.handleShowAuthModal}
              onLogout={authHandlers.handleLogout}
              onShowShortcutHelper={() => uiState.setShowShortcutHelper(true)}
            />

            <ErrorBoundary>
              <MindMapCanvas
                data={data}
                selectedNodeId={selectedNodeId}
                editingNodeId={editingNodeId}
                editText={editText}
                setEditText={setEditText}
                onSelectNode={nodeHandlers.handleNodeSelect}
                onStartEdit={startEdit}
                onFinishEdit={finishEdit}
                onDragNode={dragNode}
                onChangeParent={changeParent}
                onAddChild={nodeHandlers.handleAddChild}
                onAddSibling={nodeHandlers.handleAddSibling}
                onDeleteNode={deleteNode}
                onRightClick={handleRightClick}
                onToggleCollapse={toggleCollapse}
                onNavigateToDirection={navigateToDirection}
                onFileUpload={fileHandlers.handleFileUpload}
                onRemoveFile={fileHandlers.handleRemoveFile}
                onShowImageModal={fileHandlers.handleShowImageModal}
                onShowFileActionMenu={fileHandlers.handleShowFileActionMenu}
                onShowNodeMapLinks={handleShowNodeMapLinks}
                zoom={uiState.zoom}
                setZoom={uiState.setZoom}
                pan={uiState.pan}
                setPan={uiState.setPan}
              />
            </ErrorBoundary>

            {/* ローカルモードではリアルタイム機能UI不要 */}

            {/* ローカルモード専用機能 */}

            {uiState.showCustomizationPanel && (
              <NodeCustomizationPanel
                selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
                onUpdateNode={updateNode}
                onClose={() => uiState.setShowCustomizationPanel(false)}
                position={uiState.customizationPosition}
              />
            )}

            {uiState.showContextMenu && (
              <ContextMenu
                visible={true}
                position={uiState.contextMenuPosition}
                selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
                onAddChild={nodeHandlers.handleAddChild}
                onAddSibling={nodeHandlers.handleAddSibling}
                onDelete={deleteNode}
                onCustomize={uiState.handleShowCustomization}
                onCopy={handleCopyNode}
                onPaste={handlePasteNode}
                onClose={() => uiState.setShowContextMenu(false)}
              />
            )}

            <ImageModal
              isOpen={fileHandlers.showImageModal}
              image={fileHandlers.modalImage}
              onClose={fileHandlers.handleCloseImageModal}
            />

            <FileActionMenu
              isOpen={fileHandlers.showFileActionMenu}
              file={fileHandlers.actionMenuFile}
              position={fileHandlers.fileActionMenuPosition}
              onClose={fileHandlers.handleCloseFileActionMenu}
              onDownload={fileHandlers.handleFileDownload}
              onRename={fileHandlers.handleFileRename}
              onDelete={fileHandlers.handleFileDelete}
              onView={fileHandlers.handleShowImageModal}
            />

            {uiState.selectedNodeForLinks && (
              <NodeMapLinksPanel
                isOpen={uiState.showNodeMapLinksPanel}
                position={uiState.nodeMapLinksPanelPosition}
                selectedNode={uiState.selectedNodeForLinks}
                currentMapId={currentMapId}
                allMaps={allMindMaps}
                onClose={uiState.handleCloseNodeMapLinksPanel}
                onAddLink={nodeHandlers.handleAddNodeMapLink}
                onRemoveLink={nodeHandlers.handleRemoveNodeMapLink}
                onNavigateToMap={handleNavigateToMap}
              />
            )}

            {/* ローカルモードではストレージパネルは不要 */}

            <footer className="footer">
              <div>
                <span className="footer-brand">© 2024 MindFlow</span>
                <span className="stats">
                  ノード数: {flattenNodes && data?.rootNode ? flattenNodes(data.rootNode).length : 0} | 
                  最終更新: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString('ja-JP') : 'N/A'}
                </span>
                {/* ローカルモードでは同期ステータス不要 */}
              </div>
            </footer>
          </div>
        </>
      ) : null}

      {/* キーボードショートカットヘルパー（ローカルモード用） */}
      <KeyboardShortcutHelper
        isVisible={uiState.showShortcutHelper}
        onClose={() => uiState.setShowShortcutHelper(false)}
      />
    </div>
  );
};

export default MindMapApp;